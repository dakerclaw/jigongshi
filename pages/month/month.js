const store = require('../../utils/store.js');
const time = require('../../utils/time.js');
const shiftUtil = require('../../utils/shift.js');
const { toast, confirmDialog } = require('../../utils/ui.js');

const app = getApp();

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
    editShifts: [],
    editShift: '白班',
    editHour: 0,
    editUnits: '0.00',
    editMode: 'add', // 'add': 这天还没有记录走补记；'edit': 已有记录走修改
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

  /** 载入某月数据（出勤明细展示整月每一天，无记录的天班次显示「无」） */
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

    const p = String(ym).split('-');
    const daysInMonth = new Date(Number(p[0]), Number(p[1]), 0).getDate();

    // 未到的日期不显示：当月只显示到今天，未来月份整月不显示
    const now = new Date();
    const nowYm = now.getFullYear() + '-' + time.pad2(now.getMonth() + 1);
    let lastDay = daysInMonth;
    if (String(ym) === nowYm) {
      lastDay = now.getDate();
    } else if (String(ym) > nowYm) {
      lastDay = 0;
    }

    let totalHours = 0;
    let workDays = 0;
    const rows = [];

    for (let d = lastDay; d >= 1; d--) {
      const date = p[0] + '-' + p[1] + '-' + time.pad2(d);
      const it = map[date];
      const base = {
        date: date,
        md: time.mdText(date),
        week: time.weekOf(date),
      };
      if (it) {
        totalHours += it.hours;
        workDays += 1;
        rows.push(
          Object.assign(base, {
            hours: it.hours,
            units: time.round2(it.hours / 8).toFixed(2),
            count: it.count,
            shiftList: it.shifts.map((s) => ({ name: s, theme: shiftUtil.themeOf(s) })),
          }),
        );
      } else {
        rows.push(
          Object.assign(base, {
            hours: 0,
            units: '0.00',
            count: 0,
            shiftList: [],
          }),
        );
      }
    }

    this.setData({
      ym: ym,
      ymText: time.ymText(ym),
      rows: rows,
      totalHours: totalHours,
      totalUnits: time.round2(totalHours / 8).toFixed(2),
      workDays: workDays,
      avgHours: workDays ? (Math.round((totalHours / workDays) * 10) / 10).toFixed(1) : '0.0',
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
        capped: !!r.capped,
        cappedText: r.capped ? '出勤 ' + time.durationText(r.minutes) + '，已按上限计入' : '',
        units: Number(r.units).toFixed(2),
      };
    });

    const editShifts = shiftUtil.shiftsOf(app.globalData.shiftType).map((name) => ({ name: name }));

    // 修改模式：预填已有记录的班次与合计工时；无记录则走补记
    const hasRecs = records.length > 0;
    let prefillShift = hasRecs ? records[0].shift : app.globalData.shift;
    if (!editShifts.some((x) => x.name === prefillShift)) prefillShift = editShifts[0].name;
    const prefillHour = hasRecs ? Math.round(records.reduce((s, r) => s + Number(r.hours), 0)) : 0;

    this.setData({
      daySheet: {
        visible: true,
        date: date,
        title: time.mdText(date) + ' ' + time.weekOf(date),
        records: records,
        totalHours: totalHours,
        totalUnits: time.round2(totalHours / 8).toFixed(2),
      },
      editShifts: editShifts,
      editShift: prefillShift,
      editHour: prefillHour,
      editUnits: time.round2(prefillHour / 8).toFixed(2),
      editMode: hasRecs ? 'edit' : 'add',
    });
  },

  closeDaySheet() {
    this.setData({ 'daySheet.visible': false });
  },

  /* ---------------- 修改 / 补记 ---------------- */

  onPickEditShift(e) {
    this.setData({ editShift: e.currentTarget.dataset.shift });
  },

  onPickEditHour(e) {
    const h = Number(e.currentTarget.dataset.hour);
    this.setData({
      editHour: h,
      editUnits: time.round2(h / 8).toFixed(2),
    });
  },

  onSaveEdit() {
    const { editHour, editShift, daySheet, editMode } = this.data;
    if (!editHour) {
      toast(this, editMode === 'edit' ? '请先选择修改后的小时数' : '请先选择补记的小时数');
      return;
    }
    const date = daySheet.date;

    if (editMode === 'edit') {
      // 修改模式：先删除当天全部原有记录，仅保留修改后的单条记录
      store.getRecords().filter((r) => r.date === date).forEach((r) => store.removeRecord(r.id));
    }

    store.addRecord({
      date: date,
      endDate: date,
      shiftType: app.globalData.shiftType,
      shift: editShift,
      mode: 'hours',
      startTime: '',
      endTime: '',
      minutes: editHour * 60,
      hours: editHour,
      restMinutes: 0,
      units: time.round2(editHour / 8),
      crossDay: false,
    });

    this.load(this.data.ym);
    this.openDaySheet(date);
    toast(
      this,
      (editMode === 'edit' ? '已修改 ' : '已补记 ') + time.mdText(date) + ' ' + editShift + ' ' + editHour + ' 小时',
    );
  },

  /* ---------------- 删除单条 ---------------- */

  onDeleteOne(e) {
    const id = e.currentTarget.dataset.id;
    const date = this.data.daySheet.date;
    confirmDialog({
      title: '删除这条记录？',
      content: '删除后无法恢复。',
      confirmText: '删除',
      cancelText: '再想想',
      onConfirm: () => {
        store.removeRecord(id);
        this.load(this.data.ym);
        if (date) this.openDaySheet(date);
        toast(this, '已删除');
      },
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

  onShareAppMessage() {
    return {
      title: '记工时 · 查看月度出勤汇总',
      path: '/pages/month/month',
      imageUrl: '/assets/share-cover.jpg',
    };
  },
});
