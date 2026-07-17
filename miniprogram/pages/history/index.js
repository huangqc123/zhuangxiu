const { getHistory, removeRecord, clearHistory } = require('../../utils/storage')
const { formatFullTime } = require('../../utils/presentation')

Page({
  data: {
    records: []
  },

  onShow() {
    this.loadRecords()
  },

  loadRecords() {
    this.setData({
      records: getHistory().map(item => ({
        ...item,
        displayName: item.recordName || item.toolName,
        subtitleText: item.recordName ? `${item.toolName} · ${formatFullTime(item.time)}` : formatFullTime(item.time)
      }))
    })
  },

  onReuse(e) {
    const { id, type } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/calculator/index?type=${type}&recordId=${id}` })
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除这条记录？',
      content: '删除后无法恢复，其他计算记录不受影响。',
      confirmColor: '#C4473A',
      success: res => {
        if (!res.confirm) return
        removeRecord(id)
        this.loadRecords()
      }
    })
  },

  onClearAll() {
    if (!this.data.records.length) return
    wx.showModal({
      title: '清空全部记录？',
      content: '本机保存的全部计算参数和结果摘要将被删除。',
      confirmColor: '#C4473A',
      success: res => {
        if (!res.confirm) return
        clearHistory()
        this.loadRecords()
        wx.showToast({ title: '已清空', icon: 'none' })
      }
    })
  },

  onGoHome() {
    wx.reLaunch({ url: '/pages/home/index' })
  }
})
