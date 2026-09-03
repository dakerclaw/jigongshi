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

function clearAll() {
  saveRecords([]);
  safeSet(KEY_PENDING, null);
}

/** 取某月记录 ym = '2026-09'，按日期升序 */
function getRecordsByMonth(ym) {
  return getRecords()
    .filter((r) => (r.date || '').slice(0, 7) === ym)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
}

/** 存在记录的所有月份（倒序） */
function getAvailableMonths() {
  const set = {};
  getRecords().forEach((r) => {
    const ym = (r.date || '').slice(0, 7);
    if (ym) set[ym] = true;
  });
  return Object.keys(set).sort((a, b) => (a < b ? 1 : -1));
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
  clearAll,
  getRecordsByMonth,
  getAvailableMonths,
  getPending,
  setPending,
  clearPending,
  getConfig,
  saveConfig,
  genId,
};
