const assert = require('assert')
const { TOOLS, getDefaultParams } = require('../miniprogram/utils/tools')
const { calculate, parseNumber, getPlausibilityWarnings } = require('../miniprogram/utils/calculators')

assert.strictEqual(TOOLS.length, 10, '首版应包含10个计算工具')
assert.strictEqual(new Set(TOOLS.map(tool => tool.id)).size, TOOLS.length, '工具ID不得重复')
assert.strictEqual(new Set(TOOLS.map(tool => tool.visualType)).size, TOOLS.length, '每个工具应有独立的顶部施工示意图')

for (const tool of TOOLS) {
  assert.ok(tool.name && tool.subtitle && tool.scene, `${tool.id}缺少产品文案`)
  assert.ok(tool.visualType && tool.visualTitle && tool.visualLabel, `${tool.id}缺少顶部视觉配置`)
  assert.ok(tool.fields.length >= 6, `${tool.id}字段过少`)
  assert.strictEqual(new Set(tool.fields.map(field => field.key)).size, tool.fields.length, `${tool.id}存在重复字段`)

  const result = calculate(tool.id, getDefaultParams(tool))
  assert.ok(!result.error, `${tool.id}默认参数计算失败：${result.error}`)
  assert.ok(Number.isFinite(Number(result.primary.value)), `${tool.id}主结果不是有限数字`)
  assert.ok(result.primary.hint, `${tool.id}缺少主结果口径说明`)
  assert.ok(['net', 'waste', 'purchase'].includes(result.primary.stage), `${tool.id}主结果阶段不明确`)
  assert.ok(Array.isArray(result.layoutPlans), `${tool.id}排布方案格式错误`)
  assert.ok(result.metrics.length >= 4, `${tool.id}缺少关键中间量`)
  assert.ok(result.purchases.length >= 1, `${tool.id}缺少采购清单`)
  assert.ok(result.formula.length >= 3, `${tool.id}缺少公式说明`)
  result.purchases.forEach(item => {
    assert.ok(Number.isFinite(Number(item.quantity)), `${tool.id}/${item.label}采购量无效`)
    assert.ok(Number(item.quantity) >= 0, `${tool.id}/${item.label}采购量为负数`)
  })
}

// 严格数字解析：禁止部分字符串被误读成合法数值
assert.strictEqual(parseNumber('12.5'), 12.5)
assert.strictEqual(parseNumber('.75'), 0.75)
assert.ok(Number.isNaN(parseNumber('12abc')))
assert.ok(Number.isNaN(parseNumber('1.2.3')))
assert.ok(Number.isNaN(parseNumber('')))

// 地砖：5m×4m、800砖、2mm缝，无扣除时按7×5排布，损耗后38片，即13箱
let result = calculate('floorTile', getDefaultParams(TOOLS.find(tool => tool.id === 'floorTile')))
assert.strictEqual(result.primary.value, 13)
assert.strictEqual(result.metrics.find(item => item.label === '含损耗需用').value, 38)
assert.strictEqual(result.metrics.find(item => item.label === '整箱实购').value, 39)

// 砖缝排布边界：2块800mm砖加1条2mm缝只覆盖1602mm，1604mm跨度必须用3块
let params = getDefaultParams(TOOLS.find(tool => tool.id === 'floorTile'))
params.length = '1.604'
params.width = '0.8'
params.wasteRate = '0'
params.piecesPerBox = '1'
result = calculate('floorTile', params)
assert.strictEqual(result.primary.value, 3)

// 木地板：20㎡×1.07÷2.2㎡/包，向上取10包
result = calculate('flooring', getDefaultParams(TOOLS.find(tool => tool.id === 'flooring')))
assert.strictEqual(result.primary.value, 10)
assert.strictEqual(result.metrics.find(item => item.label === '净铺装面积').value, 20)

// 乳胶漆：墙顶净面积65.4㎡，两遍、10㎡/L、5%余量，面漆13.734L，5L装为3桶
result = calculate('paint', getDefaultParams(TOOLS.find(tool => tool.id === 'paint')))
assert.strictEqual(result.primary.value, 3)
assert.strictEqual(result.metrics.find(item => item.label === '墙顶净涂刷面积').value, 65.4)
assert.strictEqual(result.metrics.find(item => item.label === '面漆理论需求').value, 13.73)

// 壁纸：按18m墙长和0.53m卷宽需34条，加5%损耗为36条，每卷3条，最终12卷
result = calculate('wallpaper', getDefaultParams(TOOLS.find(tool => tool.id === 'wallpaper')))
assert.strictEqual(result.primary.value, 12)
assert.strictEqual(result.metrics.find(item => item.label === '每卷可裁').value, 3)
assert.strictEqual(result.metrics.find(item => item.label === '墙长基础裁条').value, 34)
assert.strictEqual(result.purchases.find(item => item.label === '壁纸胶').quantity, 3)

// 对花必须把裁切长度向花距的整数倍上取整
params = getDefaultParams(TOOLS.find(tool => tool.id === 'wallpaper'))
params.patternRepeat = '64'
result = calculate('wallpaper', params)
assert.strictEqual(result.metrics.find(item => item.label === '单条裁切长度').value, 3.2)

