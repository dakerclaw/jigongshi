/* ------------------------------------------------------------------
 * 出勤轻松记 · 微信小程序
 * 版权所有 © 2026 dakerclaw，保留所有权利。
 * 本文件属专有软件，未经授权不得复制、修改、分发或用于商业用途。
 * 详见项目根目录 LICENSE 文件。
 * ------------------------------------------------------------------ */

const store = require('../../utils/store.js');
const time = require('../../utils/time.js');
const { toast, confirmDialog } = require('../../utils/ui.js');

const app = getApp();

Page({
  data: {
    version: '1.1.2',
    recordCount: 0,
    monthCount: 0,
    pendingText: '无',
    lastText: '暂无记录',
  },

  onLoad() {
    this.setData({ version: app.globalData.version || '1.1.2' });
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const records = store.getRecords();
    const months = {};
    let last = '';
    records.forEach((r) => {
      if (!r || !r.date) return;
      months[String(r.date).slice(0, 7)] = 1;
      if (r.date > last) last = r.date;
    });
    this.setData({
      recordCount: records.length,
      monthCount: Object.keys(months).length,
      pendingText: store.getPending() ? '有 1 条未完成打卡' : '无',
      lastText: last ? time.mdText(last) : '暂无记录',
    });
  },

  /* ---------------- 备份 / 恢复 ---------------- */

  onExport() {
    const data = store.exportData();
    wx.setClipboardData({
      data: JSON.stringify(data),
      success: () => {
        // 微信会提示「内容已复制」；这里再给一条更明确的操作说明
        wx.showToast({ title: '备份 JSON 已复制，请粘贴保存', icon: 'none', duration: 2600 });
      },
      fail: () => toast('复制失败，请重试'),
    });
  },

  onImport() {
    confirmDialog({
      title: '从剪贴板导入备份？',
      content: '请先复制之前导出的备份 JSON。导入会覆盖本机现有记录、默认班制和未完成打卡，且无法撤销。',
      confirmText: '继续导入',
      cancelText: '取消',
      onConfirm: () => {
        wx.getClipboardData({
          success: (res) => {
            let data = null;
            try {
              data = JSON.parse(res.data);
            } catch (e) {
              toast('剪贴板内容不是有效的备份 JSON');
              return;
            }
            if (!store.importData(data)) {
              toast('导入失败：备份格式不正确或存储空间不足');
              return;
            }
            app.reloadConfig();
            this.refresh();
            toast('导入成功，共 ' + store.getRecords().length + ' 条记录');
          },
          fail: () => toast('读取剪贴板失败，请重试'),
        });
      },
    });
  },

  onClearRecords() {
    confirmDialog({
      title: '清空全部工时记录？',
      content: '将删除本机所有出勤记录和未完成打卡，默认班制会保留。此操作无法撤销。',
      confirmText: '清空',
      cancelText: '取消',
      onConfirm: () => {
        if (!store.clearAllRecords()) {
          toast('清空失败，请检查微信存储空间');
          return;
        }
        this.refresh();
        toast('已清空全部工时记录');
      },
    });
  },
});
