/* ------------------------------------------------------------------
 * 出勤轻松记 · 微信小程序
 * 版权所有 © 2026 dakerclaw，保留所有权利。
 * 本文件属专有软件，未经授权不得复制、修改、分发或用于商业用途。
 * 详见项目根目录 LICENSE 文件。
 * ------------------------------------------------------------------ */

/**
 * 核心逻辑回归测试（无需微信开发者工具）
 * 运行：node tools/test-core.js
 */

const assert = require('assert');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RealDate = Date;
const storage = {};
const toasts = [];
const modals = [];
let clipboard = '';
let failSet = false;
let vibrations = 0;

function setNow(iso) {
  const fixed = new RealDate(iso);
  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(fixed.getTime());
      else super(...args);
    }
    static now() {
      return fixed.getTime();
    }
  }
  global.Date = FakeDate;
}

function resetStorage() {
  Object.keys(storage).forEach((k) => delete storage[k]);
  failSet = false;
}

global.wx = {
  getStorageSync(key) {
    return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : '';
  },
  setStorageSync(key, value) {
    if (failSet) throw new Error('storage full');
    storage[key] = value;
  },
  showToast(o) {
    toasts.push(o.title);
  },
  showModal(o) {
    modals.push(o);
  },
  stopPullDownRefresh() {},
  setClipboardData(o) {
    clipboard = o.data;
    if (o.success) o.success();
  },
  getClipboardData(o) {
    o.success({ data: clipboard });
  },
  vibrateShort() {
    vibrations += 1;
  },
  navigateTo() {},
};

const store = require(path.join(ROOT, 'utils/store.js'));
const time = require(path.join(ROOT, 'utils/time.js'));
const shiftUtil = require(path.join(ROOT, 'utils/shift.js'));
const stats = require(path.join(ROOT, 'utils/stats.js'));

const app = {
  globalData: { version: '1.1.9', shiftType: '12h', shift: '白班' },
  saveDefaultShift(type, shift) {
    this.globalData.shiftType = type;
    this.globalData.shift = shift;
    return store.saveConfig({ shiftType: type, shift: shift });
  },
  reloadConfig() {
    const cfg = store.getConfig();
    if (cfg && shiftUtil.isValidType(cfg.shiftType) && shiftUtil.isValidShift(cfg.shiftType, cfg.shift)) {
      this.globalData.shiftType = cfg.shiftType;
      this.globalData.shift = cfg.shift;
    }
  },
};

global.getApp = () => app;

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function setByPath(obj, key, value) {
  const parts = key.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]]) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function makePage(rel) {
  let def = null;
  global.Page = (d) => {
    def = d;
  };
  const full = path.join(ROOT, rel);
  delete require.cache[require.resolve(full)];
  require(full);
  const inst = Object.assign({}, def);
  inst.data = clone(def.data);
  inst.setData = function (patch) {
    Object.keys(patch).forEach((k) => setByPath(this.data, k, patch[k]));
  };
  inst._bar = { data: {}, setData(patch) { Object.assign(this.data, patch); } };
  inst.getTabBar = () => inst._bar;
  return inst;
}

function seedConfig(type, shift) {
  store.saveConfig({ shiftType: type || '12h', shift: shift || '白班' });
  app.globalData.shiftType = type || '12h';
  app.globalData.shift = shift || '白班';
}

function addRecord(patch) {
  const rec = Object.assign(
    {
      date: '2026-10-20',
      endDate: '2026-10-20',
      shiftType: '12h',
      shift: '白班',
      mode: 'hours',
      startTime: '',
      endTime: '',
      minutes: 480,
      rawHours: 8,
      hours: 8,
      cap: 0,
      capped: false,
      units: 1,
      crossDay: false,
    },
    patch,
  );
  const saved = store.addRecord(rec);
  assert(saved, 'addRecord should succeed');
  return saved;
}

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name: name, ok: true });
    console.log('PASS', name);
  } catch (e) {
    results.push({ name: name, ok: false, error: e });
    console.log('FAIL', name, '-', e.message);
  }
}

/* ---------------- 工时规则 ---------------- */

test('40 分钟折算 0 小时', () => {
  const start = new RealDate('2026-10-20T08:00:00').getTime();
  const end = start + 40 * 60 * 1000;
  const r = time.calcWork(start, end, 12);
  assert.strictEqual(r.minutes, 40);
  assert.strictEqual(r.hours, 0);
  assert.strictEqual(r.units, 0);
});

