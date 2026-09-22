/* ------------------------------------------------------------------
 * 出勤轻松记 · 微信小程序
 * 版权所有 © 2026 dakerclaw，保留所有权利。
 * 本文件属专有软件，未经授权不得复制、修改、分发或用于商业用途。
 * 详见项目根目录 LICENSE 文件。
 * ------------------------------------------------------------------ */

const store = require('./utils/store.js');

App({
  globalData: {
    // 默认班制：'12h' | '8h'
    shiftType: '12h',
    // 默认班次：白班 / 中班 / 夜班
    shift: '白班',
    // 是否已经完成过首次班制选择
    shiftSetted: false,
  },

  onLaunch() {
    const cfg = store.getConfig();
    if (cfg && cfg.shiftType && cfg.shift) {
      this.globalData.shiftType = cfg.shiftType;
      this.globalData.shift = cfg.shift;
      this.globalData.shiftSetted = true;
    }
  },

  // 保存默认班制（供首页调用）
  saveDefaultShift(shiftType, shift) {
    this.globalData.shiftType = shiftType;
    this.globalData.shift = shift;
    this.globalData.shiftSetted = true;
    store.saveConfig({ shiftType, shift, setted: true });
  },
});
