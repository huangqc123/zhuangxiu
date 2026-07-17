const assert = require('assert')
const path = require('path')

const storage = new Map()
const toasts = []
const scrolls = []
const modals = []
let clipboard = ''
let page = null

global.App = () => {}
global.Page = config => { page = config }
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, value) },
  setNavigationBarTitle() {},
  showModal(options) { modals.push(options) },
  showToast(options) { toasts.push(options.title) },
  hideKeyboard() {},
  pageScrollTo(options) { scrolls.push(options) },
  setClipboardData(options) { clipboard = options.data },
  navigateTo() {},
  navigateBack() {}
}

require(path.resolve(__dirname, '../miniprogram/pages/calculator/index.js'))

page.setData = function setData(patch, callback) {
  for (const [key, value] of Object.entries(patch)) {
    const nested = key.match(/^params\.(.+)$/)
    if (nested) this.data.params[nested[1]] = value
    else this.data[key] = value
  }
  if (callback) callback()
}

page.onLoad({ type: 'floorTile' })
assert.strictEqual(page.data.tool.name, '地砖计算')
assert.ok(page.data.basicFields.length > 0)
assert.ok(page.data.advancedFields.length > 0)
assert.ok(page.data.advancedSummary.includes('损耗率'))

page.onFieldConfirm({ currentTarget: { dataset: { group: 'basic', index: 0 } } })
assert.strictEqual(page.data.focusedField, page.data.basicFields[1].key)

page.onCalculate()
assert.strictEqual(page.data.showResult, true)
assert.strictEqual(page.data.result.primary.value, 13)
assert.strictEqual(page.data.budgetLines.length, 3)
assert.strictEqual(scrolls.at(-1).selector, '#result-anchor')
assert.ok(toasts.includes('已生成采购清单'))

page.onPriceInput({ currentTarget: { dataset: { index: 0 } }, detail: { value: '100' } })
assert.strictEqual(page.data.budgetTotal, '1300.00')
page.onRecordNameInput({ detail: { value: '主卫地面' } })
assert.strictEqual(storage.get('renovation_calculation_history_v1')[0].recordName, '主卫地面')
assert.strictEqual(storage.get('renovation_calculation_history_v1')[0].budgetTotal, '1300.00')
page.onCopyResult()
assert.ok(clipboard.includes('预算估算'))
assert.ok(clipboard.includes('合计：¥1300.00'))

const history = storage.get('renovation_calculation_history_v1')
assert.strictEqual(history.length, 1)
assert.strictEqual(history[0].toolId, 'floorTile')
assert.strictEqual(history[0].params.length, '5')

page.onFieldInput({ currentTarget: { dataset: { key: 'deductArea' } }, detail: { value: '20' } })
page.onCalculate()
assert.strictEqual(page.data.showResult, false)
assert.strictEqual(page.data.errorField, 'deductArea')
assert.ok(toasts.at(-1).includes('必须小于毛面积'))

// 超常值先要求确认单位，未经确认不生成结果。
page.onFieldInput({ currentTarget: { dataset: { key: 'length' } }, detail: { value: '280' } })
page.onCalculate()
assert.strictEqual(modals.at(-1).title, '确认输入值与单位')
assert.ok(modals.at(-1).content.includes('厘米填成了米'))
assert.strictEqual(page.data.showResult, false)

console.log('Calculator page interaction tests passed')