test('7 小时 20 分折算 7 小时 / 0.88 工时', () => {
  const start = new RealDate('2026-10-20T08:00:00').getTime();
  const r = time.calcWork(start, start + (7 * 60 + 20) * 60 * 1000, 12);
  assert.strictEqual(r.hours, 7);
  assert.strictEqual(r.units, 0.88);
});

test('8 小时班制：8h30 / 11h 均封顶 8 小时', () => {
  const start = new RealDate('2026-10-20T08:00:00').getTime();
  assert.strictEqual(time.calcWork(start, start + 8.5 * 3600000, 8).hours, 8);
  assert.strictEqual(time.calcWork(start, start + 11 * 3600000, 8).hours, 8);
});

test('12 小时班制：12h01 / 14h20 均封顶 12 小时', () => {
  const start = new RealDate('2026-10-20T08:00:00').getTime();
  const r1 = time.calcWork(start, start + (12 * 60 + 1) * 60 * 1000, 12);
  const r2 = time.calcWork(start, start + (14 * 60 + 20) * 60 * 1000, 12);
  assert.strictEqual(r1.hours, 12);
  assert.strictEqual(r2.hours, 12);
  assert.strictEqual(r1.capped, false); // 12h01 取整后正好 12 小时，没有可封顶的部分
  assert.strictEqual(r2.capped, true);
});

test('负数 / 同时间折算 0', () => {
  const start = new RealDate('2026-10-20T08:00:00').getTime();
  assert.strictEqual(time.calcWork(start, start - 1000, 12).hours, 0);
  assert.strictEqual(time.calcWork(start, start, 12).hours, 0);
});

test('超过 16 小时按真实毫秒判断', () => {
  const start = 0;
  assert.strictEqual(time.calcWork(start, 16 * 3600000, 12).tooLong, false);
  assert.strictEqual(time.calcWork(start, 16 * 3600000 + 1000, 12).tooLong, true);
});

test('未知班制按 8 小时保守封顶', () => {
  assert.strictEqual(shiftUtil.maxHoursOf('unknown'), 8);
  const start = new RealDate('2026-10-20T08:00:00').getTime();
  assert.strictEqual(time.calcWork(start, start + 12 * 3600000, shiftUtil.maxHoursOf('unknown')).hours, 8);
});

/* ---------------- 存储层 ---------------- */

test('存储失败时 addRecord 返回 null，不假装成功', () => {
  resetStorage();
  seedConfig();
  failSet = true;
  assert.strictEqual(store.addRecord({ date: '2026-10-20', hours: 8 }), null);
});

test('存储失败时 pending 写入返回 false', () => {
  resetStorage();
  failSet = true;
  assert.strictEqual(store.setPending({ date: '2026-10-20', startTs: 1 }), false);
});

test('删除后可撤销恢复原记录', () => {
  resetStorage();
  seedConfig();
  const r = addRecord({});
  assert(store.removeRecord(r.id));
  assert.strictEqual(store.getRecords().length, 0);
  assert(store.restoreRecord(r));
  assert.strictEqual(store.getRecords().length, 1);
  assert.strictEqual(store.getRecords()[0].id, r.id);
});

test('updateRecord 失败返回 null 且不写入', () => {
  resetStorage();
  seedConfig();
  const r = addRecord({});
  failSet = true;
  assert.strictEqual(store.updateRecord(r.id, { hours: 3 }), null);
  failSet = false;
  assert.strictEqual(store.getRecordById(r.id).hours, 8);
});

test('备份导出 / 导入 / 清空', () => {
  resetStorage();
  seedConfig('8h', '中班');
  addRecord({ hours: 4 });
  store.setPending({ date: '2026-10-20', startTs: 1 });
  const backup = store.exportData();
  assert.strictEqual(backup.app, 'jigongshi');
  assert.strictEqual(backup.records.length, 1);
  assert(store.clearAllRecords());
  assert.strictEqual(store.getRecords().length, 0);
  assert.strictEqual(store.getPending(), null);
  assert(store.importData(backup));
  assert.strictEqual(store.getRecords().length, 1);
  assert.strictEqual(store.getConfig().shift, '中班');
  assert(store.getPending());
});

