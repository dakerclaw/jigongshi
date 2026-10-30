/* ------------------------------------------------------------------
 * 出勤轻松记 · 微信小程序
 * 版权所有 © 2026 dakerclaw，保留所有权利。
 * 本文件属专有软件，未经授权不得复制、修改、分发或用于商业用途。
 * 详见项目根目录 LICENSE 文件。
 * ------------------------------------------------------------------ */

const store = require('./utils/store.js');
const shiftUtil = require('./utils/shift.js');

App({
  globalData: {
    version: '1.1.6',
    // 默认班制：'12h' | '8h'
    shiftType: shiftUtil.DEFAULT_TYPE,
    // 默认班次：白班 / 中班 / 夜班
    shift: '白班',
  },

  onLaunch() {
    this.reloadConfig();
  },

  /** 从 Storage 重新加载默认班制（导入备份后也会调用） */
  reloadConfig() {
    const cfg = store.getConfig();
    if (cfg && shiftUtil.isValidType(cfg.shiftType) && shiftUtil.isValidShift(cfg.shiftType, cfg.shift)) {
      this.globalData.shiftType = cfg.shiftType;
      this.globalData.shift = cfg.shift;
    }
  },

  // 保存默认班制（供首页调用），返回是否写入成功
  saveDefaultShift(shiftType, shift) {
    this.globalData.shiftType = shiftType;
    this.globalData.shift = shift;
    return store.saveConfig({ shiftType: shiftType, shift: shift });
  },
});
