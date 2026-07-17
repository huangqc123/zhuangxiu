const assert = require('assert')
const path = require('path')

const storage = new Map()
const navigations = []
let modal = null
let app = null

global.App = config => { app = config }
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, value) },
  showModal(options) { modal = options },
  navigateTo(options) { navigations.push(options.url) }
}

require(path.resolve(__dirname, '../miniprogram/app.js'))
const { AGREEMENT_KEY, AGREEMENT_VERSION } = require('../miniprogram/utils/agreement')

app.onLaunch()
app.onShow()
assert.strictEqual(modal.title, '使用前请阅读')
assert.strictEqual(modal.cancelText, '查看协议')
assert.strictEqual(modal.confirmText, '同意继续')
assert.ok(modal.content.includes('用户协议'))
assert.ok(modal.content.includes('隐私政策'))

let acceptedCallbackCount = 0
app.showAgreementPrompt(() => { acceptedCallbackCount += 1 })
assert.strictEqual(acceptedCallbackCount, 0, '同意前不得放行受保护页面')

modal.success({ confirm: false })
assert.strictEqual(navigations.at(-1), '/pages/legal/index?mode=terms&consent=1')
assert.strictEqual(acceptedCallbackCount, 0, '仅查看协议不能视为已经同意')

app.showAgreementPrompt(() => { acceptedCallbackCount += 1 })
modal.success({ confirm: true })
assert.strictEqual(storage.get(AGREEMENT_KEY), AGREEMENT_VERSION)
assert.strictEqual(acceptedCallbackCount, 1, '明确同意后应放行受保护页面一次')

modal = null
let acceptedImmediately = false
app.showAgreementPrompt(() => { acceptedImmediately = true })
assert.strictEqual(modal, null, '已同意当前版本后不应重复弹窗')
assert.strictEqual(acceptedImmediately, true, '已同意用户应直接进入页面')

console.log('First-launch agreement consent tests passed')
