const assert = require('assert')

const storage = new Map()
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, value) }
}

const { TOOLS, getDefaultParams } = require('../miniprogram/utils/tools')
const { calculate } = require('../miniprogram/utils/calculators')
const { getHistory, saveHistory, updateRecord, removeRecord, clearHistory, getFavorites, toggleFavorite, SCHEMA_VERSION, ENGINE_VERSION } = require('../miniprogram/utils/storage')

const tool = TOOLS.find(item => item.id === 'floorTile')
const params = getDefaultParams(tool)
const result = calculate(tool.id, params)

const first = saveHistory(tool, params, result)
assert.ok(first)
assert.strictEqual(getHistory().length, 1)
assert.strictEqual(getHistory()[0].schemaVersion, SCHEMA_VERSION)
assert.strictEqual(getHistory()[0].engineVersion, ENGINE_VERSION)
assert.ok(Array.isArray(getHistory()[0].purchases))

// 相同工具与相同参数再次计算时只保留最新记录，避免台账被重复项淹没
const second = saveHistory(tool, params, result)
assert.ok(second)
assert.notStrictEqual(first.id, second.id)
assert.strictEqual(getHistory().length, 1)
assert.strictEqual(getHistory()[0].id, second.id)

const named = updateRecord(second.id, {
  recordName: '主卫墙面',
  budgetLines: [{ label: '地砖', unit: '箱', price: '100', subtotal: '1300.00' }],
  budgetTotal: '1300.00'
})
assert.strictEqual(named.recordName, '主卫墙面')
assert.strictEqual(getHistory()[0].budgetTotal, '1300.00')

// 相同参数重新计算时继承名称与预算，但只保留最新一条。
const inherited = saveHistory(tool, params, result)
assert.strictEqual(inherited.recordName, '主卫墙面')
assert.strictEqual(inherited.budgetTotal, '1300.00')
assert.strictEqual(getHistory().length, 1)

const changed = { ...params, length: '6' }
saveHistory(tool, changed, calculate(tool.id, changed))
assert.strictEqual(getHistory().length, 2)

removeRecord(inherited.id)
assert.strictEqual(getHistory().length, 1)
clearHistory()
assert.strictEqual(getHistory().length, 0)

assert.deepStrictEqual(getFavorites(), [])
assert.deepStrictEqual(toggleFavorite(tool.id), [tool.id])
assert.deepStrictEqual(toggleFavorite(tool.id), [])

const originalSetStorage = wx.setStorageSync
wx.setStorageSync = () => { throw new Error('storage unavailable') }
assert.strictEqual(saveHistory(tool, params, result), null)
wx.setStorageSync = originalSetStorage

console.log('Local storage deduplication and favorites tests passed')
