const { TOOLS } = require('../../utils/tools')
const { getHistory, getFavorites, toggleFavorite } = require('../../utils/storage')
const { hexToRgba, formatShortTime } = require('../../utils/presentation')

Page({
  data: {
    favoriteTools: [],
    recent: [],
    favoriteCount: 0,
    historyCount: 0
  },

  onLoad() {
    this.refreshData()
  },

  onShow() {
    this.refreshData()
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
  },

  onPullDownRefresh() {
    this.refreshData()
    wx.stopPullDownRefresh()
  },

  refreshData() {
    const favorites = getFavorites()
    const history = getHistory()
    this.setData({
      favoriteTools: TOOLS
        .filter(tool => favorites.includes(tool.id))
        .map(tool => ({ ...tool, softColor: hexToRgba(tool.accent, 0.1) })),
      recent: history.slice(0, 3).map(item => ({
        ...item,
        displayName: item.recordName || item.toolName,
        subtitleText: item.recordName ? `${item.toolName} · ${formatShortTime(item.time)}` : formatShortTime(item.time)
      })),
      favoriteCount: favorites.length,
      historyCount: history.length
    })
  },

  onToolTap(e) {
    wx.navigateTo({ url: `/pages/calculator/index?type=${e.currentTarget.dataset.id}` })
  },

  onToggleFavorite(e) {
    toggleFavorite(e.currentTarget.dataset.id)
    this.refreshData()
    wx.showToast({ title: '已取消常用', icon: 'none' })
  },

  onOpenRecord(e) {
    const { id, type } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/calculator/index?type=${type}&recordId=${id}` })
  },

  onOpenHistory() {
    wx.navigateTo({ url: '/pages/history/index' })
  },

  onOpenGuide() {
    wx.navigateTo({ url: '/pages/guide/index' })
  },

  onOpenFeedback() {
    wx.showModal({
      title: '意见反馈',
      content: '欢迎添加微信反馈使用问题或改进建议。\n\n微信号：a1126204749',
      cancelText: '暂不反馈',
      confirmText: '复制号码',
      confirmColor: '#A85037',
      success: res => {
        if (!res.confirm) return
        wx.setClipboardData({
          data: 'a1126204749',
          success: () => wx.showToast({ title: '微信号已复制', icon: 'none' })
        })
      }
    })
  },

  onOpenLegal(e) {
    const mode = e.currentTarget.dataset.mode === 'privacy' ? 'privacy' : 'terms'
    wx.navigateTo({ url: `/pages/legal/index?mode=${mode}` })
  },

  onShareAppMessage() {
    return {
      title: '装修材料计算器｜算清用量再采购',
      path: '/pages/home/index'
    }
  }
})