test('开发版使用独立 storage，写入/清空不影响正式版', () => {
  resetStorage();
  storage.JG_RECORDS = [{ id: 'legacy', date: '2026-10-20', hours: 8, minutes: 480, units: 1 }];
  storage.JG_CONFIG = { shiftType: '8h', shift: '白班' };
  wx.getAccountInfoSync = () => ({ miniProgram: { envVersion: 'develop' } });

  const storePath = require.resolve(path.join(ROOT, 'utils/store.js'));
  delete require.cache[storePath];
  try {
    const devStore = require(storePath);
    assert.strictEqual(devStore.getStorageEnv().label, '开发版');
    assert.strictEqual(devStore.getStorageEnv().isolated, true);
    // 首次进入开发版时复制正式版快照
    assert.strictEqual(devStore.getRecords().length, 1);
    assert.strictEqual(devStore.getConfig().shift, '白班');

    assert(devStore.addRecord({ date: '2026-10-21', hours: 2, minutes: 120, units: 0.25 }));
    assert(devStore.setPending({ date: '2026-10-21', startTs: 1 }));
    assert.strictEqual(storage.JG_DEV_RECORDS.length, 2);
    assert.strictEqual(storage.JG_RECORDS.length, 1);
    assert(storage.JG_DEV_PENDING);
    assert.strictEqual(storage.JG_PENDING, undefined);

    // 开发版清空只影响自己的 key
    assert(devStore.clearAllRecords());
    assert.strictEqual(devStore.getRecords().length, 0);
    assert.strictEqual(storage.JG_RECORDS.length, 1);
  } finally {
    delete wx.getAccountInfoSync;
    delete require.cache[storePath];
    require(storePath);
  }
});

/* ---------------- 统计口径 ---------------- */

test('统计：月合计按每日折算后保留两位小数再相加', () => {
  const list = [
    { date: '2026-10-01', hours: 1, minutes: 60, shift: '白班' },
    { date: '2026-10-02', hours: 1, minutes: 60, shift: '白班' },
  ];
  const sum = stats.summarize(list);
  assert.strictEqual(sum.totalHours, 2);
  assert.strictEqual(sum.workDays, 2);
  // 1h/8=0.125 -> 0.13；0.13+0.13=0.26，而不是 2h/8=0.25
  assert.strictEqual(sum.totalUnits, 0.26);

  // 历史页月度条形图与班次分布也必须使用同一口径
  const ms = stats.monthStats(list, 24);
  assert.strictEqual(ms[0].units, '0.26');
  const ss = stats.shiftStats(list);
  assert.strictEqual(ss[0].units, '0.26');
});

test('班次分布：0 工时不再画出最小柱', () => {
  const list = [
    { date: '2026-10-01', hours: 0, shift: '白班' },
    { date: '2026-10-02', hours: 0, shift: '夜班' },
  ];
  const s = stats.shiftStats(list);
  assert.strictEqual(s.length, 2);
  assert.strictEqual(s[0].pct, 0);
  assert.strictEqual(s[1].pct, 0);
});

test('近 24 个月统计按月份倒序且最多 24 条', () => {
  const list = [];
  for (let i = 0; i < 25; i++) {
    const y = 2024 + Math.floor(i / 12);
    const m = (i % 12) + 1;
    list.push({ date: y + '-' + String(m).padStart(2, '0') + '-01', hours: 8, shift: '白班' });
  }
  const ms = stats.monthStats(list, 24);
  assert.strictEqual(ms.length, 24);
  assert.strictEqual(ms[0].ym > ms[1].ym, true);
});

/* ---------------- 首页：快照 / 跨天 / 存储失败 ---------------- */

test('下班确认弹窗停留跨整点，保存仍使用点击时快照', () => {
  resetStorage();
  seedConfig('12h', '白班');
  setNow('2026-10-20T16:00:00');

  const page = makePage('pages/record/record.js');
  page.onLoad();
  store.setPending({
    date: '2026-10-20',
    startTime: '16:00',
    startTs: new RealDate('2026-10-20T16:00:00').getTime(),
    shiftType: '12h',
    shift: '白班',
  });
  page.refreshPending();
  setNow('2026-10-20T16:59:50');
  page.updateClock();

  modals.length = 0;
  page.onClockOut();
  assert.strictEqual(modals.length, 1);
  assert.strictEqual(modals[0].title, '出勤不足 1 小时');

  // 用户停留到 17:00:10 才点确认
  setNow('2026-10-20T17:00:10');
  modals[0].success({ confirm: true });

  const recs = store.getRecords();
  assert.strictEqual(recs.length, 1);
  assert.strictEqual(recs[0].hours, 0, '应按点击时快照保存 0 小时，而不是 1 小时');
  assert.strictEqual(recs[0].minutes, 59);
  assert.strictEqual(store.getPending(), null);
  page.onHide();
});