// 防水：6㎡地面+16.5㎡净墙面，两遍0.75kg/㎡，含8%余量=36.45kg，18kg装为3桶
result = calculate('waterproof', getDefaultParams(TOOLS.find(tool => tool.id === 'waterproof')))
assert.strictEqual(result.primary.value, 3)
assert.strictEqual(result.metrics.find(item => item.label === '防水总面积').value, 22.5)
assert.strictEqual(result.metrics.find(item => item.label === '理论材料用量').value, 36.45)

// 吊顶：5000/600向上9行，4000/600向上7列，63片加8%损耗为69片，8片/包为9包
result = calculate('ceiling', getDefaultParams(TOOLS.find(tool => tool.id === 'ceiling')))
assert.strictEqual(result.primary.value, 9)
assert.strictEqual(result.metrics.find(item => item.label === '含损耗面板').value, 69)

// 墙砖默认存在门窗扣除，但未确认具体能少铺的整砖时仍按完整排布保守采购
result = calculate('wallTile', getDefaultParams(TOOLS.find(tool => tool.id === 'wallTile')))
assert.strictEqual(result.primary.value, 19)

// 小面积扣除不会自动把整砖片数按面积折减；只有排版确认后才允许扣减整砖
params = getDefaultParams(TOOLS.find(tool => tool.id === 'floorTile'))
params.deductArea = '0.1'
result = calculate('floorTile', params)
assert.strictEqual(result.primary.value, 13)
params.deductPieces = '3'
result = calculate('floorTile', params)
assert.strictEqual(result.primary.value, 12)
params.deductPieces = '4'
assert.ok(calculate('floorTile', params).error.includes('不能超过3片'))

// 壁纸只允许扣除按墙面分段确认能够完整少裁的条数
params = getDefaultParams(TOOLS.find(tool => tool.id === 'wallpaper'))
params.deductStrips = '3'
assert.strictEqual(calculate('wallpaper', params).primary.value, 11)
params.deductStrips = '4'
assert.ok(calculate('wallpaper', params).error.includes('不能超过3条'))

// 找平和混凝土体积口径
result = calculate('screed', getDefaultParams(TOOLS.find(tool => tool.id === 'screed')))
assert.strictEqual(result.primary.value, 0.6)
result = calculate('concrete', getDefaultParams(TOOLS.find(tool => tool.id === 'concrete')))
assert.strictEqual(result.primary.value, 1.26)

// 非法边界：扣除面积不可吃掉全部毛面积；整数字段不接受小数；高级参数不可为0
params = getDefaultParams(TOOLS.find(tool => tool.id === 'floorTile'))
params.deductArea = '20'
assert.ok(calculate('floorTile', params).error.includes('必须小于毛面积'))

params = getDefaultParams(TOOLS.find(tool => tool.id === 'floorTile'))
params.piecesPerBox = '3.5'
assert.ok(calculate('floorTile', params).error.includes('必须填写整数'))

params = getDefaultParams(TOOLS.find(tool => tool.id === 'paint'))
params.topCoverage = '0'
assert.ok(calculate('paint', params).error)

params = getDefaultParams(TOOLS.find(tool => tool.id === 'wallpaper'))
params.rollLength = '2'
assert.ok(calculate('wallpaper', params).error.includes('不足以裁出一条'))

assert.ok(calculate('missingTool', {}).error)

// 门窗只允许从墙面扣除，不能借用顶面面积抵扣不可能存在的门窗。
params = getDefaultParams(TOOLS.find(tool => tool.id === 'paint'))
params.perimeter = '2'
params.height = '2'
params.ceilingArea = '20'
params.deductArea = '10'
assert.ok(calculate('paint', params).error.includes('必须小于毛面积 4㎡'))

// 超出常见住宅范围时不直接阻断，但必须返回明确的单位复核提示。
params = getDefaultParams(TOOLS.find(tool => tool.id === 'paint'))
params.height = '280'
const plausibilityWarnings = getPlausibilityWarnings('paint', params)
assert.strictEqual(plausibilityWarnings.length, 1)
assert.strictEqual(plausibilityWarnings[0].field, 'height')
assert.ok(plausibilityWarnings[0].message.includes('厘米填成了米'))
assert.ok(calculate('paint', params).warnings.some(item => item.includes('厘米填成了米')))

// 矩形材料同时展示当前与旋转90°两种方向，不静默替用户改变排版。
params = getDefaultParams(TOOLS.find(tool => tool.id === 'floorTile'))
Object.assign(params, { length: '5', width: '3.2', tileLength: '1200', tileWidth: '600', piecesPerBox: '8' })
result = calculate('floorTile', params)
assert.deepStrictEqual(result.layoutPlans.map(item => item.quantity), [5, 4])
assert.strictEqual(result.layoutPlans[0].selected, true)
assert.strictEqual(result.layoutPlans[1].action, 'swapTileSize')

params = getDefaultParams(TOOLS.find(tool => tool.id === 'ceiling'))
Object.assign(params, { length: '5', width: '3.2', panelLength: '1200', panelWidth: '600' })
result = calculate('ceiling', params)
assert.deepStrictEqual(result.layoutPlans.map(item => item.quantity), [5, 4])
assert.strictEqual(result.layoutPlans[1].action, 'swapPanelSize')

console.log('All renovation material calculator tests passed')
