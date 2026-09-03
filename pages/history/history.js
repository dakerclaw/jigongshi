const store = require('../../utils/store.js');
const time = require('../../utils/time.js');
const shiftUtil = require('../../utils/shift.js');

const MAX_MONTHS = 24;

Page({
  data: {
    ym: '',
    ymText: '',

    totalHours: 0,
    totalUnits: '0.00',
    workDays: 0,
    avgHours: '0.0',

    shiftStat: [],
    monthStat: [],
    rows: [],
  },

  onLoad() {
    this.setData({ ym: time.currentYm() });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.load(this.data.ym || time.currentYm());
  },

  onPullDownRefresh() {
    this.load(this.data.ym);
    wx.stopPullDownRefresh();
  },

  /** 汇总所有记录 -> 按月统计 */
  buildMonthStat() {
    const map = {};
    store.getRecords().forEach((r) => {
      const ym = (r.date || '').slice(0, 7);
      if (!ym) return;
      if (!map[ym]) map[ym] = { ym: ym, hours: 0, days: {}, shiftHours: {} };
      map[ym].hours += Number(r.hours) || 0;
      map[ym].days[r.date] = 1;
      map[ym].shiftHours[r.shift] = (map[ym].shiftHours[r.shift] || 0) + (Number(r.hours) || 0);
    });

    const list = Object.keys(map)
      .sort((a, b) => (a < b ? 1 : -1))
      .slice(0, MAX_MONTHS)
      .map((ym) => ({
        ym: ym,
        hours: map[ym].hours,
        days: Object.keys(map[ym].days).length,
        shiftHours: map[ym].shiftHours,
      }));

    const max = list.reduce((m, x) => (x.hours > m ? x.hours : m), 0);
    return list.map((x) => ({
      ym: x.ym,
      hours: x.hours,
      days: x.days,
      shiftHours: x.shiftHours,
      label: time.ymText(x.ym).replace('年', '年'),
      pct: max ? Math.max(6, Math.round((x.hours / max) * 100)) : 0,
    }));
  },

  load(ym) {
    const monthStat = this.buildMonthStat();
    const cur = monthStat.find((x) => x.ym === ym);

    const list = store.getRecordsByMonth(ym);
    const dayMap = {};
    let totalHours = 0;
    list.forEach((r) => {
      if (!dayMap[r.date]) dayMap[r.date] = { date: r.date, hours: 0, shifts: [] };
      dayMap[r.date].hours += Number(r.hours) || 0;
      if (dayMap[r.date].shifts.indexOf(r.shift) < 0) dayMap[r.date].shifts.push(r.shift);
      totalHours += Number(r.hours) || 0;
    });

    const rows = Object.keys(dayMap)
      .sort()
      .map((d) => ({
        date: d,
        md: time.mdText(d),
        week: time.weekOf(d),
        hours: dayMap[d].hours,
        units: time.round2(dayMap[d].hours / 8).toFixed(2),
        shiftText: dayMap[d].shifts.join('/'),
        theme: shiftUtil.themeOf(dayMap[d].shifts[0]),
      }));

    // 班次分布
    const shiftHours = cur ? cur.shiftHours : {};
    const shiftStat = Object.keys(shiftHours)
      .map((name) => ({ name: name, theme: shiftUtil.themeOf(name), hours: shiftHours[name] }))
      .sort((a, b) => b.hours - a.hours);
    const sMax = shiftStat.reduce((m, x) => (x.hours > m ? x.hours : m), 0);
    shiftStat.forEach((x) => {
      x.pct = sMax ? Math.max(8, Math.round((x.hours / sMax) * 100)) : 0;
    });

    const days = rows.length;
    this.setData({
      ym: ym,
      ymText: time.ymText(ym),
      monthStat: monthStat,
      shiftStat: shiftStat,
      rows: rows,
      totalHours: totalHours,
      totalUnits: time.round2(totalHours / 8).toFixed(2),
      workDays: days,
      avgHours: days ? (Math.round((totalHours / days) * 10) / 10).toFixed(1) : '0.0',
    });
  },

  onMonthChange(e) {
    this.load(e.detail.value);
  },

  onPickBar(e) {
    this.load(e.currentTarget.dataset.ym);
  },
});
