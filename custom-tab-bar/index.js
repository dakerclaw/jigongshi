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
