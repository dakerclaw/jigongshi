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
    // 班制
    shiftType: '12h',
    shift: '白班',
    shiftTheme: 'day',
    shiftTypeLabel: '12小时班制',
    shiftTypes: shiftUtil.SHIFT_TYPES,

    // 记录方式
    mode: 'time',

    // 时钟
    nowTime: '00:00:00',
    nowDate: '',

    // 未完成打卡
    pending: null,
    pendingElapsed: '0分钟',

    // 按工时记录
    hourOptions: shiftUtil.HOUR_OPTIONS,
    selectedHour: 0,
    selectedUnits: '0.00',

    // 今日记录
    todayRecords: [],
    todayHours: 0,

    // 班制选择弹层
    showShiftPicker: false,
    isFirstSet: false,
    pickerType: '12h',
    pickerShifts: [],
    pickerShift: '白班',

    // 结果弹层
    result: { visible: false, title: '', rows: [] },

    // TDesign 确认弹窗
    dialog: {
      visible: false,
      title: '',
      content: '',
      confirmText: '确定',
      cancelText: '取消',
      action: '',
      delId: '',
    },
  },

  timer: null,

  /* ---------------- 生命周期 ---------------- */

  onLoad() {
    this.setData({ pickerShifts: this.buildShifts(app.globalData.shiftType) });
    this.applyShift(app.globalData.shiftType, app.globalData.shift);

    const cfg = store.getConfig();
    if (!cfg || !cfg.shiftType || !cfg.shift) {
      // 首次使用：先选班制
      this.setData({
        showShiftPicker: true,
        isFirstSet: true,
        pickerType: app.globalData.shiftType,
        pickerShift: app.globalData.shift,
      });
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.startClock();
    this.refreshPending();
    this.refreshToday();
  },

  onHide() {
    this.stopClock();
  },

  onUnload() {
    this.stopClock();
  },

  /* ---------------- 时钟 ---------------- */

  startClock() {
    this.stopClock();
    this.updateClock();
    this.timer = setInterval(() => this.updateClock(), 1000);
  },

  stopClock() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  updateClock() {
    const n = time.now();
    const data = { nowTime: n.hms, nowDate: n.ymd.slice(0, 4) + '年' + n.ymd.slice(5, 7) + '月' + n.ymd.slice(8, 10) + '日  ' + n.week };
    const p = this.data.pending;
    if (p && p.startTs) {
      const diff = Math.floor((Date.now() - p.startTs) / 60000);
      data.pendingElapsed = time.durationText(diff > 0 ? diff : 0);
    }
    this.setData(data);
  },

  /* ---------------- 班制 ---------------- */

  buildShifts(type) {
    return shiftUtil.shiftsOf(type).map((name) => ({ name: name, theme: shiftUtil.themeOf(name) }));
  },

  applyShift(type, shift) {
    this.setData({
      shiftType: type,
      shift: shift,
      shiftTheme: shiftUtil.themeOf(shift),
      shiftTypeLabel: shiftUtil.labelOf(type),
    });
  },

  openShiftPicker() {
    this.setData({
      pickerType: this.data.shiftType,
      pickerShifts: this.buildShifts(this.data.shiftType),
      pickerShift: this.data.shift,
      showShiftPicker: true,
    });
  },

  closeShiftPicker() {
    this.setData({ showShiftPicker: false });
  },

  onSheetMask() {
    if (this.data.isFirstSet) {
      toast(this, '请先选择班制和班次');
      return;
    }
    this.closeShiftPicker();
  },

  onPickType(e) {
    const type = e.currentTarget.dataset.type;
    const shifts = this.buildShifts(type);
    this.setData({
      pickerType: type,
      pickerShifts: shifts,
      pickerShift: shifts[0].name,
    });
  },

  onPickShift(e) {
    this.setData({ pickerShift: e.currentTarget.dataset.shift });
  },

  onConfirmShift() {
    const { pickerType, pickerShift } = this.data;
    app.saveDefaultShift(pickerType, pickerShift);
    this.applyShift(pickerType, pickerShift);
    this.setData({ showShiftPicker: false, isFirstSet: false });
    toast(this, '已设为默认：' + shiftUtil.labelOf(pickerType) + ' · ' + pickerShift);
  },

  /* ---------------- 记录方式切换 ---------------- */

  onModeChange(e) {
    this.setData({ mode: e.currentTarget.dataset.mode });
  },

  /* ---------------- 按时间记录 ---------------- */

  refreshPending() {
    const p = store.getPending();
    this.setData({ pending: p });
    this.updateClock();
  },

  onClockIn() {
    const n = time.now();
    const p = {
      date: n.ymd,
      startTime: n.hm,
      startTs: n.ts,
      shiftType: this.data.shiftType,
      shift: this.data.shift,
    };
    store.setPending(p);
    this.setData({ pending: p, pendingElapsed: '0分钟' });
    toast(this, '已记下上班时间 ' + n.hm);
  },

  onCancelClock() {
    this.setData({
      dialog: {
        visible: true,
        title: '取消本次上班打卡？',
        content: '取消后不会生成今天的工时记录。',
        confirmText: '取消打卡',
        cancelText: '再想想',
        action: 'cancelClock',
        delId: '',
      },
    });
  },

  onClockOut() {
    const p = store.getPending();
    if (!p) {
      toast(this, '还没有上班打卡');
      return;
    }
    const n = time.now();
    const r = time.calcWork(p.startTs, n.ts);

    if (r.hours < 1) {
      this.setData({
        dialog: {
          visible: true,
          title: '出勤不足 1 小时',
          content:
            '本次出勤 ' +
            time.durationText(r.minutes) +
            '，不足 1 小时的部分要舍去，折算为 0 工时。要保存吗？',
          confirmText: '仍然保存',
          cancelText: '不保存',
          action: 'saveZero',
          delId: '',
        },
      });
      return;
    }

    if (r.tooLong) {
      this.setData({
        dialog: {
          visible: true,
          title: '是否忘记打卡？',
          content:
            '本次时长 ' +
            time.durationText(r.minutes) +
            '，已超过 16 小时。若忘记打下班卡，建议先取消本次上班。',
          confirmText: '按此保存',
          cancelText: '取消打卡',
          action: 'saveLong',
          delId: '',
        },
      });
      return;
    }

    this.doSaveTimeRecord(p, n, r);
  },

  doSaveTimeRecord(p, n, r) {
    const rec = {
      date: p.date,
      endDate: n.ymd,
      shiftType: p.shiftType,
      shift: p.shift,
      mode: 'time',
      startTime: p.startTime,
      endTime: n.hm,
      minutes: r.minutes,
      hours: r.hours,
      restMinutes: r.restMinutes,
      units: r.units,
      crossDay: p.date !== n.ymd,
    };
    store.addRecord(rec);
    store.clearPending();
    this.setData({ pending: null, selectedHour: 0, selectedUnits: '0.00' });
    this.refreshToday();
    this.showResult('记录成功', [
      { k: '班　　次', v: p.shift + '（' + shiftUtil.labelOf(p.shiftType) + '）' },
      { k: '上班时间', v: p.startTime },
      { k: '下班时间', v: n.hm + (rec.crossDay ? '（次日）' : '') },
      { k: '出勤时长', v: time.durationText(r.minutes) },
      { k: '计酬工时', v: r.hours + ' 小时' },
      { k: '折合工时', v: r.units + ' 个' },
    ]);
  },

  /* ---------------- 按工时记录 ---------------- */

  onSelectHour(e) {
    const h = Number(e.currentTarget.dataset.hour);
    this.setData({
      selectedHour: h,
      selectedUnits: (Math.round((h / 8) * 100) / 100).toFixed(2),
    });
  },

  onSaveHours() {
    const h = this.data.selectedHour;
    if (!h) {
      toast(this, '请先选择小时数');
      return;
    }
    const n = time.now();
    const units = Math.round((h / 8) * 100) / 100;
    store.addRecord({
      date: n.ymd,
      endDate: n.ymd,
      shiftType: this.data.shiftType,
      shift: this.data.shift,
      mode: 'hours',
      startTime: '',
      endTime: '',
      minutes: h * 60,
      hours: h,
      restMinutes: 0,
      units: units,
      crossDay: false,
      createdAt: n.ts,
    });
    this.setData({ selectedHour: 0, selectedUnits: '0.00' });
    this.refreshToday();
    this.showResult('记录成功', [
      { k: '班　　次', v: this.data.shift + '（' + this.data.shiftTypeLabel + '）' },
      { k: '日　　期', v: time.mdText(n.ymd) },
      { k: '出勤时长', v: h + ' 小时' },
      { k: '折合工时', v: units.toFixed(2) + ' 个' },
    ]);
  },

  /* ---------------- 今日记录 ---------------- */

  refreshToday() {
    const today = time.now().ymd;
    const list = store
      .getRecords()
      .filter((r) => r.date === today)
      .sort((a, b) => a.createdAt - b.createdAt);

    const mapped = list.map((r) => ({
      id: r.id,
      shift: r.shift,
      theme: shiftUtil.themeOf(r.shift),
      typeLabel: r.mode === 'hours' ? '工时记录' : '打卡记录',
      timeText:
        r.mode === 'time'
          ? r.startTime + ' - ' + r.endTime + (r.crossDay ? '（跨天）' : '')
          : '',
      hours: r.hours,
      units: Number(r.units).toFixed(2),
    }));

    let sum = 0;
    mapped.forEach((r) => (sum += r.hours));
    this.setData({ todayRecords: mapped, todayHours: sum });
  },

  onDeleteRecord(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      dialog: {
        visible: true,
        title: '删除这条记录？',
        content: '删除后无法恢复。',
        confirmText: '删除',
        cancelText: '再想想',
        action: 'delete',
        delId: id,
      },
    });
  },

  /* ---------------- 弹窗 ---------------- */

  onDialogConfirm() {
    const d = this.data.dialog;
    const close = { 'dialog.visible': false };

    if (d.action === 'delete') {
      store.removeRecord(d.delId);
      this.refreshToday();
      toast(this, '已删除');
    } else if (d.action === 'cancelClock') {
      store.clearPending();
      this.setData({ pending: null });
      toast(this, '已取消本次上班打卡');
    } else if (d.action === 'saveZero' || d.action === 'saveLong') {
      const p = store.getPending();
      if (p) {
        const n = time.now();
        this.doSaveTimeRecord(p, n, time.calcWork(p.startTs, n.ts));
      }
    }
    this.setData(close);
  },

  onDialogCancel() {
    this.setData({ 'dialog.visible': false });
  },

  showResult(title, rows) {
    this.setData({ result: { visible: true, title: title, rows: rows } });
  },

  closeResult() {
    this.setData({ 'result.visible': false });
  },
});