test('跨天记录在次日仍显示在今日记录', () => {
  resetStorage();
  seedConfig();
  setNow('2026-10-20T09:00:00');
  addRecord({
    date: '2026-10-19',
    endDate: '2026-10-20',
    crossDay: true,
    mode: 'time',
    startTime: '23:00',
    endTime: '08:00',
    hours: 8,
    minutes: 540,
    rawHours: 9,
    cap: 8,
    capped: true,
  });
  const page = makePage('pages/record/record.js');
  page.onLoad();
  page.onShow();
  assert.strictEqual(page.data.todayRecords.length, 1);
  assert.strictEqual(page.data.todayRecords[0].dateLabel, '10月19日');
  assert.strictEqual(page.data.todayHasCross, true);
  page.onHide();
});

test('旧跨天记录（endDate 跨天但 crossDay=false）仍显示在今日', () => {
  resetStorage();
  seedConfig();
  setNow('2026-10-20T09:00:00');
  addRecord({
    date: '2026-10-19',
    endDate: '2026-10-20',
    crossDay: false,
    mode: 'time',
    startTime: '23:00',
    endTime: '08:00',
    hours: 8,
    minutes: 540,
  });
  const page = makePage('pages/record/record.js');
  page.onLoad();
  page.onShow();
  assert.strictEqual(page.data.todayRecords.length, 1);
  assert(page.data.todayRecords[0].timeText.indexOf('跨天') >= 0);
  assert.strictEqual(page.data.todayHasCross, true);
  page.onHide();
});

test('8 小时班制超过 10 小时自动下班，下班记 10 小时、计酬 8 小时', () => {
  resetStorage();
  seedConfig('8h', '白班');
  setNow('2026-10-20T08:00:00');
  const page = makePage('pages/record/record.js');
  page.onLoad();
  store.setPending({
    date: '2026-10-20',
    startTime: '08:00',
    startTs: new RealDate('2026-10-20T08:00:00').getTime(),
    shiftType: '8h',
    shift: '白班',
  });

  // 还没超过 10 小时，不自动下班
  setNow('2026-10-20T17:59:59');
  page.onShow();
  assert.strictEqual(store.getRecords().length, 0);
  assert(store.getPending());

  // 正好 10 小时仍不触发，必须超过
  setNow('2026-10-20T18:00:00');
  page.updateClock();
  assert.strictEqual(store.getRecords().length, 0);
  assert(store.getPending());

  // 超过 10 小时后自动补记，下班时间 = 上班 + 10 小时 = 18:00，计酬仍为 8 小时
  setNow('2026-10-20T18:00:01');
  page.updateClock();
  const recs = store.getRecords();
  assert.strictEqual(recs.length, 1);
  assert.strictEqual(recs[0].hours, 8);
  assert.strictEqual(recs[0].minutes, 600);
  assert.strictEqual(recs[0].rawHours, 10);
  assert.strictEqual(recs[0].capped, true);
  assert.strictEqual(recs[0].endTime, '18:00');
  assert.strictEqual(recs[0].endDate, '2026-10-20');
  assert.strictEqual(recs[0].autoClockOut, true);
  assert.strictEqual(store.getPending(), null);
  page.onHide();
});

test('12 小时班制超过 14 小时自动下班，下班记 14 小时、计酬 12 小时', () => {
  resetStorage();
  seedConfig('12h', '夜班');
  setNow('2026-10-20T20:00:00');
  const page = makePage('pages/record/record.js');
  page.onLoad();
  store.setPending({
    date: '2026-10-20',
    startTime: '20:00',
    startTs: new RealDate('2026-10-20T20:00:00').getTime(),
    shiftType: '12h',
    shift: '夜班',
  });

  setNow('2026-10-21T09:59:59');
  page.onShow();
  assert.strictEqual(store.getRecords().length, 0);
  assert(store.getPending());

  // 正好 14 小时仍不触发
  setNow('2026-10-21T10:00:00');
  page.updateClock();
  assert.strictEqual(store.getRecords().length, 0);
  assert(store.getPending());

  setNow('2026-10-21T10:00:01');
  page.updateClock();
  const recs = store.getRecords();
  assert.strictEqual(recs.length, 1);
  assert.strictEqual(recs[0].hours, 12);
  assert.strictEqual(recs[0].minutes, 840);
  assert.strictEqual(recs[0].rawHours, 14);
  assert.strictEqual(recs[0].capped, true);
  assert.strictEqual(recs[0].endTime, '10:00');
  assert.strictEqual(recs[0].endDate, '2026-10-21');
  assert.strictEqual(recs[0].crossDay, true);
  assert.strictEqual(recs[0].autoClockOut, true);
  assert.strictEqual(store.getPending(), null);
  page.onHide();
});

