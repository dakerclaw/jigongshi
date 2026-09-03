/**
 * 班制 / 班次定义
 * 12 小时班制：白班、夜班
 * 8 小时班制：白班、中班、夜班
 */

const SHIFT_TYPES = [
  { key: '12h', label: '12小时班制', desc: '一天两班倒', shifts: ['白班', '夜班'] },
  { key: '8h', label: '8小时班制', desc: '一天三班倒', shifts: ['白班', '中班', '夜班'] },
];

/** 取某班制下的班次列表 */
function shiftsOf(type) {
  const t = SHIFT_TYPES.find((x) => x.key === type);
  return t ? t.shifts : SHIFT_TYPES[0].shifts;
}

function labelOf(type) {
  const t = SHIFT_TYPES.find((x) => x.key === type);
  return t ? t.label : '';
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
  themeOf,
  HOUR_OPTIONS,
};
