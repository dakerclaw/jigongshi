/* ------------------------------------------------------------------
 * 出勤轻松记 · 微信小程序
 * 版权所有 © 2026 dakerclaw，保留所有权利。
 * 本文件属专有软件，未经授权不得复制、修改、分发或用于商业用途。
 * 详见项目根目录 LICENSE 文件。
 * ------------------------------------------------------------------ */

/**
 * 本地存储层：记录、班制配置、未完成打卡（pending）
 * 全部使用微信本地 Storage，无需后端。
 * 所有写操作都返回 true/false，调用方必须处理失败，避免「提示成功但没写入」。
 */

const time = require('./time.js');
const shiftUtil = require('./shift.js');

/**
 * 微信开发版/体验版/正式版共用同一份本地 Storage，必须用 key 前缀隔离，
 * 避免测试版写入或清空数据时影响正式版。正式版继续使用旧 key，保证历史数据可读。
 */
const APP_ENV = (() => {
  try {
    if (typeof wx !== 'undefined' && typeof wx.getAccountInfoSync === 'function') {
      const info = wx.getAccountInfoSync();
      return (info && info.miniProgram && info.miniProgram.envVersion) || 'release';
    }
  } catch (e) {
    // 基础库过低或接口异常时按正式版处理
  }
  return 'release';
})();

const ENV_KEY_PREFIX = APP_ENV === 'develop' ? 'DEV_' : APP_ENV === 'trial' ? 'TRIAL_' : '';
const KEY_PREFIX = ENV_KEY_PREFIX ? 'JG_' + ENV_KEY_PREFIX : 'JG_';
const KEY_RECORDS = KEY_PREFIX + 'RECORDS'; // 全部出勤记录
const KEY_CONFIG = KEY_PREFIX + 'CONFIG'; // 默认班制配置
const KEY_PENDING = KEY_PREFIX + 'PENDING'; // 已上班、未下班

const LEGACY_KEY_RECORDS = 'JG_RECORDS';
const LEGACY_KEY_CONFIG = 'JG_CONFIG';

const BACKUP_APP = 'jigongshi';
const BACKUP_VERSION = 1;

function safeGet(key, def) {
  try {
    const v = wx.getStorageSync(key);
    return v === '' || v === null || v === undefined ? def : v;
  } catch (e) {
    return def;
  }
}

function safeSet(key, value) {
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 开发版/体验版首次运行时，把正式版当前数据复制一份作为初始快照。
 * 只复制记录与班制，不复制 pending，避免测试版重复触发自动下班。
 */
function seedEnvStorage() {
  if (!ENV_KEY_PREFIX) return;
  if (safeGet(KEY_RECORDS, undefined) === undefined) {
    const records = safeGet(LEGACY_KEY_RECORDS, undefined);
    if (Array.isArray(records)) safeSet(KEY_RECORDS, records);
  }
  if (safeGet(KEY_CONFIG, undefined) === undefined) {
    const config = safeGet(LEGACY_KEY_CONFIG, undefined);
    if (config) safeSet(KEY_CONFIG, config);
  }
}

seedEnvStorage();

/** 当前本地数据所属的小程序版本，用于关于页提示 */
function getStorageEnv() {
  if (APP_ENV === 'develop') return { version: 'develop', label: '开发版', isolated: true };
  if (APP_ENV === 'trial') return { version: 'trial', label: '体验版', isolated: true };
  return { version: 'release', label: '正式版', isolated: false };
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------------- 记录 ---------------- */

function getRecords() {
  const list = safeGet(KEY_RECORDS, []);
  // 返回浅拷贝，避免写入失败时把 Storage 中的数组原地改掉
  return Array.isArray(list) ? list.filter((r) => r && typeof r === 'object').slice() : [];
}

function saveRecords(list) {
  return safeSet(KEY_RECORDS, Array.isArray(list) ? list : []);
}

function getRecordById(id) {
  return getRecords().find((r) => r && String(r.id) === String(id)) || null;
}

/** 新增一条记录，返回该记录；写入失败返回 null */
function addRecord(record) {
  const list = getRecords();
  const item = Object.assign({ id: genId(), createdAt: Date.now() }, record);
  list.push(item);
  return saveRecords(list) ? item : null;
}

/** 删除一条记录，返回最新列表；写入失败返回 null */
function removeRecord(id) {
  const list = getRecords().filter((r) => String(r.id) !== String(id));
  return saveRecords(list) ? list : null;
}

/** 更新一条记录（浅合并），返回更新后的记录；失败返回 null */
function updateRecord(id, patch) {
  const list = getRecords();
  const idx = list.findIndex((r) => r && String(r.id) === String(id));
  if (idx < 0) return null;
  list[idx] = Object.assign({}, list[idx], patch);
  return saveRecords(list) ? list[idx] : null;
}

/** 撤销删除：按原 id 放回，返回记录；失败或已存在返回 null */
function restoreRecord(record) {
  if (!record || !record.id) return null;
  const list = getRecords();
  if (list.some((r) => r && String(r.id) === String(record.id))) return null;
  list.push(Object.assign({}, record));
  return saveRecords(list) ? record : null;
}

/** 取某月记录 ym = '2026-09'，按日期升序 */
function getRecordsByMonth(ym) {
  return getRecords()
    .filter((r) => r && String(r.date || '').slice(0, 7) === ym)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0);
    });
}

