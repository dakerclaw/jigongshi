/**
 * 通用 UI 提示封装
 * 替代原 TDesign 的 t-toast / t-dialog（已彻底移除依赖）
 */

function toast(page, message) {
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

module.exports = { toast, confirmDialog };
