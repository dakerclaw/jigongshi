/* ------------------------------------------------------------------
 * 出勤轻松记 · 微信小程序
 * 版权所有 © 2026 dakerclaw，保留所有权利。
 * 本文件属专有软件，未经授权不得复制、修改、分发或用于商业用途。
 * 详见项目根目录 LICENSE 文件。
 * ------------------------------------------------------------------ */

/**
 * 班制 / 班次定义
 * 12 小时班制：白班、夜班
 * 8 小时班制：白班、中班、夜班
 */

const SHIFT_TYPES = [
  { key: '12h', label: '12小时班制', desc: '一天两班倒', shifts: ['白班', '夜班'] },
  { key: '8h', label: '8小时班制', desc: '一天三班倒', shifts: ['白班', '中班', '夜班'] },
];

const DEFAULT_TYPE = '12h';
const SAFE_TYPE = '8h'; // 旧数据 / 未知班制按 8 小时保守封顶

/** 取某班制下的班次列表 */
function shiftsOf(type) {
  const t = SHIFT_TYPES.find((x) => x.key === type);
  return t ? t.shifts : SHIFT_TYPES[0].shifts;
}

function labelOf(type) {
  const t = SHIFT_TYPES.find((x) => x.key === type);
  return t ? t.label : '';
}

function isValidType(type) {
  return SHIFT_TYPES.some((x) => x.key === type);
}

function isValidShift(type, shift) {
  return shiftsOf(type).indexOf(shift) >= 0;
}

/**
 * 各班制的计酬工时上限（小时）
 * 12 小时班制：出勤超过 12 小时，按 12 小时计入工时
 * 8 小时班制 ：出勤超过 8 小时，按 8 小时计入工时
 * 未知班制按 8 小时保守封顶，避免旧数据被高估。
 */
const MAX_HOURS = { '12h': 12, '8h': 8 };

function maxHoursOf(type) {
  return MAX_HOURS[type] || MAX_HOURS[SAFE_TYPE];
}

/** 超过「班制上限 + 2 小时」视为忘记下班：8h 班制 10h，12h 班制 14h */
const MISSED_EXTRA_HOURS = 2;

function missedHoursOf(type) {
  return maxHoursOf(type) + MISSED_EXTRA_HOURS;
}

/** 班次 -> 样式后缀（day / mid / night） */
function themeOf(shift) {
  if (shift === '夜班') return 'night';
  if (shift === '中班') return 'mid';
  return 'day';
}

/** 班次可选工时（1-12 小时） */
const HOUR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

module.exports = {
  SHIFT_TYPES,
  shiftsOf,
  labelOf,
  isValidType,
  isValidShift,
  themeOf,
  maxHoursOf,
  missedHoursOf,
  HOUR_OPTIONS,
  DEFAULT_TYPE,
};
