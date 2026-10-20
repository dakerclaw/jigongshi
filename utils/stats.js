/* ------------------------------------------------------------------
 * 出勤轻松记 · 微信小程序
 * 版权所有 © 2026 dakerclaw，保留所有权利。
 * 本文件属专有软件，未经授权不得复制、修改、分发或用于商业用途。
 * 详见项目根目录 LICENSE 文件。
 * ------------------------------------------------------------------ */

/**
 * 统计聚合：按日、按月、按班次
 * 页面只负责渲染，口径统一放在这里，避免三页各算一套。
 */

const time = require('./time.js');
const shiftUtil = require('./shift.js');

const DEFAULT_MAX_MONTHS = 24;

/** 记录数组 -> { '2026-09-01': { date, hours, minutes, count, shifts, capped } } */
function buildDayMap(records) {
  const map = {};
  (records || []).forEach((r) => {
    if (!r || !r.date) return;
    if (!map[r.date]) {
      map[r.date] = { date: r.date, hours: 0, minutes: 0, count: 0, shifts: [], capped: false };
    }
    const it = map[r.date];
    it.hours += Number(r.hours) || 0;
    it.minutes += Number(r.minutes) || 0;
    it.count += 1;
    it.capped = it.capped || !!r.capped;
    const shiftName = r.shift || '未标注班次';
    if (it.shifts.indexOf(shiftName) < 0) it.shifts.push(shiftName);
  });
  return map;
}

/** 月度汇总（出勤天数按「有记录的自然日」计，含折算为 0 工时的短时出勤） */
function summarize(records) {
  const map = buildDayMap(records);
  let totalHours = 0;
  let totalMinutes = 0;
  const days = Object.keys(map);

  days.forEach((d) => {
    totalHours += map[d].hours;
    totalMinutes += map[d].minutes;
  });

  const workDays = days.length;
  return {
    totalHours: totalHours,
    totalMinutes: totalMinutes,
    totalUnits: time.hoursToUnits(totalHours),
    workDays: workDays,
    avgHours: workDays ? (Math.round((totalHours / workDays) * 10) / 10).toFixed(1) : '0.0',
  };
}

/** 班次分布：按当前月记录聚合，返回 [{name, theme, units, pct}] */
function shiftStats(records) {
  const map = {};
  (records || []).forEach((r) => {
    if (!r) return;
    const name = r.shift || '未标注班次';
    if (!map[name]) map[name] = { name: name, theme: shiftUtil.themeOf(name), hours: 0 };
    map[name].hours += Number(r.hours) || 0;
  });

  const list = Object.keys(map)
    .map((name) => ({
      name: name,
      theme: map[name].theme,
      units: time.hoursToUnits(map[name].hours),
    }))
    .sort((a, b) => b.units - a.units);

  const max = list.reduce((m, x) => (x.units > m ? x.units : m), 0);
  list.forEach((x) => {
    // 0 工时不再显示最小柱，避免「没上班也有柱子」
    x.pct = max && x.units > 0 ? Math.max(8, Math.round((x.units / max) * 100)) : 0;
    x.units = x.units.toFixed(2);
  });
  return list;
}

/** 近 N 个月统计，按月份倒序 */
function monthStats(records, maxMonths) {
  const limit = Number(maxMonths) > 0 ? Number(maxMonths) : DEFAULT_MAX_MONTHS;
  const map = {};

  (records || []).forEach((r) => {
    if (!r || !r.date) return;
    const ym = String(r.date).slice(0, 7);
    if (!ym) return;
    if (!map[ym]) map[ym] = { ym: ym, hours: 0, days: {}, shiftHours: {} };
    const hours = Number(r.hours) || 0;
    map[ym].hours += hours;
    map[ym].days[r.date] = 1;
    const shift = r.shift || '未标注班次';
    map[ym].shiftHours[shift] = (map[ym].shiftHours[shift] || 0) + hours;
  });

  const list = Object.keys(map)
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, limit)
    .map((ym) => ({
      ym: ym,
      hours: map[ym].hours,
      units: time.hoursToUnits(map[ym].hours),
      days: Object.keys(map[ym].days).length,
      shiftHours: map[ym].shiftHours,
    }));

  const max = list.reduce((m, x) => (x.units > m ? x.units : m), 0);
  return list.map((x) => ({
    ym: x.ym,
    hours: x.hours,
    units: x.units.toFixed(2),
    days: x.days,
    shiftHours: x.shiftHours,
    label: time.ymText(x.ym),
    pct: max && x.units > 0 ? Math.max(6, Math.round((x.units / max) * 100)) : 0,
  }));
}

/** 每日折合工时之和与「总工时折算」的差异提示（四舍五入导致） */
function hasRoundingGap(dayMap, totalUnits) {
  let sum = 0;
  Object.keys(dayMap).forEach((d) => {
    sum += time.hoursToUnits(dayMap[d].hours);
  });
  return Math.abs(sum - (Number(totalUnits) || 0)) > 0.004;
}

module.exports = {
  buildDayMap,
  summarize,
  shiftStats,
  monthStats,
  hasRoundingGap,
};
