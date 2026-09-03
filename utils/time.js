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

/** '2026-09-03' + '07:52' -> 时间戳 */
function toTs(dateStr, timeStr) {
  const dp = String(dateStr || '').split('-');
  const tp = String(timeStr || '00:00').split(':');
  const d = new Date(
    Number(dp[0]) || 1970,
    (Number(dp[1]) || 1) - 1,
    Number(dp[2]) || 1,
    Number(tp[0]) || 0,
    Number(tp[1]) || 0,
    0,
  );
  return d.getTime();
}

/**
 * 计算出勤与工时（按真实时间差，天然支持跨天夜班）
 * @param {number} startTs 上班时间戳
 * @param {number} endTs   下班时间戳
 * 规则：总时长向下取整到整小时（不足 1 小时部分舍去）；8 小时 = 1 工时
 */
function calcWork(startTs, endTs) {
  let diff = endTs - startTs;
  if (diff < 0) diff = 0;
  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60); // 不足 1 小时部分舍去
  const minutes = totalMinutes % 60;
  return {
    minutes: totalMinutes,
    hours: hours,
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

/** 某月天数 */
function daysOfMonth(ym) {
  const p = String(ym || '').split('-');
  const y = Number(p[0]);
  const m = Number(p[1]);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

/** 当前年月 */
function currentYm() {
  return now().ym;
}

/** 生成最近 N 个月的 ym 列表（含当前月，倒序） */
function recentMonths(n) {
  const d = new Date();
  const list = [];
  for (let i = 0; i < n; i++) {
    const y = d.getFullYear();
    const m = d.getMonth() + 1 - i;
    const dt = new Date(y, m - 1, 1);
    list.push(dt.getFullYear() + '-' + pad2(dt.getMonth() + 1));
  }
  return list;
}

module.exports = {
  pad2,
  toInfo,
  now,
  toTs,
  calcWork,
  durationText,
  weekOf,
  mdText,
  ymText,
  daysOfMonth,
  currentYm,
  recentMonths,
  round2,
  WEEK_CN,
};
