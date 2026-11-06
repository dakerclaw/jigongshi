/* ------------------------------------------------------------------
 * 出勤轻松记 · 微信小程序
 * 版权所有 © 2026 dakerclaw，保留所有权利。
 * 本文件属专有软件，未经授权不得复制、修改、分发或用于商业用途。
 * 详见项目根目录 LICENSE 文件。
 * ------------------------------------------------------------------ */

const store = require('../../utils/store.js');
const time = require('../../utils/time.js');
const stats = require('../../utils/stats.js');
const lunar = require('../../utils/lunar.js');
const { toast, setTabBarHidden } = require('../../utils/ui.js');

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

    // 月历
    calendar: {
      title: '', // 2026年11月
      weekdays: ['一', '二', '三', '四', '五', '六', '日'],
      weeks: [], // 每周 7 格；每日 { day, lunar, theme, inMonth, isFuture }
    },
    legend: [], // 图例：[{name, theme}]

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

    // 出勤日 -> 班次（当日有多个班次取第一个，月历一格只标一种颜色）
    const dayShift = {};
    list.forEach((r) => {
      if (!r || !r.date) return;
      if (!dayShift[r.date]) dayShift[r.date] = r.shift || '';
    });

    this.setData({
      ym: month,
      ymText: time.ymText(month),
      currentYm: currentYm,
      calendar: this.buildCalendar(month, dayShift, currentYm),
      legend: this.buildLegend(dayShift),
      rows: rows,
      hasCapped: list.some((r) => r && r.capped),
      totalHours: sum.totalHours,
      totalMinutes: sum.totalMinutes,
      totalUnits: sum.totalUnits.toFixed(2),
      workDays: sum.workDays,
      avgHours: sum.avgHours,
    });
  },

  /**
   * 构建月历：第一列为星期一
   * 每格：{ day, lunar, theme, inMonth, isFuture }
   * theme: '' 未出勤不标色 / 'day' 白班 / 'mid' 中班 / 'night' 夜班
   */
  buildCalendar(ym, dayShift, currentYm) {
    const parts = String(ym).split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]); // 1-12
    if (!year || !month) return { title: '', weekdays: this.data.calendar.weekdays, weeks: [] };

    const daysInMonth = new Date(year, month, 0).getDate();
    // JS getDay(): 0=周日...6=周六；换算为周一起始的列号（0=周一 ... 6=周日）
    const firstCol = (new Date(year, month - 1, 1).getDay() + 6) % 7;

    const cells = [];
    // 月首前置空格
    for (let i = 0; i < firstCol; i++) cells.push(null);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = year + '-' + time.pad2(month) + '-' + time.pad2(d);
      const shift = dayShift[date] || '';
      cells.push({
        day: d,
        lunar: lunar.lunarDayText(year, month, d),
        theme: shift ? require('../../utils/shift.js').themeOf(shift) : '',
        inMonth: true,
        isFuture: date > this.ymOfToday(),
      });
    }
    // 末尾补齐整周
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    return {
      title: time.ymText(ym),
      weekdays: this.data.calendar.weekdays,
      weeks: weeks,
    };
  },

  /** 当天所在年月，用于判断未来日期（未来月份本就查不到，这里防月末跨界） */
  ymOfToday() {
    const n = time.now();
    return n.ym + '-' + n.ymd.slice(8, 10);
  },

  /** 图例：该月实际出现过的班次颜色说明 */
  buildLegend(dayShift) {
    const shiftUtil = require('../../utils/shift.js');
    const seen = {};
    Object.keys(dayShift).forEach((date) => {
      const s = dayShift[date];
      if (s) seen[s] = shiftUtil.themeOf(s);
    });
    // 固定顺序：白班、中班、夜班
    return ['白班', '中班', '夜班']
      .filter((name) => seen[name])
      .map((name) => ({ name: name, theme: seen[name] }));
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
