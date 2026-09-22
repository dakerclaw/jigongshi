/* ------------------------------------------------------------------
 * 出勤轻松记 · 微信小程序
 * 版权所有 © 2026 dakerclaw，保留所有权利。
 * 本文件属专有软件，未经授权不得复制、修改、分发或用于商业用途。
 * 详见项目根目录 LICENSE 文件。
 * ------------------------------------------------------------------ */

const store = require('../../utils/store.js');
const time = require('../../utils/time.js');
const shiftUtil = require('../../utils/shift.js');
const { toast, confirmDialog } = require('../../utils/ui.js');

const app = getApp();

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
    result: { visible: false, title: '', rows: [], note: '' },
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
    confirmDialog({
      title: '取消本次上班打卡？',
      content: '取消后不会生成今天的工时记录。',
      confirmText: '取消打卡',
      cancelText: '再想想',
      onConfirm: () => {
        store.clearPending();
        this.setData({ pending: null });
        toast(this, '已取消本次上班打卡');
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
    // 计酬上限按「上班打卡时所属班制」计算
    const cap = shiftUtil.maxHoursOf(p.shiftType || this.data.shiftType);
    const r = time.calcWork(p.startTs, n.ts, cap);

    if (r.rawHours < 1) {
      confirmDialog({
        title: '出勤不足 1 小时',
        content:
          '本次出勤 ' +
          time.durationText(r.minutes) +
          '，不足 1 小时的部分要舍去，折算为 0 工时。要保存吗？',
        confirmText: '仍然保存',
        cancelText: '不保存',
        onConfirm: () => this.saveTimeRecordNow(),
      });
      return;
    }

    if (r.tooLong) {
      confirmDialog({
        title: '是否忘记打卡？',
        content:
          '本次时长 ' +
          time.durationText(r.minutes) +
          '，已超过 16 小时。若忘记打下班卡，建议先取消本次上班。',
        confirmText: '按此保存',
        cancelText: '取消打卡',
        onConfirm: () => this.saveTimeRecordNow(),
      });
      return;
    }

    this.doSaveTimeRecord(p, n, r);
  },

  doSaveTimeRecord(p, n, r) {
    const shiftType = p.shiftType || this.data.shiftType;
    const rec = {
      date: p.date,
      endDate: n.ymd,
      shiftType: shiftType,
      shift: p.shift,
      mode: 'time',
      startTime: p.startTime,
      endTime: n.hm,
      minutes: r.minutes, // 原始出勤分钟数
      rawHours: r.rawHours, // 原始出勤整小时数
      hours: r.hours, // 计入工时的整小时数（已按班制上限截断）
      cap: r.cap,
      capped: r.capped, // 是否因超出班制上限被封顶
      restMinutes: r.restMinutes,
      units: r.units,
      crossDay: p.date !== n.ymd,
    };
    store.addRecord(rec);
    store.clearPending();
    this.setData({ pending: null, selectedHour: 0, selectedUnits: '0.00' });
    this.refreshToday();

    const label = shiftUtil.labelOf(shiftType);
    const rows = [
      { k: '班　　次', v: p.shift + '（' + label + '）' },
      { k: '上班时间', v: p.startTime },
      { k: '下班时间', v: n.hm + (rec.crossDay ? '（次日）' : '') },
      { k: '出勤时长', v: time.durationText(r.minutes) },
      { k: '计酬工时', v: r.hours + ' 小时' + (r.capped ? '（已封顶）' : '') },
      { k: '折合工时', v: r.units + ' 个' },
    ];
    const note = r.capped
      ? label + '工时上限为 ' + r.cap + ' 小时，本次出勤 ' + time.durationText(r.minutes) + '，超出部分不计入工时。'
      : '';

    this.showResult('记录成功', rows, note);
  },

  /* ---------------- 按工时记录 ---------------- */

  onSelectHour(e) {
    const h = Number(e.currentTarget.dataset.hour);
    this.setData({
      selectedHour: h,
      selectedUnits: time.round2(h / 8).toFixed(2),
    });
  },

  onSaveHours() {
    const h = this.data.selectedHour;
    if (!h) {
      toast(this, '请先选择小时数');
      return;
    }
    const n = time.now();
    const units = time.round2(h / 8);
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
      capped: !!r.capped,
      cappedText: r.capped ? '出勤 ' + time.durationText(r.minutes) + '，已封顶' : '',
      units: Number(r.units).toFixed(2),
    }));

    let sum = 0;
    mapped.forEach((r) => (sum += r.hours));
    this.setData({ todayRecords: mapped, todayHours: sum });
  },

  onDeleteRecord(e) {
    const id = e.currentTarget.dataset.id;
    confirmDialog({
      title: '删除这条记录？',
      content: '删除后无法恢复。',
      confirmText: '删除',
      cancelText: '再想想',
      onConfirm: () => {
        store.removeRecord(id);
        this.refreshToday();
        toast(this, '已删除');
      },
    });
  },

  /* ---------------- 保存（弹窗确认后回调） ---------------- */

  saveTimeRecordNow() {
    const p = store.getPending();
    if (p) {
      const n = time.now();
      // 与 onClockOut 保持一致：按「上班打卡时所属班制」取计酬上限
      const cap = shiftUtil.maxHoursOf(p.shiftType || this.data.shiftType);
      this.doSaveTimeRecord(p, n, time.calcWork(p.startTs, n.ts, cap));
    }
  },

  showResult(title, rows, note) {
    this.setData({
      result: { visible: true, title: title, rows: rows, note: note || '' },
    });
  },

  closeResult() {
    this.setData({ 'result.visible': false });
  },

  onShareAppMessage() {
    return {
      title: '记工时 · 轻松记录每日出勤工时',
      path: '/pages/record/record',
      imageUrl: '/assets/share-cover.jpg',
    };
  },
});
