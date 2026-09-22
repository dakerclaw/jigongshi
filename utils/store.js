/* ------------------------------------------------------------------
 * 出勤轻松记 · 微信小程序
 * 版权所有 © 2026 dakerclaw，保留所有权利。
 * 本文件属专有软件，未经授权不得复制、修改、分发或用于商业用途。
 * 详见项目根目录 LICENSE 文件。
 * ------------------------------------------------------------------ */

/**
 * 本地存储层：记录、班制配置、未完成打卡（pending）
 * 全部使用微信本地 Storage，无需后端
 */

const KEY_RECORDS = 'JG_RECORDS'; // 全部出勤记录
const KEY_CONFIG = 'JG_CONFIG'; // 默认班制配置
const KEY_PENDING = 'JG_PENDING'; // 已上班、未下班

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

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------------- 记录 ---------------- */

function getRecords() {
  const list = safeGet(KEY_RECORDS, []);
  return Array.isArray(list) ? list : [];
}

function saveRecords(list) {
  return safeSet(KEY_RECORDS, list);
}

/** 新增一条记录，返回该记录 */
function addRecord(record) {
  const list = getRecords();
  const item = Object.assign({ id: genId(), createdAt: Date.now() }, record);
  list.push(item);
  saveRecords(list);
  return item;
}

function removeRecord(id) {
  const list = getRecords().filter((r) => r.id !== id);
  saveRecords(list);
  return list;
}

/** 取某月记录 ym = '2026-09'，按日期升序 */
function getRecordsByMonth(ym) {
  return getRecords()
    .filter((r) => (r.date || '').slice(0, 7) === ym)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
}

/* ---------------- 未完成打卡 ---------------- */

function getPending() {
  const p = safeGet(KEY_PENDING, null);
  return p && p.date ? p : null;
}

function setPending(p) {
  safeSet(KEY_PENDING, p);
}

function clearPending() {
  safeSet(KEY_PENDING, null);
}

/* ---------------- 默认班制 ---------------- */

function getConfig() {
  return safeGet(KEY_CONFIG, null);
}

function saveConfig(cfg) {
  safeSet(KEY_CONFIG, cfg);
}

module.exports = {
  getRecords,
  saveRecords,
  addRecord,
  removeRecord,
  getRecordsByMonth,
  getPending,
  setPending,
  clearPending,
  getConfig,
  saveConfig,
  genId,
};
