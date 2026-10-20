/* ------------------------------------------------------------------
 * 出勤轻松记 · 微信小程序
 * 版权所有 © 2026 dakerclaw，保留所有权利。
 * 本文件属专有软件，未经授权不得复制、修改、分发或用于商业用途。
 * 详见项目根目录 LICENSE 文件。
 * ------------------------------------------------------------------ */

/**
 * 通用 UI 提示封装
 * 替代原 TDesign 的 t-toast / t-dialog（已彻底移除依赖）
 */

function toast(message) {
  wx.showToast({ title: message, icon: 'none', duration: 2000 });
}

function confirmDialog({ title, content, confirmText, cancelText, onConfirm }) {
  wx.showModal({
    title: title,
    content: content,
    confirmText: confirmText || '确定',
    cancelText: cancelText || '取消',
    success: (res) => {
      if (res.confirm && onConfirm) onConfirm();
    },
  });
}

/** 隐藏/显示自定义 tabBar（弹层打开时避免误触） */
function setTabBarHidden(page, hidden) {
  if (!page || typeof page.getTabBar !== 'function') return;
  const bar = page.getTabBar();
  if (bar && typeof bar.setData === 'function') {
    bar.setData({ hidden: !!hidden });
  }
}

/** 轻触反馈：失败也不影响业务 */
function haptic() {
  try {
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
  } catch (e) {
    // 部分机型/版本不支持，忽略
  }
}

module.exports = { toast, confirmDialog, setTabBarHidden, haptic };
