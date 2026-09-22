/* ------------------------------------------------------------------
 * 出勤轻松记 · 微信小程序
 * 版权所有 © 2026 dakerclaw，保留所有权利。
 * 本文件属专有软件，未经授权不得复制、修改、分发或用于商业用途。
 * 详见项目根目录 LICENSE 文件。
 * ------------------------------------------------------------------ */

const LIST = [
  { path: '/pages/record/record', text: '记工时', icon: '⏰' },
  { path: '/pages/month/month', text: '月度记录', icon: '📅' },
  { path: '/pages/history/history', text: '历史查询', icon: '🔍' },
];

Component({
  data: {
    list: LIST,
    selected: 0,
  },
  methods: {
    onSwitch(e) {
      const { index, path } = e.currentTarget.dataset;
      if (index === this.data.selected) return;
      wx.switchTab({ url: path });
    },
  },
});