/* ---------------- 未完成打卡 ---------------- */

function getPending() {
  const p = safeGet(KEY_PENDING, null);
  return p && p.date ? p : null;
}

function setPending(p) {
  return safeSet(KEY_PENDING, p);
}

function clearPending() {
  return safeSet(KEY_PENDING, null);
}

/* ---------------- 默认班制 ---------------- */

function getConfig() {
  return safeGet(KEY_CONFIG, null);
}

function saveConfig(cfg) {
  return safeSet(KEY_CONFIG, cfg);
}

/* ---------------- 备份 / 恢复 ---------------- */

/** 导出全部本地数据（用于剪贴板备份） */
function exportData() {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    records: getRecords(),
    config: getConfig(),
    pending: getPending(),
  };
}

/**
 * 导入备份（覆盖本机记录、配置与 pending）
 * 只接受结构正确的最小数据；返回 true/false。
 */
function importData(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.records)) return false;
  if (data.app && data.app !== BACKUP_APP) return false;

  const seen = Object.create(null);
  const records = data.records
    .filter((r) => r && typeof r === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(String(r.date || '')))
    .map((r) => {
      let id = r.id !== undefined && r.id !== null && r.id !== '' ? String(r.id) : genId();
      while (seen[id]) id = genId();
      seen[id] = true;
      const hours = Math.max(0, Number(r.hours) || 0);
      return Object.assign({}, r, {
        id: id,
        createdAt: Number(r.createdAt) || Date.now(),
        hours: hours,
        minutes: Math.max(0, Number(r.minutes) || 0),
        units: time.hoursToUnits(hours),
      });
    });

  const cfg = data.config;
  const nextConfig =
    cfg && shiftUtil.isValidType(cfg.shiftType) && shiftUtil.isValidShift(cfg.shiftType, cfg.shift)
      ? { shiftType: cfg.shiftType, shift: cfg.shift }
      : null;

  const pending = data.pending;
  const nextPending = pending && pending.date && Number(pending.startTs) > 0 ? pending : null;

  // 先备份旧值，任意一步写入失败时尽量回滚，避免只导入一半
  const oldRecords = getRecords();
  const oldConfig = safeGet(KEY_CONFIG, null);

  if (!saveRecords(records)) return false;
  if (!safeSet(KEY_CONFIG, nextConfig)) {
    saveRecords(oldRecords);
    return false;
  }
  if (!safeSet(KEY_PENDING, nextPending)) {
    saveRecords(oldRecords);
    safeSet(KEY_CONFIG, oldConfig);
    return false;
  }
  return true;
}

/** 清空全部工时记录与未完成打卡（保留默认班制） */
function clearAllRecords() {
  const oldRecords = getRecords();
  if (!saveRecords([])) return false;
  if (!safeSet(KEY_PENDING, null)) {
    saveRecords(oldRecords);
    return false;
  }
  return true;
}

module.exports = {
  getStorageEnv,
  getRecords,
  getRecordById,
  addRecord,
  removeRecord,
  updateRecord,
  restoreRecord,
  getRecordsByMonth,
  getPending,
  setPending,
  clearPending,
  getConfig,
  saveConfig,
  exportData,
  importData,
  clearAllRecords,
};
