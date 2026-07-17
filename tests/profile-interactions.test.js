const assert = require('assert')
const path = require('path')

const storage = new Map()
const navigations = []
const toasts = []
let modal = null
let clipboard = ''
let page = null

global.Page = config => { page = config }
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, value) },
  navigateTo(options) { navigations.push(options.url) },
  showModal(options) { modal = options },
  setClipboardData(options) {
    clipboard = options.data
    if (options.success) options.success()
  },
  showToast(options) { toasts.push(options.title) },
  stopPullDownRefresh() {}
}

require(path.resolve(__dirname, '../miniprogram/pages/profile/index.js'))

page.setData = function setData(patch) {
  Object.assign(this.data, patch)
}

page.onLoad()
assert.strictEqual(page.data.favoriteCount, 0)
assert.strictEqual(page.data.historyCount, 0)

page.onOpenFeedback()
assert.strictEqual(modal.title, '意见反馈')
assert.ok(modal.content.includes('a1126204749'))
assert.strictEqual(modal.confirmText, '复制号码')
modal.success({ confirm: true })
assert.strictEqual(clipboard, 'a1126204749')
assert.ok(toasts.includes('微信号已复制'))

page.onOpenLegal({ currentTarget: { dataset: { mode: 'terms' } } })
page.onOpenLegal({ currentTarget: { dataset: { mode: 'privacy' } } })
assert.deepStrictEqual(navigations.slice(-2), [
  '/pages/legal/index?mode=terms',
  '/pages/legal/index?mode=privacy'
])

const share = page.onShareAppMessage()
assert.strictEqual(share.path, '/pages/home/index')
assert.ok(share.title.includes('装修材料计算器'))

console.log('Profile feedback, legal links, and share interaction tests passed')
