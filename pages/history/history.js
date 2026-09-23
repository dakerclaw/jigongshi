/* ------------------------------------------------------------------
 * 出勤轻松记 · 微信小程序
 * 版权所有 © 2026 dakerclaw，保留所有权利。
 * 本文件属专有软件，未经授权不得复制、修改、分发或用于商业用途。
 * 详见项目根目录 LICENSE 文件。
 * ------------------------------------------------------------------ */

const store = require('../../utils/store.js');
const time = require('../../utils/time.js');
const shiftUtil = require('../../utils/shift.js');
const { toast } = require('../../utils/ui.js');

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
        units: time.round2(map[ym].hours / 8),
        days: Object.keys(map[ym].days).length,
        shiftHours: map[ym].shiftHours,
      }));

    // 柱状条按「工时个数」比例（8 小时 = 1 个工时）
    const max = list.reduce((m, x) => (x.units > m ? x.units : m), 0);
    return list.map((x) => ({
      ym: x.ym,
      hours: x.hours,
      units: x.units.toFixed(2),
      days: x.days,
      shiftHours: x.shiftHours,
      label: time.ymText(x.ym),
      pct: max ? Math.max(6, Math.round((x.units / max) * 100)) : 0,
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

    // 班次分布（展示折合工时个数，8 小时 = 1 个工时）
    const shiftHours = cur ? cur.shiftHours : {};
    const shiftStat = Object.keys(shiftHours)
      .map((name) => ({
        name: name,
        theme: shiftUtil.themeOf(name),
        units: time.round2(shiftHours[name] / 8),
      }))
      .sort((a, b) => b.units - a.units);
    const sMax = shiftStat.reduce((m, x) => (x.units > m ? x.units : m), 0);
    shiftStat.forEach((x) => {
      x.pct = sMax ? Math.max(8, Math.round((x.units / sMax) * 100)) : 0;
      x.units = x.units.toFixed(2);
    });

    const days = rows.length;
    const hasCapped = list.some((r) => r.capped);
    this.setData({
      ym: ym,
      ymText: time.ymText(ym),
      monthStat: monthStat,
      shiftStat: shiftStat,
      rows: rows,
      hasCapped: hasCapped,
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

  /* ---------------- 复制查询结果 ---------------- */

  onCopyMonth() {
    if (!this.data.rows.length) {
      toast(this, '该月份还没有记录');
      return;
    }
    const lines = [];
    lines.push('记工时 · ' + this.data.ymText);
    lines.push('日期\t班次\t出勤小时\t折合工时');
    this.data.rows.forEach((r) => {
      lines.push(r.md + '\t' + r.shiftText + '\t' + r.hours + '\t' + r.units);
    });
    lines.push('');
    lines.push(
      '合计\t' + this.data.workDays + '天\t' + this.data.totalHours + '\t' + this.data.totalUnits,
    );
    lines.push('（8 小时 = 1 工时，出勤时长不足 1 小时部分已舍去）');
    if (this.data.hasCapped) {
      lines.push('（打卡出勤超出班制上限的，已按上限计入工时：12 小时班制上限 12 小时，8 小时班制上限 8 小时）');
    }

    const text = lines.join('\n');
    wx.setClipboardData({
      data: text,
      success: () => toast(this, '已复制到粘贴板'),
      fail: () => toast(this, '复制失败，请重试'),
    });
  },

  onShareAppMessage() {
    return {
      title: '记工时 · 查询历史出勤工时',
      path: '/pages/history/history',
      imageUrl: '/assets/share-cover.jpg',
    };
  },
});
