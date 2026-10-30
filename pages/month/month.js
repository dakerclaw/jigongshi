/* ------------------------------------------------------------------
 * 出勤轻松记 · 微信小程序
 * 版权所有 © 2026 dakerclaw，保留所有权利。
 * 本文件属专有软件，未经授权不得复制、修改、分发或用于商业用途。
 * 详见项目根目录 LICENSE 文件。
 * ------------------------------------------------------------------ */

const store = require('../../utils/store.js');
const time = require('../../utils/time.js');
const shiftUtil = require('../../utils/shift.js');
const stats = require('../../utils/stats.js');
const { toast, confirmDialog, setTabBarHidden, haptic } = require('../../utils/ui.js');

const app = getApp();
const DAY_MS = 24 * 60 * 60 * 1000;

function emptyRecordEdit() {
  return {
    visible: false,
    id: '',
    mode: 'time',
    date: '',
    shiftType: '',
    shifts: [],
    shift: '',
    startTime: '08:00',
    endTime: '17:00',
    hour: 0,
    units: '0.00',
    previewText: '',
    previewUnits: '0.00',
    crossDay: false,
    canSave: false,
  };
}

Page({
  data: {
    ym: '',
    ymText: '',
    currentYm: '',
    canNext: false,
    rows: [],
    totalHours: 0,
    totalUnits: '0.00',
    workDays: 0,
    avgHours: '0.0',

    // 当天明细 / 补记 / 单条编辑
    daySheet: { visible: false, date: '', title: '', records: [], totalHours: 0, totalUnits: '0.00' },
    hourOptions: shiftUtil.HOUR_OPTIONS,
    addShifts: [],
    addShift: '',
    recordEdit: emptyRecordEdit(),
  },

  onLoad() {
    const ym = time.currentYm();
    this.setData({ ym: ym, currentYm: ym });
  },

  onShow() {
    setTabBarHidden(this, !!this.data.daySheet.visible);
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
    setTabBarHidden(this, false);
    this.setData({ 'daySheet.visible': false, 'recordEdit.visible': false });
  },

  /** 载入某月数据（出勤明细展示整月每一天，无记录的天班次显示「无」） */
  load(ym) {
    const currentYm = time.currentYm();
    let month = String(ym || currentYm);
    if (month > currentYm) month = currentYm; // 防御：不再展示未来月份

    const list = store.getRecordsByMonth(month);
    const dayMap = stats.buildDayMap(list);
    const sum = stats.summarize(list);

    const p = month.split('-');
    const daysInMonth = new Date(Number(p[0]), Number(p[1]), 0).getDate();

    // 未到的日期不显示：当月只显示到今天，未来月份整月不显示
    const now = new Date();
    const nowYm = now.getFullYear() + '-' + time.pad2(now.getMonth() + 1);
    let lastDay = daysInMonth;
    if (month === nowYm) {
      lastDay = now.getDate();
    } else if (month > nowYm) {
      lastDay = 0;
    }

    const rows = [];
    for (let d = lastDay; d >= 1; d--) {
      const date = p[0] + '-' + p[1] + '-' + time.pad2(d);
      const it = dayMap[date];
      const base = {
        date: date,
        md: time.mdText(date),
        week: time.weekOf(date),
      };
      if (it) {
        rows.push(
          Object.assign(base, {
            hours: it.hours,
            units: time.hoursToUnits(it.hours).toFixed(2),
            shiftList: it.shifts.map((s) => ({ name: s, theme: shiftUtil.themeOf(s) })),
          }),
        );
      } else {
        rows.push(
          Object.assign(base, {
            hours: 0,
            units: '0.00',
            shiftList: [],
          }),
        );
      }
    }

    this.setData({
      ym: month,
      ymText: time.ymText(month),
      currentYm: currentYm,
      canNext: month < currentYm,
      rows: rows,
      totalHours: sum.totalHours,
      totalUnits: sum.totalUnits.toFixed(2),
      workDays: sum.workDays,
      avgHours: sum.avgHours,
    });
  },

  /* ---------------- 当天明细 ---------------- */

  onRowTap(e) {
    this.openDaySheet(e.currentTarget.dataset.date);
  },

  openDaySheet(date) {
    const recs = store
      .getRecords()
      .filter((r) => r && r.date === date)
      .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));

    let totalHours = 0;
    const records = recs.map((r) => {
      const hours = Number(r.hours) || 0;
      const isCross = !!r.crossDay || (r.endDate && r.endDate !== r.date);
      const isAuto = !!r.autoClockOut;
      totalHours += hours;
      return {
        id: r.id,
        shift: r.shift || '未标注班次',
        theme: shiftUtil.themeOf(r.shift),
        timeText:
          r.mode === 'time'
            ? (r.startTime || '--:--') +
              ' - ' +
              (r.endTime || '--:--') +
              (isCross ? '（跨天）' : '') +
              (isAuto ? '（自动）' : '')
            : '直接记录 ' + hours + ' 小时',
        hours: hours,
        capped: !!r.capped,
        cappedText: r.capped ? '出勤 ' + time.durationText(r.minutes) + '，已按上限计入' : '',
        units: time.hoursToUnits(hours).toFixed(2),
      };
    });

    const addShifts = shiftUtil.shiftsOf(app.globalData.shiftType).map((name) => ({
      name: name,
      theme: shiftUtil.themeOf(name),
    }));
    let addShift = records.length ? records[0].shift : app.globalData.shift;
    if (!shiftUtil.isValidShift(app.globalData.shiftType, addShift)) {
      addShift = addShifts[0].name;
    }

    this.setData({
      daySheet: {
        visible: true,
        date: date,
        title: time.mdText(date) + ' ' + time.weekOf(date),
        records: records,
        totalHours: totalHours,
        totalUnits: time.hoursToUnits(totalHours).toFixed(2),
      },
      addShifts: addShifts,
      addShift: addShift,
      recordEdit: emptyRecordEdit(),
    });
    setTabBarHidden(this, true);
  },

  closeDaySheet() {
    this.setData({ 'daySheet.visible': false, 'recordEdit.visible': false });
    setTabBarHidden(this, false);
  },

  /* ---------------- 补记 ---------------- */

  onPickAddShift(e) {
    this.setData({ addShift: e.currentTarget.dataset.shift });
  },

  onPickAddHour(e) {
    const h = Number(e.currentTarget.dataset.hour);
    if (!h) return;
    const { addShift, daySheet } = this.data;
    const date = daySheet.date;
    confirmDialog({
      title: '补记提醒',
      content: time.mdText(date) + ' · ' + addShift + '\n' + h + ' 小时',
      confirmText: '确认补记',
      cancelText: '取消',
      onConfirm: () => this.saveAdd(date, addShift, h),
    });
  },

  saveAdd(date, addShift, h) {
    const saved = store.addRecord({
      date: date,
      endDate: date,
      shiftType: app.globalData.shiftType,
      shift: addShift,
      mode: 'hours',
      startTime: '',
      endTime: '',
      minutes: h * 60,
      rawHours: h,
      hours: h,
      cap: 0,
      capped: false,
      units: time.hoursToUnits(h),
      crossDay: false,
    });
    if (!saved) {
      toast('补记失败，请检查微信存储空间');
      return;
    }
    this.load(this.data.ym);
    this.openDaySheet(date);
    toast('已补记 ' + time.mdText(date) + ' ' + addShift + ' ' + h + ' 小时');
  },

  /* ---------------- 编辑单条记录 ---------------- */

  onEditRecord(e) {
    const id = e.currentTarget.dataset.id;
    const r = store.getRecordById(id);
    if (!r) {
      toast('记录不存在，可能已被删除');
      return;
    }
    const shiftType = shiftUtil.isValidType(r.shiftType) ? r.shiftType : app.globalData.shiftType;
    const shifts = shiftUtil.shiftsOf(shiftType).map((name) => ({
      name: name,
      theme: shiftUtil.themeOf(name),
    }));
    const shift = shiftUtil.isValidShift(shiftType, r.shift) ? r.shift : shifts[0].name;
    const mode = r.mode === 'time' ? 'time' : 'hours';
    const hour = Number(r.hours) || 0;

    this.setData({
      recordEdit: {
        visible: true,
        id: r.id,
        mode: mode,
        date: r.date,
        shiftType: shiftType,
        shifts: shifts,
        shift: shift,
        startTime: r.startTime || '08:00',
        endTime: r.endTime || '17:00',
        hour: hour,
        units: time.hoursToUnits(hour).toFixed(2),
        previewText: '',
        previewUnits: '0.00',
        crossDay: !!r.crossDay,
        canSave: false,
      },
    });
    this.updateRecordPreview();
  },

  onRecordEditShift(e) {
    this.setData({ 'recordEdit.shift': e.currentTarget.dataset.shift });
  },

  onRecordEditStart(e) {
    this.setData({ 'recordEdit.startTime': e.detail.value });
    this.updateRecordPreview();
  },

  onRecordEditEnd(e) {
    this.setData({ 'recordEdit.endTime': e.detail.value });
    this.updateRecordPreview();
  },

  onRecordEditHour(e) {
    const h = Number(e.currentTarget.dataset.hour);
    this.setData({
      'recordEdit.hour': h,
      'recordEdit.units': time.hoursToUnits(h).toFixed(2),
    });
    this.updateRecordPreview();
  },

  updateRecordPreview() {
    const e = this.data.recordEdit;
    if (!e || !e.visible) return;

    if (e.mode === 'hours') {
      const units = time.hoursToUnits(e.hour);
      this.setData({
        'recordEdit.units': units.toFixed(2),
        'recordEdit.previewUnits': units.toFixed(2),
        'recordEdit.canSave': e.hour > 0,
      });
      return;
    }

    const startTs = time.tsOf(e.date, e.startTime);
    let endTs = time.tsOf(e.date, e.endTime);
    if (endTs === startTs) {
      this.setData({
        'recordEdit.crossDay': false,
        'recordEdit.canSave': false,
        'recordEdit.previewText': '结束时间不能与开始时间相同',
        'recordEdit.previewUnits': '0.00',
      });
      return;
    }

    const cross = endTs < startTs;
    if (cross) endTs += DAY_MS;
    const cap = shiftUtil.maxHoursOf(e.shiftType);
    const r = time.calcWork(startTs, endTs, cap);

    this.setData({
      'recordEdit.crossDay': cross,
      'recordEdit.canSave': r.minutes > 0,
      'recordEdit.previewText':
        time.durationText(r.minutes) + ' → ' + r.hours + ' 小时' + (r.capped ? '（已封顶）' : ''),
      'recordEdit.previewUnits': r.units.toFixed(2),
    });
  },

  onCancelRecordEdit() {
    this.setData({ 'recordEdit.visible': false });
  },

  onSaveRecordEdit() {
    const e = this.data.recordEdit;
    if (!e || !e.visible) return;
    if (!e.canSave) {
      toast('请先选择有效的班次与时间/小时数');
      return;
    }

    const date = this.data.daySheet.date || e.date;
    if (e.mode === 'hours') {
      const h = e.hour;
      this.commitRecordEdit(
        {
          date: e.date,
          endDate: e.date,
          shiftType: e.shiftType,
          shift: e.shift,
          mode: 'hours',
          startTime: '',
          endTime: '',
          minutes: h * 60,
          rawHours: h,
          hours: h,
          cap: 0,
          capped: false,
          units: time.hoursToUnits(h),
          crossDay: false,
          autoClockOut: false,
        },
        date,
      );
      return;
    }

    const startTs = time.tsOf(e.date, e.startTime);
    let endTs = time.tsOf(e.date, e.endTime);
    if (endTs === startTs) {
      toast('结束时间不能与开始时间相同');
      return;
    }
    const cross = endTs < startTs;
    if (cross) endTs += DAY_MS;

    const cap = shiftUtil.maxHoursOf(e.shiftType);
    const r = time.calcWork(startTs, endTs, cap);
    const endInfo = time.toInfo(new Date(endTs));
    const patch = {
      date: e.date,
      endDate: endInfo.ymd,
      shiftType: e.shiftType,
      shift: e.shift,
      mode: 'time',
      startTime: e.startTime,
      endTime: e.endTime,
      minutes: r.minutes,
      rawHours: r.rawHours,
      hours: r.hours,
      cap: r.cap,
      capped: r.capped,
      units: r.units,
      crossDay: cross,
      autoClockOut: false,
    };

    const save = () => this.commitRecordEdit(patch, date);

    if (r.rawHours < 1) {
      confirmDialog({
        title: '出勤不足 1 小时',
        content:
          '本次出勤 ' + time.durationText(r.minutes) + '，不足 1 小时的部分要舍去，折算为 0 工时。要保存吗？',
        confirmText: '仍然保存',
        cancelText: '不保存',
        onConfirm: save,
      });
      return;
    }
    if (r.tooLong) {
      confirmDialog({
        title: '是否忘记打卡？',
        content:
          '本次时长 ' + time.durationText(r.minutes) + '，已超过 16 小时。请确认起止时间是否正确。',
        confirmText: '按此保存',
        cancelText: '返回修改',
        onConfirm: save,
      });
      return;
    }
    save();
  },

  commitRecordEdit(patch, date) {
    if (!store.updateRecord(this.data.recordEdit.id, patch)) {
      toast('保存失败，请检查微信存储空间');
      return;
    }
    haptic();
    this.setData({ 'recordEdit.visible': false });
    this.load(this.data.ym);
    this.openDaySheet(date);
    toast('已保存修改');
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
        if (!store.removeRecord(id)) {
          toast('删除失败，请检查微信存储空间');
          return;
        }
        if (this.data.recordEdit.id === id) {
          this.setData({ 'recordEdit.visible': false });
        }
        this.load(this.data.ym);
        if (date) this.openDaySheet(date);
        toast('已删除');
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
    if (!this.data.canNext) {
      toast('已经是当前月份');
      return;
    }
    this.load(this.shiftMonth(this.data.ym, 1));
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

  onShareAppMessage() {
    return {
      title: '记工时 · 查看月度出勤汇总',
      path: '/pages/month/month',
      imageUrl: '/assets/share-cover.jpg',
    };
  },
});