test('首页按工时点击小时弹出记录提醒，确认后保存', () => {
  resetStorage();
  seedConfig();
  setNow('2026-10-20T09:00:00');
  const page = makePage('pages/record/record.js');
  page.onLoad();
  modals.length = 0;
  page.onSelectHour({ currentTarget: { dataset: { hour: 8 } } });
  assert.strictEqual(store.getRecords().length, 0);
  assert.strictEqual(modals.length, 1);
  assert.strictEqual(modals[0].title, '记录提醒');
  assert(modals[0].content.indexOf('8 小时') >= 0);
  assert.strictEqual(modals[0].content.indexOf('折合'), -1);
  vibrations = 0;
  modals[0].success({ confirm: true });
  assert.strictEqual(store.getRecords().length, 1);
  assert.strictEqual(store.getRecords()[0].hours, 8);
  assert.strictEqual(vibrations, 0);
  page.onHide();
});

test('首页按工时保存失败时不提示成功', () => {
  resetStorage();
  seedConfig();
  setNow('2026-10-20T09:00:00');
  const page = makePage('pages/record/record.js');
  page.onLoad();
  modals.length = 0;
  page.onSelectHour({ currentTarget: { dataset: { hour: 8 } } });
  assert.strictEqual(modals.length, 1);
  failSet = true;
  modals[0].success({ confirm: true });
  assert.strictEqual(store.getRecords().length, 0);
  assert.strictEqual(page.data.result.visible, false);
  failSet = false;
  page.onHide();
});

/* ---------------- 月度页：明细 / 编辑 / 补记 ---------------- */

test('月度页：跨天/未来日期与单条编辑、补记', () => {
  resetStorage();
  seedConfig('12h', '白班');
  setNow('2026-10-20T12:00:00');
  const r = addRecord({
    date: '2026-10-20',
    mode: 'time',
    startTime: '08:00',
    endTime: '17:00',
    minutes: 540,
    rawHours: 9,
    hours: 9,
    cap: 12,
    capped: false,
    units: 1.13,
  });

  const page = makePage('pages/month/month.js');
  page.onLoad();
  page.onShow();
  assert.strictEqual(page.data.ym, '2026-10');
  assert.strictEqual(page.data.rows.length, 20);
  assert.strictEqual(page.data.canNext, false);
  assert.strictEqual(page.data.totalHours, 9);

  page.onNextMonth();
  assert.strictEqual(page.data.ym, '2026-10');

  page.openDaySheet('2026-10-20');
  assert.strictEqual(page.data.daySheet.records.length, 1);

  page.onEditRecord({ currentTarget: { dataset: { id: r.id } } });
  assert.strictEqual(page.data.recordEdit.visible, true);
  page.onRecordEditStart({ detail: { value: '09:00' } });
  page.onRecordEditEnd({ detail: { value: '17:00' } });
  assert.strictEqual(page.data.recordEdit.canSave, true);
  page.onSaveRecordEdit();

  const updated = store.getRecordById(r.id);
  assert.strictEqual(updated.hours, 8);
  assert.strictEqual(updated.startTime, '09:00');

  modals.length = 0;
  page.onPickAddHour({ currentTarget: { dataset: { hour: 2 } } });
  assert.strictEqual(store.getRecordsByMonth('2026-10').length, 1);
  assert.strictEqual(modals.length, 1);
  assert.strictEqual(modals[0].title, '补记提醒');
  assert.strictEqual(modals[0].content.indexOf('折合'), -1);
  vibrations = 0;
  modals[0].success({ confirm: true });
  assert.strictEqual(store.getRecordsByMonth('2026-10').length, 2);
  assert.strictEqual(vibrations, 0);
  page.onHide();
});

/* ---------------- 历史页：24 个月外班次 / 复制列名 ---------------- */

