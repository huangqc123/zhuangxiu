const assert = require('assert')
const path = require('path')

const { TOOLS, getDefaultParams } = require('../miniprogram/utils/tools')
const { calculate } = require('../miniprogram/utils/calculators')
const { encodeShareSnapshot, decodeShareSnapshot, MAX_SNAPSHOT_LENGTH } = require('../miniprogram/utils/shareSnapshot')

function loadCalculator(initialStorage = new Map(), app = null) {
  const modulePath = path.resolve(__dirname, '../miniprogram/pages/calculator/index.js')
  delete require.cache[require.resolve(modulePath)]

  let page = null
  const toasts = []
  const storage = initialStorage
  global.Page = config => { page = config }
  if (app) global.getApp = () => app
  else delete global.getApp
  global.wx = {
    getStorageSync(key) { return storage.get(key) },
    setStorageSync(key, value) { storage.set(key, value) },
    setNavigationBarTitle() {},
    showModal() {},
    showToast(options) { toasts.push(options.title) },
    hideKeyboard() {},
    pageScrollTo() {},
    setClipboardData() {},
    navigateTo() {},
    navigateBack() {}
  }

  require(modulePath)
  page.setData = function setData(patch, callback) {
    for (const [key, value] of Object.entries(patch)) {
      const nested = key.match(/^params\.(.+)$/)
      if (nested) this.data.params[nested[1]] = value
      else this.data[key] = value
    }
    if (callback) callback()
  }
  return { page, storage, toasts }
}

function queryFromPath(sharePath) {
  const queryText = sharePath.split('?')[1] || ''
  return queryText.split('&').reduce((query, part) => {
    const separator = part.indexOf('=')
    if (separator > 0) query[part.slice(0, separator)] = part.slice(separator + 1)
    return query
  }, {})
}

// 所有材料工具都能生成短链接快照，并在接收端重新得到相同结果。
for (const tool of TOOLS) {
  const params = getDefaultParams(tool)
  const expected = calculate(tool.id, params)
  const encoded = encodeShareSnapshot({ toolId: tool.id, params })
  assert.ok(encoded, `${tool.id} 分享参数超过长度限制`)
  assert.ok(encoded.length <= MAX_SNAPSHOT_LENGTH)

  const loaded = loadCalculator()
  loaded.page.onLoad({ type: tool.id, snapshot: encoded })
  assert.strictEqual(loaded.page.data.loadedFromShare, true)
  assert.strictEqual(loaded.page.data.showResult, true)
  assert.deepStrictEqual(loaded.page.data.result.primary, expected.primary)
  assert.strictEqual(loaded.storage.get('renovation_calculation_history_v1'), undefined, '接收分享不得写入历史')

  const share = loaded.page.onShareAppMessage()
  assert.ok(share.title.includes(`${expected.primary.value}${expected.primary.unit}`))
  assert.ok(share.path.includes(`type=${tool.id}&snapshot=`))
}

// 分享只包含工具参数，不携带记录名称、预算单价或未知字段。
const privateDataProbe = encodeShareSnapshot({
  toolId: 'floorTile',
  params: { ...getDefaultParams(TOOLS[0]), unknown: 'ignore-me' },
  recordName: '主卫',
  budgetLines: [{ price: '999' }]
})
const probePage = loadCalculator()
probePage.page.onLoad({ type: 'floorTile', snapshot: privateDataProbe })
assert.strictEqual(Object.prototype.hasOwnProperty.call(probePage.page.data.params, 'unknown'), false)
const reshared = decodeShareSnapshot(queryFromPath(probePage.page.onShareAppMessage().path).snapshot)
assert.strictEqual(Object.prototype.hasOwnProperty.call(reshared, 'recordName'), false)
assert.strictEqual(Object.prototype.hasOwnProperty.call(reshared, 'budgetLines'), false)

// 损坏或工具不匹配的快照不能生成伪造结果，并给出明确提示。
for (const snapshot of [
  '%E0%A4%A',
  encodeShareSnapshot({ toolId: 'paint', params: getDefaultParams(TOOLS[0]) })
]) {
  const loaded = loadCalculator()
  loaded.page.onLoad({ type: 'floorTile', snapshot })
  assert.strictEqual(loaded.page.data.showResult, false)
  assert.strictEqual(loaded.page.data.result, null)
  assert.ok(loaded.toasts.includes('分享参数已失效，请重新填写'))
}

// 冷启动打开分享链接时，必须先明确同意协议，之后才能恢复参数和展示结果。
const gatedParams = getDefaultParams(TOOLS[0])
const gatedSnapshot = encodeShareSnapshot({ toolId: TOOLS[0].id, params: gatedParams })
let agreementAcceptedHandler = null
const gated = loadCalculator(new Map(), {
  showAgreementPrompt(callback) { agreementAcceptedHandler = callback },
  removeAgreementAcceptedCallback() {}
})
gated.page.onLoad({ type: TOOLS[0].id, snapshot: gatedSnapshot })
gated.page.onShow()
assert.strictEqual(gated.page.data.tool, null, '协议同意前不应初始化分享页')
assert.strictEqual(gated.page.data.showResult, false, '协议同意前不应展示分享结果')
assert.strictEqual(typeof agreementAcceptedHandler, 'function')
agreementAcceptedHandler()
assert.strictEqual(gated.page.data.loadedFromShare, true)
assert.strictEqual(gated.page.data.showResult, true)
assert.deepStrictEqual(gated.page.data.result.primary, calculate(TOOLS[0].id, gatedParams).primary)

console.log('Calculation result sharing tests passed')
