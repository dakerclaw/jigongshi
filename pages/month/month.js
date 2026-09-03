const store = require('../../utils/store.js');
const time = require('../../utils/time.js');
const shiftUtil = require('../../utils/shift.js');
const Toast = require('tdesign-miniprogram/toast/index');

const app = getApp();

function toast(page, message) {
  Toast({ context: page, selector: '#t-toast', message: message, duration: 2000 });
}

Page({
  data: {
    ym: '',
    ymText: '',
    rows: [],
    totalHours: 0,
    totalUnits: '0.00',
    workDays: 0,
    avgHours: '0.0',

    // 当天明细 / 补记
    daySheet: { visible: false, date: '', title: '', records: [], totalHours: 0, totalUnits: '0.00' },
    hourOptions: shiftUtil.HOUR_OPTIONS,
    addShifts: [],
    addShift: '白班',
    addHour: 0,
    addUnits: '0.00',

    dialog: {
      visible: false,
      title: '',
      content: '',
      confirmText: '删除',
      cancelText: '再想想',
      delId: '',
    },
  },

  onLoad() {
    this.setData({ ym: time.currentYm() });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.load(this.data.ym || time.currentYm());
  },

  onPullDownRefresh() {
    this.load(this.data.ym);
    wx.stopPullDownRefresh();
  },

  onHide() {
    this.setData({ 'daySheet.visible': false });
  },

  /** 载入某月数据 */
  load(ym) {
    const list = store.getRecordsByMonth(ym);
    const map = {};

    list.forEach((r) => {
      if (!map[r.date]) {
        map[r.date] = { date: r.date, hours: 0, shifts: [], count: 0 };
      }
      const it = map[r.date];
      it.hours += Number(r.hours) || 0;
      it.count += 1;
      if (it.shifts.indexOf(r.shift) < 0) it.shifts.push(r.shift);
    });

    let totalHours = 0;
    const rows = Object.keys(map)
      .sort()
      .map((d) => {
        const it = map[d];
        totalHours += it.hours;
        return {
          date: d,
          md: time.mdText(d),
          week: time.weekOf(d),
          hours: it.hours,
          units: time.round2(it.hours / 8).toFixed(2),
          count: it.count,
          shiftList: it.shifts.map((s) => ({ name: s, theme: shiftUtil.themeOf(s) })),
        };
      });

    const days = rows.length;
    this.setData({
      ym: ym,
      ymText: time.ymText(ym),
      rows: rows,
      totalHours: totalHours,
      totalUnits: time.round2(totalHours / 8).toFixed(2),
      workDays: days,
      avgHours: days ? (Math.round((totalHours / days) * 10) / 10).toFixed(1) : '0.0',
    });
  },

  /* ---------------- 当天明细 ---------------- */

  onRowTap(e) {
    this.openDaySheet(e.currentTarget.dataset.date);
  },

  openDaySheet(date) {
    const recs = store
      .getRecords()
      .filter((r) => r.date === date)
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    let totalHours = 0;
    const records = recs.map((r) => {
      totalHours += Number(r.hours) || 0;
      return {
        id: r.id,
        shift: r.shift,
        theme: shiftUtil.themeOf(r.shift),
        timeText:
          r.mode === 'time'
            ? r.startTime + ' - ' + r.endTime + (r.crossDay ? '（跨天）' : '')
            : '直接记录 ' + r.hours + ' 小时',
        hours: r.hours,
        units: Number(r.units).toFixed(2),
      };
    });

    const addShifts = shiftUtil.shiftsOf(app.globalData.shiftType).map((name) => ({ name: name }));
    const curShift = app.globalData.shift;
    const addShift = addShifts.some((x) => x.name === curShift) ? curShift : addShifts[0].name;

    this.setData({
      daySheet: {
        visible: true,
        date: date,
        title: time.mdText(date) + ' ' + time.weekOf(date),
        records: records,
        totalHours: totalHours,
        totalUnits: time.round2(totalHours / 8).toFixed(2),
      },
      addShifts: addShifts,
      addShift: addShift,
      addHour: 0,
      addUnits: '0.00',
    });
  },

  closeDaySheet() {
    this.setData({ 'daySheet.visible': false });
  },

  /* ---------------- 补记 ---------------- */

  onPickAddShift(e) {
    this.setData({ addShift: e.currentTarget.dataset.shift });
  },

  onPickAddHour(e) {
    const h = Number(e.currentTarget.dataset.hour);
    this.setData({
      addHour: h,
      addUnits: (Math.round((h / 8) * 100) / 100).toFixed(2),
    });
  },

  onSaveAdd() {
    const { addHour, addShift, daySheet } = this.data;
    if (!addHour) {
      toast(this, '请先选择补记的小时数');
      return;
    }
    const date = daySheet.date;
    store.addRecord({
      date: date,
      endDate: date,
      shiftType: app.globalData.shiftType,
      shift: addShift,
      mode: 'hours',
      startTime: '',
      endTime: '',
      minutes: addHour * 60,
      hours: addHour,
      restMinutes: 0,
      units: time.round2(addHour / 8),
      crossDay: false,
      createdAt: Date.now(),
    });
    this.load(this.data.ym);
    this.openDaySheet(date);
    toast(this, '已补记 ' + time.mdText(date) + ' ' + addHour + ' 小时');
  },

  /* ---------------- 删除单条 ---------------- */

  onDeleteOne(e) {
    this.setData({
      'dialog.visible': true,
      'dialog.title': '删除这条记录？',
      'dialog.content': '删除后无法恢复。',
      'dialog.delId': e.currentTarget.dataset.id,
    });
  },

  onDialogConfirm() {
    const id = this.data.dialog.delId;
    const date = this.data.daySheet.date;
    store.removeRecord(id);
    this.load(this.data.ym);
    if (date) this.openDaySheet(date);
    this.setData({ 'dialog.visible': false, 'dialog.delId': '' });
    toast(this, '已删除');
  },

  onDialogCancel() {
    this.setData({ 'dialog.visible': false, 'dialog.delId': '' });
  },

  /* ---------------- 复制本月工时表 ---------------- */

  onCopyMonth() {
    if (!this.data.rows.length) {
      toast(this, '本月还没有记录');
      return;
    }
    const lines = [];
    lines.push('记工时 · ' + this.data.ymText);
    lines.push('日期\t班次\t出勤小时\t折合工时');
    this.data.rows.forEach((r) => {
      lines.push(
        r.md +
          '\t' +
          r.shiftList.map((s) => s.name).join('/') +
          '\t' +
          r.hours +
          '\t' +
          r.units,
      );
    });
    lines.push('');
    lines.push(
      '合计\t' + this.data.workDays + '天\t' + this.data.totalHours + '\t' + this.data.totalUnits,
    );
    lines.push('（8 小时 = 1 工时，出勤时长不足 1 小时部分已舍去）');

    const text = lines.join('\n');
    wx.setClipboardData({
      data: text,
      success: () => toast(this, '工时表已复制，可粘贴发给班组长'),
      fail: () => toast(this, '复制失败，请重试'),
    });
  },

  /* ---------------- 月份切换 ---------------- */

  shiftMonth(ym, delta) {
    const p = String(ym).split('-');
    const d = new Date(Number(p[0]), Number(p[1]) - 1 + delta, 1);
    return d.getFullYear() + '-' + time.pad2(d.getMonth() + 1);
  },

  onPrevMonth() {
    this.load(this.shiftMonth(this.data.ym, -1));
  },

  onNextMonth() {
    this.load(this.shiftMonth(this.data.ym, 1));
  },

  onMonthChange(e) {
    this.load(e.detail.value);
  },
});