test('历史页：查询 24 个月外月份仍有班次分布', () => {
  resetStorage();
  seedConfig();
  setNow('2026-10-20T12:00:00');
  addRecord({ date: '2024-01-05', hours: 8, shift: '白班' });
  addRecord({ date: '2026-10-20', hours: 8, shift: '夜班' });

  const page = makePage('pages/history/history.js');
  page.onLoad();
  page.onShow();
  page.load('2024-01');
  assert.strictEqual(page.data.shiftStat.length, 1, '24 个月外的月份也应有班次分布');
  assert.strictEqual(page.data.shiftStat[0].name, '白班');
  assert.strictEqual(page.data.rows.length, 1);

  clipboard = '';
  page.onCopyMonth();
  assert(clipboard.indexOf('真实出勤') >= 0);
  assert(clipboard.indexOf('计酬小时') >= 0);
  assert(clipboard.indexOf('出勤小时') < 0);
  page.onHide();
});

test('历史页：不能查看未来月份', () => {
  resetStorage();
  seedConfig();
  setNow('2026-10-20T12:00:00');
  const page = makePage('pages/history/history.js');
  page.onLoad();
  page.onShow();
  const before = page.data.ym;
  page.onMonthChange({ detail: { value: '2026-11' } });
  assert.strictEqual(page.data.ym, before);
  page.onHide();
});

/* ---------------- 首次设置 / 撤销删除 / 关于页 ---------------- */

test('首次设置时 tabBar 保持隐藏，完成后恢复', () => {
  resetStorage();
  setNow('2026-10-20T12:00:00');
  const page = makePage('pages/record/record.js');
  page.onLoad();
  assert.strictEqual(page.data.showShiftPicker, true);
  assert.strictEqual(page.data.isFirstSet, true);
  page.onShow();
  assert.strictEqual(page._bar.data.hidden, true);
  page.onConfirmShift();
  assert.strictEqual(page.data.showShiftPicker, false);
  assert.strictEqual(page._bar.data.hidden, false);
  assert(store.getConfig());
  page.onHide();
});

test('首页删除后 8 秒内可撤销', () => {
  resetStorage();
  seedConfig();
  setNow('2026-10-20T12:00:00');
  const rec = addRecord({ hours: 8 });
  const page = makePage('pages/record/record.js');
  page.onLoad();
  page.onShow();
  modals.length = 0;
  page.onDeleteRecord({ currentTarget: { dataset: { id: rec.id } } });
  assert.strictEqual(modals.length, 1);
  modals[0].success({ confirm: true });
  assert.strictEqual(store.getRecords().length, 0);
  assert(page.data.undoRecord);
  page.onUndoDelete();
  assert.strictEqual(store.getRecords().length, 1);
  assert.strictEqual(store.getRecords()[0].id, rec.id);
  page.onHide();
});

test('月度补记写入失败时不增加记录', () => {
  resetStorage();
  seedConfig();
  setNow('2026-10-20T12:00:00');
  const page = makePage('pages/month/month.js');
  page.onLoad();
  page.onShow();
  page.openDaySheet('2026-10-20');
  modals.length = 0;
  page.onPickAddHour({ currentTarget: { dataset: { hour: 2 } } });
  assert.strictEqual(modals.length, 1);
  failSet = true;
  modals[0].success({ confirm: true });
  assert.strictEqual(store.getRecords().length, 0);
  failSet = false;
  page.onHide();
});

test('关于页：导出、清空、版本号', () => {
  resetStorage();
  seedConfig('8h', '夜班');
  addRecord({ hours: 8, shift: '夜班' });
  const page = makePage('pages/about/about.js');
  page.onLoad();
  page.onShow();
  assert.strictEqual(page.data.version, '1.1.9');
  assert.strictEqual(page.data.storageLabel, '正式版');
  assert.strictEqual(page.data.recordCount, 1);

  clipboard = '';
  page.onExport();
  const backup = JSON.parse(clipboard);
  assert.strictEqual(backup.app, 'jigongshi');
  assert.strictEqual(backup.records.length, 1);
  assert(clipboard.indexOf('\n  "app"') >= 0);
  assert(clipboard.split('\n').length > 5);

  modals.length = 0;
  page.onClearRecords();
  assert.strictEqual(modals.length, 1);
  modals[0].success({ confirm: true });
  assert.strictEqual(store.getRecords().length, 0);
  assert.strictEqual(page.data.recordCount, 0);
});

/* ---------------- 汇总 ---------------- */

const failed = results.filter((x) => !x.ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' tests passed');
if (failed.length) {
  failed.forEach((x) => console.error('\n' + x.name + '\n' + (x.error.stack || x.error.message)));
  process.exitCode = 1;
}
