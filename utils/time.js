/**
 * 时间与工时计算工具
 * 规则：8 小时 = 1 个工时；出勤时长少于 1 小时的部分舍去（向下取整到整小时）
 */

const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

/** 日期对象 -> { ymd:'2026-09-03', hm:'07:52', hms, ym:'2026-09', week:'周四', ts } */
function toInfo(d) {
  const dt = d || new Date();
  const y = dt.getFullYear();
  const m = pad2(dt.getMonth() + 1);
  const day = pad2(dt.getDate());
  return {
    ymd: y + '-' + m + '-' + day,
    hm: pad2(dt.getHours()) + ':' + pad2(dt.getMinutes()),
    hms: pad2(dt.getHours()) + ':' + pad2(dt.getMinutes()) + ':' + pad2(dt.getSeconds()),
    ym: y + '-' + m,
    week: WEEK_CN[dt.getDay()],
    ts: dt.getTime(),
    dateObj: dt,
  };
}

function now() {
  return toInfo(new Date());
}

/**
 * 计算出勤与工时（按真实时间差，天然支持跨天夜班）
 * @param {number} startTs 上班时间戳
 * @param {number} endTs   下班时间戳
 * @param {number} capHours 计酬上限（小时）：超过上限按上限计入，如 12 小时班制传 12
 * 规则：
 *   1. 出勤总时长向下取整到整小时（不足 1 小时部分舍去）；
 *   2. 取整后的时长超过班制上限时，按上限计入工时；
 *   3. 8 小时 = 1 工时。
 * 返回：minutes 为原始出勤分钟数（用于展示真实出勤），hours 为计入工时的整小时数。
 */
function calcWork(startTs, endTs, capHours) {
  let diff = endTs - startTs;
  if (diff < 0) diff = 0;
  const totalMinutes = Math.floor(diff / 60000);
  const rawHours = Math.floor(totalMinutes / 60); // 不足 1 小时部分舍去
  const cap = Number(capHours) > 0 ? Number(capHours) : 0;
  const capped = !!(cap && rawHours > cap);
  const hours = capped ? cap : rawHours; // 超过班制上限按上限计入
  const minutes = totalMinutes % 60;
  return {
    minutes: totalMinutes, // 原始出勤分钟数
    rawHours: rawHours, // 原始出勤整小时数
    hours: hours, // 计入工时的整小时数（已按上限截断）
    cap: cap,
    capped: capped,
    restMinutes: minutes,
    units: round2(hours / 8), // 8 小时 = 1 工时
    tooLong: totalMinutes > 16 * 60, // 超过 16 小时，疑似忘记打卡
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** 分钟 -> "11小时38分" */
function durationText(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return m + '分钟';
  if (m === 0) return h + '小时';
  return h + '小时' + m + '分';
}

/** '2026-09-03' -> '周四' */
function weekOf(dateStr) {
  const dp = String(dateStr || '').split('-');
  const d = new Date(Number(dp[0]), (Number(dp[1]) || 1) - 1, Number(dp[2]) || 1);
  return isNaN(d.getTime()) ? '' : WEEK_CN[d.getDay()];
}

/** '2026-09-03' -> '09月03日' */
function mdText(dateStr) {
  const p = String(dateStr || '').split('-');
  if (p.length < 3) return dateStr || '';
  return p[1] + '月' + p[2] + '日';
}

/** '2026-09' -> '2026年09月' */
function ymText(ym) {
  const p = String(ym || '').split('-');
  if (p.length < 2) return ym || '';
  return p[0] + '年' + p[1] + '月';
}

/** 当前年月 */
function currentYm() {
  return now().ym;
}

module.exports = {
  pad2,
  now,
  calcWork,
  durationText,
  weekOf,
  mdText,
  ymText,
  currentYm,
  round2,
  WEEK_CN,
};
