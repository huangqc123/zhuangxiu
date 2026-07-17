const { CATEGORIES, TOOLS } = require('../../utils/tools')
const { getHistory, getFavorites, toggleFavorite } = require('../../utils/storage')
const { hexToRgba, formatRelativeTime } = require('../../utils/presentation')

function decorateTool(tool, favorites) {
  return {
    ...tool,
    favorite: favorites.includes(tool.id),
    softColor: hexToRgba(tool.accent, 0.1),
    borderColor: hexToRgba(tool.accent, 0.18)
  }
}

function buildSections(favorites) {
  return CATEGORIES.map(category => ({
    ...category,
    tools: TOOLS
      .filter(tool => tool.category === category.id)
      .map(tool => decorateTool(tool, favorites))
  }))
}

Page({
  data: {
    query: '',
    sections: [],
    favoriteTools: [],
    searchResults: [],
    recent: [],
    toolCount: TOOLS.length
  },

  onLoad() {
    this.refreshData()
  },

  onShow() {
    this.refreshData()
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
  },

  onPullDownRefresh() {
    this.refreshData()
    wx.stopPullDownRefresh()
  },

  refreshData() {
    const favorites = getFavorites()
    const history = getHistory()
    const decorated = TOOLS.map(tool => decorateTool(tool, favorites))
    const query = this.data.query.trim().toLowerCase()
    this.setData({
      sections: buildSections(favorites),
      favoriteTools: decorated.filter(tool => tool.favorite),
      searchResults: query ? this.filterTools(query, decorated) : [],
      recent: history.slice(0, 3).map(item => ({
        ...item,
        displayName: item.recordName || item.toolName,
        subtitleText: item.recordName ? `${item.toolName} · ${formatRelativeTime(item.time)}` : formatRelativeTime(item.time)
      }))
    })
  },

  filterTools(query, tools) {
    return tools.filter(tool => `${tool.name}${tool.subtitle}${tool.scene}`.toLowerCase().includes(query))
  },

  onSearchInput(e) {
    const query = e.detail.value
    const favorites = getFavorites()
    const tools = TOOLS.map(tool => decorateTool(tool, favorites))
    this.setData({
      query,
      searchResults: query.trim() ? this.filterTools(query.trim().toLowerCase(), tools) : []
    })
  },

  onClearSearch() {
    this.setData({ query: '', searchResults: [] })
  },

  onToolTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/calculator/index?type=${id}` })
  },

  onToggleFavorite(e) {
    const id = e.currentTarget.dataset.id
    const next = toggleFavorite(id)
    this.refreshData()
    wx.showToast({
      title: next.includes(id) ? '已加入常用' : '已取消常用',
      icon: 'none'
    })
  },

  onOpenHistory() {
    wx.navigateTo({ url: '/pages/history/index' })
  },

  onOpenRecord(e) {
    const { id, type } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/calculator/index?type=${type}&recordId=${id}` })
  },

  onShareAppMessage() {
    return {
      title: '装修材料计算器｜10类材料用量快速估算',
      path: '/pages/home/index'
    }
  }
})
