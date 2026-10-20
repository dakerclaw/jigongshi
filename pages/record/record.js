/* ------------------------------------------------------------------
 * 出勤轻松记 · 微信小程序
 * 版权所有 © 2026 dakerclaw，保留所有权利。
 * 本文件属专有软件，未经授权不得复制、修改、分发或用于商业用途。
 * 详见项目根目录 LICENSE 文件。
 * ------------------------------------------------------------------ */

const store = require('../../utils/store.js');
const time = require('../../utils/time.js');
const shiftUtil = require('../../utils/shift.js');
const { toast, confirmDialog, setTabBarHidden, haptic } = require('../../utils/ui.js');

const app = getApp();
const UNDO_MS = 8000;

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
    nowYmd: '',

    // 未完成打卡
    pending: null,
    pendingElapsed: '0分钟',
    pendingAlert: false,
    pendingShiftTypeLabel: '',

    // 按工时记录
    hourOptions: shiftUtil.HOUR_OPTIONS,
    selectedHour: 0,
    selectedUnits: '0.00',

    // 今日记录
    todayRecords: [],
    todayHours: 0,
    todayHasCross: false,
    undoRecord: null,

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
  undoTimer: null,

  /* ---------------- 生命周期 ---------------- */

  onLoad() {
    const type = shiftUtil.isValidType(app.globalData.shiftType)
      ? app.globalData.shiftType
      : shiftUtil.DEFAULT_TYPE;
    const shift = shiftUtil.isValidShift(type, app.globalData.shift)
      ? app.globalData.shift
      : shiftUtil.shiftsOf(type)[0];

    this.setData({ pickerShifts: this.buildShifts(type) });
    this.applyShift(type, shift);

    const cfg = store.getConfig();
    if (!cfg || !shiftUtil.isValidType(cfg.shiftType) || !shiftUtil.isValidShift(cfg.shiftType, cfg.shift)) {
      // 首次使用：先选班制（此时隐藏 tabBar，避免绕过首次设置）
      this.setData({
        showShiftPicker: true,
        isFirstSet: true,
        pickerType: type,
        pickerShift: shift,
      });
      setTabBarHidden(this, true);
    }
  },

  onShow() {
    // 弹层/首次设置打开时保持 tabBar 隐藏，避免从后台返回后误触
    setTabBarHidden(this, !!(this.data.showShiftPicker || this.data.result.visible));
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.startClock();
    this.refreshPending();
    this.refreshToday();
  },

  onHide() {
    this.stopClock();
    this.clearUndoTimer();
    this.setData({ undoRecord: null });
    setTabBarHidden(this, false);
  },

  onUnload() {
    this.stopClock();
    this.clearUndoTimer();
    setTabBarHidden(this, false);
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
    const prevYmd = this.data.nowYmd;
    const data = {
      nowTime: n.hms,
      nowYmd: n.ymd,
      nowDate:
        n.ymd.slice(0, 4) + '年' + n.ymd.slice(5, 7) + '月' + n.ymd.slice(8, 10) + '日  ' + n.week,
    };

    // 页面跨零点保持在前台时，自动刷新「今日记录」
    if (prevYmd && prevYmd !== n.ymd) {
      this.refreshToday(n.ymd);
    }

    const p = this.data.pending;
    if (p && p.startTs) {
      const diff = Math.floor((Date.now() - p.startTs) / 60000);
      data.pendingElapsed = time.durationText(diff > 0 ? diff : 0);
      data.pendingAlert = diff > 16 * 60;
    } else {
      data.pendingElapsed = '0分钟';
      data.pendingAlert = false;
    }
    this.setData(data);
  },

  /* ---------------- 班制 ---------------- */

  buildShifts(type) {
    return shiftUtil.shiftsOf(type).map((name) => ({ name: name, theme: shiftUtil.themeOf(name) }));
  },

  applyShift(type, shift) {
    const validType = shiftUtil.isValidType(type) ? type : shiftUtil.DEFAULT_TYPE;
    const validShift = shiftUtil.isValidShift(validType, shift)
      ? shift
      : shiftUtil.shiftsOf(validType)[0];
    this.setData({
      shiftType: validType,
      shift: validShift,
      shiftTheme: shiftUtil.themeOf(validShift),
      shiftTypeLabel: shiftUtil.labelOf(validType),
    });
  },

  openShiftPicker() {
    this.setData({
      pickerType: this.data.shiftType,
      pickerShifts: this.buildShifts(this.data.shiftType),
      pickerShift: this.data.shift,
      showShiftPicker: true,
    });
    setTabBarHidden(this, true);
  },

  closeShiftPicker() {
    this.setData({ showShiftPicker: false });
    setTabBarHidden(this, false);
  },

  onSheetMask() {
    if (this.data.isFirstSet) {
      toast('请先选择班制和班次');
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
    if (!shiftUtil.isValidShift(pickerType, pickerShift)) {
      toast('班制与班次不匹配，请重新选择');
      return;
    }
    const saved = app.saveDefaultShift(pickerType, pickerShift);
    this.applyShift(pickerType, pickerShift);
    this.setData({ showShiftPicker: false, isFirstSet: false });
    setTabBarHidden(this, false);
    toast(
      saved
        ? '已设为默认：' + shiftUtil.labelOf(pickerType) + ' · ' + pickerShift
        : '已应用，但默认班制保存失败',
    );
  },

  /* ---------------- 记录方式切换 ---------------- */

  onModeChange(e) {
    this.setData({ mode: e.currentTarget.dataset.mode });
  },

  /* ---------------- 按时间记录 ---------------- */

  refreshPending() {
    const p = store.getPending();
    this.setData({
      pending: p,
      pendingShiftTypeLabel: p ? shiftUtil.labelOf(p.shiftType || this.data.shiftType) || '未知班制' : '',
    });
    this.updateClock();
  },

  onClockIn() {
    if (store.getPending()) {
      toast('已经上班打卡，请先下班打卡');
      this.refreshPending();
      return;
    }
    const n = time.now();
    const p = {
      date: n.ymd,
      startTime: n.hm,
      startTs: n.ts,
      shiftType: this.data.shiftType,
      shift: this.data.shift,
    };
    if (!store.setPending(p)) {
      toast('上班打卡保存失败，请检查微信存储空间');
      return;
    }
    haptic();
    this.setData({
      pending: p,
      pendingElapsed: '0分钟',
      pendingAlert: false,
      pendingShiftTypeLabel: shiftUtil.labelOf(this.data.shiftType),
    });
    toast('已记下上班时间 ' + n.hm);
  },

  onCancelClock() {
    confirmDialog({
      title: '取消本次上班打卡？',
      content: '取消后不会生成今天的工时记录。',
      confirmText: '取消打卡',
      cancelText: '再想想',
      onConfirm: () => {
        if (!store.clearPending()) {
          toast('取消失败，请检查微信存储空间');
          return;
        }
        this.setData({ pending: null, pendingElapsed: '0分钟', pendingAlert: false, pendingShiftTypeLabel: '' });
        toast('已取消本次上班打卡');
      },
    });
  },

  onClockOut() {
    const p = store.getPending();
    if (!p) {
      toast('还没有上班打卡');
      return;
    }
    const n = time.now();
    // 计酬上限按「上班打卡时所属班制」计算
    const cap = shiftUtil.maxHoursOf(p.shiftType || this.data.shiftType);
    const r = time.calcWork(p.startTs, n.ts, cap);

    // 关键：保存时使用点击「下班打卡」这一刻的快照，避免确认弹窗停留跨过整点后结果变化
    const save = () => this.doSaveTimeRecord(p, n, r);

    if (r.rawHours < 1) {
      confirmDialog({
        title: '出勤不足 1 小时',
        content:
          '本次出勤 ' +
          time.durationText(r.minutes) +
          '，不足 1 小时的部分要舍去，折算为 0 工时。要保存吗？',
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
          '本次时长 ' +
          time.durationText(r.minutes) +
          '，已超过 16 小时。若忘记打下班卡，建议先取消本次上班。',
        confirmText: '按此保存',
        cancelText: '返回',
        onConfirm: save,
      });
      return;
    }

    save();
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
      units: r.units,
      crossDay: p.date !== n.ymd,
    };

    const saved = store.addRecord(rec);
    if (!saved) {
      toast('保存失败：本次记录未写入，请检查微信存储空间');
      this.refreshPending();
      return;
    }

    const cleared = store.clearPending();
    haptic();
    this.setData({ selectedHour: 0, selectedUnits: '0.00' });
    if (cleared) {
      this.setData({
        pending: null,
        pendingElapsed: '0分钟',
        pendingAlert: false,
        pendingShiftTypeLabel: '',
      });
    } else {
      toast('记录已保存，但打卡状态清理失败，请勿重复下班打卡');
    }

    this.refreshToday(n.ymd);
    if (!cleared) this.refreshPending();

    const label = shiftUtil.labelOf(shiftType) || '未知班制';
    const rows = [
      { k: '班　　次', v: (p.shift || '未标注班次') + '（' + label + '）' },
      { k: '上班时间', v: p.startTime || '--:--' },
      { k: '下班时间', v: n.hm + (rec.crossDay ? '（次日）' : '') },
      { k: '出勤时长', v: time.durationText(r.minutes) },
      { k: '计酬工时', v: r.hours + ' 小时' + (r.capped ? '（已封顶）' : '') },
      { k: '折合工时', v: r.units.toFixed(2) + ' 个' },
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
      selectedUnits: time.hoursToUnits(h).toFixed(2),
    });
  },

  onSaveHours() {
    const h = this.data.selectedHour;
    if (!h) {
      toast('请先选择小时数');
      return;
    }
    const n = time.now();
    const units = time.hoursToUnits(h);
    const saved = store.addRecord({
      date: n.ymd,
      endDate: n.ymd,
      shiftType: this.data.shiftType,
      shift: this.data.shift,
      mode: 'hours',
      startTime: '',
      endTime: '',
      minutes: h * 60,
      rawHours: h,
      hours: h,
      cap: 0,
      capped: false,
      units: units,
      crossDay: false,
    });
    if (!saved) {
      toast('保存失败：本次记录未写入，请检查微信存储空间');
      return;
    }
    haptic();
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

  refreshToday(today) {
    const day = today || time.now().ymd;
    const all = store.getRecords();
    // 今日 + 昨天上班、今天下班的跨天记录（endDate 已能表达跨天，兼容旧数据）
    const list = all
      .filter((r) => r && (r.date === day || (r.endDate === day && r.date !== day)))
      .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));

    let sum = 0;
    const mapped = list.map((r) => {
      const hours = Number(r.hours) || 0;
      const isCross = !!r.crossDay || (r.endDate && r.endDate !== r.date);
      sum += hours;
      return {
        id: r.id,
        shift: r.shift || '未标注班次',
        theme: shiftUtil.themeOf(r.shift),
        typeLabel: r.mode === 'hours' ? '工时记录' : '打卡记录',
        timeText:
          r.mode === 'time'
            ? (r.startTime || '--:--') + ' - ' + (r.endTime || '--:--') + (isCross ? '（跨天）' : '')
            : '',
        dateLabel: r.date !== day ? time.mdText(r.date) : '',
        hours: hours,
        capped: !!r.capped,
        units: time.hoursToUnits(hours).toFixed(2),
      };
    });

    this.setData({
      todayRecords: mapped,
      todayHours: sum,
      todayHasCross: list.some((r) => r.date !== day),
    });
  },

  onDeleteRecord(e) {
    const id = e.currentTarget.dataset.id;
    confirmDialog({
      title: '删除这条记录？',
      content: '删除后 8 秒内可点「撤销」恢复；超过时间将无法恢复。',
      confirmText: '删除',
      cancelText: '再想想',
      onConfirm: () => {
        const rec = store.getRecordById(id);
        if (!store.removeRecord(id)) {
          toast('删除失败，请检查微信存储空间');
          return;
        }
        this.setData({ undoRecord: rec });
        this.startUndoTimer();
        this.refreshToday();
        toast('已删除');
      },
    });
  },

  startUndoTimer() {
    this.clearUndoTimer();
    this.undoTimer = setTimeout(() => {
      this.setData({ undoRecord: null });
      this.undoTimer = null;
    }, UNDO_MS);
  },

  clearUndoTimer() {
    if (this.undoTimer) {
      clearTimeout(this.undoTimer);
      this.undoTimer = null;
    }
  },

  onUndoDelete() {
    const rec = this.data.undoRecord;
    if (!rec) return;
    if (!store.restoreRecord(rec)) {
      toast('撤销失败，请检查存储空间');
      return;
    }
    this.clearUndoTimer();
    this.setData({ undoRecord: null });
    this.refreshToday();
    toast('已撤销删除');
  },

  /* ---------------- 结果弹层 ---------------- */

  showResult(title, rows, note) {
    this.setData({
      result: { visible: true, title: title, rows: rows, note: note || '' },
    });
    setTabBarHidden(this, true);
  },

  closeResult() {
    this.setData({ 'result.visible': false });
    setTabBarHidden(this, false);
  },

  /* ---------------- 关于 / 分享 ---------------- */

  onOpenAbout() {
    wx.navigateTo({ url: '/pages/about/about' });
  },

  onShareAppMessage() {
    return {
      title: '记工时 · 轻松记录每日出勤工时',
      path: '/pages/record/record',
      imageUrl: '/assets/share-cover.jpg',
    };
  },
});
