/* ------------------------------------------------------------------
 * 出勤轻松记 · 微信小程序
 * 版权所有 © 2026 dakerclaw，保留所有权利。
 * 本文件属专有软件，未经授权不得复制、修改、分发或用于商业用途。
 * 详见项目根目录 LICENSE 文件。
 * ------------------------------------------------------------------ */

const store = require('../../utils/store.js');
const time = require('../../utils/time.js');
const stats = require('../../utils/stats.js');
const { toast, setTabBarHidden } = require('../../utils/ui.js');

const MAX_MONTHS = 24;

Page({
  data: {
    ym: '',
    ymText: '',
    currentYm: '',

    totalHours: 0,
    totalMinutes: 0,
    totalUnits: '0.00',
    workDays: 0,
    avgHours: '0.0',
    hasCapped: false,

    shiftStat: [],
    monthStat: [],
    rows: [],
  },

  onLoad() {
    this.setData({ ym: time.currentYm() });
  },

  onShow() {
    setTabBarHidden(this, false);
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.load(this.data.ym || time.currentYm());
  },

  onPullDownRefresh() {
    this.load(this.data.ym);
    wx.stopPullDownRefresh();
  },

  onHide() {
    setTabBarHidden(this, false);
  },

  load(ym) {
    const currentYm = time.currentYm();
    let month = String(ym || currentYm);
    if (month > currentYm) month = currentYm; // 不展示未来月份

    // 近 24 个月对比：直接基于全部记录聚合
    const monthStat = stats.monthStats(store.getRecords(), MAX_MONTHS);

    const list = store.getRecordsByMonth(month);
    const dayMap = stats.buildDayMap(list);
    const sum = stats.summarize(list);

    const rows = Object.keys(dayMap)
      .sort()
      .map((d) => ({
        date: d,
        hours: dayMap[d].hours,
        units: time.hoursToUnits(dayMap[d].hours).toFixed(2),
        shiftText: dayMap[d].shifts.join('/'),
        rawText: time.durationText(dayMap[d].minutes),
      }));

    // 班次分布只取「当前查询月份」，不再受 24 个月截断影响
    const shiftStat = stats.shiftStats(list);

    this.setData({
      ym: month,
      ymText: time.ymText(month),
      currentYm: currentYm,
      monthStat: monthStat,
      shiftStat: shiftStat,
      rows: rows,
      hasCapped: list.some((r) => r && r.capped),
      totalHours: sum.totalHours,
      totalMinutes: sum.totalMinutes,
      totalUnits: sum.totalUnits.toFixed(2),
      workDays: sum.workDays,
      avgHours: sum.avgHours,
    });
  },

  onMonthChange(e) {
    const ym = String(e.detail.value || '');
    if (!ym) return;
    if (ym > time.currentYm()) {
      toast('不能查看未来月份');
      return;
    }
    this.load(ym);
  },

  onPickBar(e) {
    this.load(e.currentTarget.dataset.ym);
  },

  /* ---------------- 复制查询结果 ---------------- */

  onCopyMonth() {
    if (!this.data.rows.length) {
      toast('该月份还没有记录');
      return;
    }
    const lines = [];
    lines.push('记工时 · ' + this.data.ymText);
    lines.push('日期\t班次\t真实出勤\t计酬小时\t折合工时');
    this.data.rows.forEach((r) => {
      lines.push(r.date + '\t' + r.shiftText + '\t' + r.rawText + '\t' + r.hours + '\t' + r.units);
    });
    lines.push('');
    lines.push(
      '合计\t' +
        this.data.workDays +
        '天\t' +
        time.durationText(this.data.totalMinutes) +
        '\t' +
        this.data.totalHours +
        '\t' +
        this.data.totalUnits,
    );
    lines.push('（8 小时 = 1 工时，出勤时长不足 1 小时部分已舍去；折合工时按每日工时 ÷ 8 保留两位小数后逐日相加）');
    if (this.data.hasCapped) {
      lines.push('（打卡出勤超出班制上限的，已按上限计入计酬小时：12 小时班制上限 12 小时，8 小时班制上限 8 小时）');
    }

    wx.setClipboardData({
      data: lines.join('\n'),
      fail: () => toast('复制失败，请重试'),
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
