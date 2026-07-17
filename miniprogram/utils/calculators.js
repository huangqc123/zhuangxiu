const { getTool } = require('./tools')

const NUMBER_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)$/

function parseNumber(value) {
  const text = String(value == null ? '' : value).trim()
  if (!NUMBER_PATTERN.test(text)) return NaN
  const number = Number(text)
  return Number.isFinite(number) ? number : NaN
}

function round(value, digits = 2) {
  const factor = Math.pow(10, digits)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function ceil(value) {
  return Math.ceil(value - 1e-10)
}

function percent(value) {
  return value / 100
}

// N块材料形成N块本体和N-1条缝，因此覆盖长度为 N×材料尺寸+(N-1)×缝宽。
function layoutCount(spanMm, itemMm, jointMm) {
  return ceil((spanMm + jointMm) / (itemMm + jointMm))
}

function metric(label, value, unit, options = {}) {
  return {
    label,
    value: typeof value === 'number' ? round(value, options.digits == null ? 2 : options.digits) : value,
    unit,
    emphasis: Boolean(options.emphasis),
    hint: options.hint || '',
    stage: options.stage || ''
  }
}

function purchase(label, quantity, unit, detail) {
  return { label, quantity, unit, detail: detail || '' }
}

function validateAndNormalize(toolId, params) {
  const tool = getTool(toolId)
  if (!tool) return { error: '未找到对应计算工具' }
  const values = {}

  for (const item of tool.fields) {
    const value = parseNumber(params[item.key])
    if (!Number.isFinite(value)) {
      return { error: `“${item.label}”请输入有效数字`, field: item.key }
    }
    if (value < item.min || value > item.max) {
      const scope = item.allowZero ? `${item.min}～${item.max}` : `大于0且不超过${item.max}`
      return { error: `“${item.label}”应为${scope}`, field: item.key }
    }
    if (item.digits === 0 && !Number.isInteger(value)) {
      return { error: `“${item.label}”必须填写整数`, field: item.key }
    }
    values[item.key] = value
  }

  return { tool, values }
}

function getPlausibilityWarnings(toolId, params) {
  const tool = getTool(toolId)
  if (!tool) return []

  return tool.fields.reduce((warnings, item) => {
    const value = parseNumber(params && params[item.key])
    if (!Number.isFinite(value)) return warnings
    const tooSmall = item.sensibleMin != null && value < item.sensibleMin
    const tooLarge = item.sensibleMax != null && value > item.sensibleMax
    if (tooSmall || tooLarge) {
      warnings.push({
        field: item.key,
        message: item.sensibleMessage || `“${item.label}”超出常见装修场景范围，请确认数值和单位。`
      })
    }
    return warnings
  }, [])
}

function assertNetArea(grossArea, deductArea, label = '扣除面积') {
  if (deductArea >= grossArea) {
    return `${label}必须小于毛面积 ${round(grossArea, 2)}㎡`
  }
  return ''
}

function resultBase(tool, primary, metrics, purchases, formula, assumptions, warnings = [], layoutPlans = []) {
  return {
    toolId: tool.id,
    toolName: tool.name,
    accent: tool.accent,
    calculatedAt: Date.now(),
    primary,
    metrics,
    purchases,
    formula,
    assumptions,
    warnings,
    layoutPlans,
    disclaimer: '结果为材料采购概算。实际用量还受排版、基层平整度、施工工艺、产品规格和现场损耗影响，请以深化排版及产品说明为准。'
  }
}

function calculateFloorTile(tool, v) {
  const grossArea = v.length * v.width
  const areaError = assertNetArea(grossArea, v.deductArea, '不铺贴面积')
  if (areaError) return { error: areaError, field: 'deductArea' }

  const netArea = grossArea - v.deductArea
  const tileArea = v.tileLength * v.tileWidth / 1000000
  const rows = layoutCount(v.length * 1000, v.tileLength, v.jointWidth)
  const columns = layoutCount(v.width * 1000, v.tileWidth, v.jointWidth)
  const layoutPieces = rows * columns
  const areaPieces = ceil(netArea / tileArea)
  const maxDeductPieces = v.deductArea > 0 ? Math.max(0, layoutPieces - areaPieces) : 0
  if (v.deductPieces > maxDeductPieces) {
    return {
      error: `确认可少铺整砖不能超过${maxDeductPieces}片，请按实际排版填写`,
      field: 'deductPieces'
    }
  }
  const basePieces = layoutPieces - v.deductPieces
  const requiredPieces = ceil(basePieces * (1 + percent(v.wasteRate)))
  const boxes = ceil(requiredPieces / v.piecesPerBox)
  const purchasedPieces = boxes * v.piecesPerBox
  const adhesiveKg = netArea * v.adhesiveRate * 1.05
  const adhesiveBags = ceil(adhesiveKg / v.adhesiveBag)
  const groutKg = netArea * v.groutRate * 1.1
  const groutBags = ceil(groutKg / v.groutBag)
  const rotatedRows = layoutCount(v.length * 1000, v.tileWidth, v.jointWidth)
  const rotatedColumns = layoutCount(v.width * 1000, v.tileLength, v.jointWidth)
  const rotatedLayoutPieces = rotatedRows * rotatedColumns
  const rotatedMaxDeductPieces = v.deductArea > 0 ? Math.max(0, rotatedLayoutPieces - areaPieces) : 0
  const rotatedDeductPieces = v.deductPieces <= rotatedMaxDeductPieces ? v.deductPieces : 0
  const rotatedBasePieces = rotatedLayoutPieces - rotatedDeductPieces
  const rotatedRequiredPieces = ceil(rotatedBasePieces * (1 + percent(v.wasteRate)))
  const rotatedBoxes = ceil(rotatedRequiredPieces / v.piecesPerBox)
  const layoutPlans = v.tileLength === v.tileWidth ? [] : [
    {
      id: 'current',
      name: '方案 A · 当前方向',
      layout: `${rows} × ${columns}`,
      quantity: boxes,
      unit: '箱',
      selected: true
    },
    {
      id: 'rotated',
      name: '方案 B · 旋转90°',
      layout: `${rotatedRows} × ${rotatedColumns}`,
      quantity: rotatedBoxes,
      unit: '箱',
      action: 'swapTileSize',
      note: v.deductPieces ? '采用后将清零并重新确认少铺整砖' : ''
    }
  ]

  return resultBase(
    tool,
    metric('建议采购', boxes, '箱', { digits: 0, emphasis: true, hint: `按${v.piecesPerBox}片/箱向上取整`, stage: 'purchase' }),
    [
      metric('毛面积', grossArea, '㎡'),
      metric('净铺贴面积', netArea, '㎡', { emphasis: true }),
      metric('无扣除排布', `${rows} × ${columns}`, '行列'),
      metric('确认少铺整砖', v.deductPieces, '片', { digits: 0 }),
      metric('含损耗需用', requiredPieces, '片', { digits: 0 }),
      metric('整箱实购', purchasedPieces, '片', { digits: 0 }),
      metric('实购覆盖面积', purchasedPieces * tileArea, '㎡')
    ],
    [
      purchase('地砖', boxes, '箱', `${purchasedPieces}片，按每箱${v.piecesPerBox}片`),
      purchase('瓷砖胶', adhesiveBags, '袋', `理论约${round(adhesiveKg, 1)}kg`),
      purchase('填缝剂', groutBags, '袋', `理论约${round(groutKg, 1)}kg`)
    ],
    [
      `净面积 = ${v.length} × ${v.width} - ${v.deductArea} = ${round(netArea, 2)}㎡`,
      `整砖排布 = ${rows} × ${columns} = ${layoutPieces}片`,
      `基础片数 = 整砖排布 - 确认可少铺${v.deductPieces}片 = ${basePieces}片`,
      `需用片数 = 基础片数 × (1 + ${v.wasteRate}%)，再向上取整`,
      `采购箱数 = 需用片数 ÷ ${v.piecesPerBox}片/箱，向上取整`
    ],
    [
      `瓷砖损耗率采用${v.wasteRate}%`,
      '辅料在单位用量基础上另计5%瓷砖胶余量、10%填缝剂余量',
      '不铺贴面积用于计算净面积和辅料；砖片数默认按完整排布保守估算',
      '只有排版后确认能完整减少的砖片，才应填写“确认可少铺整砖”',
      '复杂排版、斜铺、波打线应按深化图复核'
    ],
    [],
    layoutPlans
  )
}

function calculateWallTile(tool, v) {
  const grossArea = v.perimeter * v.height
  const areaError = assertNetArea(grossArea, v.deductArea, '门窗及空洞面积')
  if (areaError) return { error: areaError, field: 'deductArea' }

  const netArea = grossArea - v.deductArea
  const tileArea = v.tileLength * v.tileWidth / 1000000
  const rows = layoutCount(v.height * 1000, v.tileWidth, v.jointWidth)
  const columns = layoutCount(v.perimeter * 1000, v.tileLength, v.jointWidth)
  const layoutPieces = rows * columns
  const areaPieces = ceil(netArea / tileArea)
  const maxDeductPieces = v.deductArea > 0 ? Math.max(0, layoutPieces - areaPieces) : 0
  if (v.deductPieces > maxDeductPieces) {
    return {
      error: `确认可少铺整砖不能超过${maxDeductPieces}片，请按实际排版填写`,
      field: 'deductPieces'
    }
  }
  const basePieces = layoutPieces - v.deductPieces
  const requiredPieces = ceil(basePieces * (1 + percent(v.wasteRate)))
  const boxes = ceil(requiredPieces / v.piecesPerBox)
  const purchasedPieces = boxes * v.piecesPerBox
  const adhesiveKg = netArea * v.adhesiveRate * 1.05
  const groutKg = netArea * v.groutRate * 1.1
  const adhesiveBags = ceil(adhesiveKg / v.adhesiveBag)
  const groutBags = ceil(groutKg / v.groutBag)

  return resultBase(
    tool,
    metric('建议采购', boxes, '箱', { digits: 0, emphasis: true, hint: `按${v.piecesPerBox}片/箱向上取整`, stage: 'purchase' }),
    [
      metric('墙面毛面积', grossArea, '㎡'),
      metric('净铺贴面积', netArea, '㎡', { emphasis: true }),
      metric('无扣除排布', `${rows} × ${columns}`, '行列'),
      metric('确认少铺整砖', v.deductPieces, '片', { digits: 0 }),
      metric('含损耗需用', requiredPieces, '片', { digits: 0 }),
      metric('整箱实购', purchasedPieces, '片', { digits: 0 })
    ],
    [
      purchase('墙砖', boxes, '箱', `${purchasedPieces}片，按每箱${v.piecesPerBox}片`),
      purchase('瓷砖胶', adhesiveBags, '袋', `理论约${round(adhesiveKg, 1)}kg`),
      purchase('填缝剂', groutBags, '袋', `理论约${round(groutKg, 1)}kg`)
    ],
    [
      `净面积 = ${v.perimeter} × ${v.height} - ${v.deductArea} = ${round(netArea, 2)}㎡`,
      `基础片数 = ${layoutPieces}片整墙排布 - 确认可少铺${v.deductPieces}片 = ${basePieces}片`,
      `加入${v.wasteRate}%损耗后为${requiredPieces}片`,
      `采购箱数 = ${requiredPieces} ÷ ${v.piecesPerBox}，向上取整`
    ],
    [
      '墙面总长度应为实际需要铺贴的各段墙长之和',
      '门窗面积用于净面积和辅料；砖片数默认按完整墙面排布保守估算',
      '只有排版后确认能完整减少的砖片，才应填写“确认可少铺整砖”',
      '阳角碰角、壁龛、腰线、异形切割会增加损耗',
      '辅料单位用量应以基层、齿形刮板和产品说明为准'
    ]
  )
}

function calculateFlooring(tool, v) {
  const grossArea = v.length * v.width
  const areaError = assertNetArea(grossArea, v.deductArea, '不铺装面积')
  if (areaError) return { error: areaError, field: 'deductArea' }

  const netArea = grossArea - v.deductArea
  const targetArea = netArea * (1 + percent(v.wasteRate))
  const packages = ceil(targetArea / v.packageArea)
  const purchaseArea = packages * v.packageArea
  const perimeter = 2 * (v.length + v.width)
  if (v.doorWidth >= perimeter) return { error: '门洞宽度合计必须小于房间周长', field: 'doorWidth' }
  const skirtingMeters = (perimeter - v.doorWidth) * (1 + percent(v.skirtingWaste))
  const skirtingPieces = ceil(skirtingMeters / v.skirtingLength)
  const underlayArea = netArea * (1 + percent(v.underlayWaste))

  return resultBase(
    tool,
    metric('建议采购', packages, '包', { digits: 0, emphasis: true, hint: `按${v.packageArea}㎡/包向上取整`, stage: 'purchase' }),
    [
      metric('净铺装面积', netArea, '㎡', { emphasis: true }),
      metric('含损耗需求面积', targetArea, '㎡'),
      metric('整包采购面积', purchaseArea, '㎡'),
      metric('预计剩余面积', purchaseArea - targetArea, '㎡'),
      metric('踢脚线净长度', perimeter - v.doorWidth, 'm'),
      metric('地膜需求面积', underlayArea, '㎡')
    ],
    [
      purchase('木地板', packages, '包', `按${v.packageArea}㎡/包，共${round(purchaseArea, 2)}㎡`),
      purchase('踢脚线', skirtingPieces, '根', `按${v.skirtingLength}m/根`),
      purchase('防潮地膜', round(underlayArea, 1), '㎡', '按卷材实际规格向上采购')
    ],
    [
      `净面积 = ${v.length} × ${v.width} - ${v.deductArea} = ${round(netArea, 2)}㎡`,
      `地板需求面积 = 净面积 × (1 + ${v.wasteRate}%)`,
      `采购包数 = 需求面积 ÷ ${v.packageArea}㎡/包，向上取整`,
      `踢脚线 = (房间周长 - 门洞宽度) × (1 + ${v.skirtingWaste}%)`
    ],
    [
      '人字拼、鱼骨拼、斜铺和跨房间通铺通常需要提高损耗率',
      '每包覆盖面积必须以实际产品包装为准',
      '踢脚线未扣除固定柜体贴墙段，可按现场情况调整门洞宽度合计'
    ]
  )
}

function calculatePaint(tool, v) {
  const wallArea = v.perimeter * v.height
  const grossArea = wallArea + v.ceilingArea
  const areaError = assertNetArea(wallArea, v.deductArea, '门窗扣除面积')
  if (areaError) return { error: areaError, field: 'deductArea' }

  const netArea = grossArea - v.deductArea
  const reserve = 1 + percent(v.wasteRate)
  const topLiters = netArea * v.topCoats / v.topCoverage * reserve
  const topBuckets = ceil(topLiters / v.topBucket)
  const primerLiters = v.primerCoats === 0 ? 0 : netArea * v.primerCoats / v.primerCoverage * reserve
  const primerBuckets = v.primerCoats === 0 ? 0 : ceil(primerLiters / v.primerBucket)
  const puttyKg = netArea * v.puttyRate * reserve
  const puttyBags = v.puttyRate === 0 ? 0 : ceil(puttyKg / v.puttyBag)

  return resultBase(
    tool,
    metric('面漆建议采购', topBuckets, '桶', { digits: 0, emphasis: true, hint: `按${v.topBucket}L/桶向上取整`, stage: 'purchase' }),
    [
      metric('墙面展开面积', wallArea, '㎡'),
      metric('墙顶净涂刷面积', netArea, '㎡', { emphasis: true }),
      metric('面漆理论需求', topLiters, 'L'),
      metric('底漆理论需求', primerLiters, 'L'),
      metric('腻子理论需求', puttyKg, 'kg')
    ],
    [
      purchase('面漆', topBuckets, '桶', `按${v.topBucket}L/桶，理论${round(topLiters, 1)}L`),
      purchase('底漆', primerBuckets, '桶', v.primerCoats ? `按${v.primerBucket}L/桶，理论${round(primerLiters, 1)}L` : '本次设置为不使用底漆'),
      purchase('腻子', puttyBags, '袋', v.puttyRate ? `按${v.puttyBag}kg/袋，理论${round(puttyKg, 1)}kg` : '本次设置为不计腻子')
    ],
    [
      `净面积 = 墙周长 × 墙高 + 顶面 - 门窗 = ${round(netArea, 2)}㎡`,
      `面漆 = 净面积 × ${v.topCoats}遍 ÷ ${v.topCoverage}㎡/L × (1 + ${v.wasteRate}%)`,
      `底漆 = 净面积 × ${v.primerCoats}遍 ÷ ${v.primerCoverage}㎡/L × (1 + ${v.wasteRate}%)`,
      '采购桶数均按单桶容量向上取整'
    ],
    [
      `面漆按${v.topCoats}遍、底漆按${v.primerCoats}遍计算`,
      '深色换浅色、粗糙或高吸水基层会降低实际覆盖率',
      '不同产品标注的“理论涂布率”口径可能不同，应优先使用同一产品技术数据'
    ]
  )
}

function calculateWallpaper(tool, v) {
  const grossArea = v.perimeter * v.height
  const areaError = assertNetArea(grossArea, v.deductArea, '门窗扣除面积')
  if (areaError) return { error: areaError, field: 'deductArea' }

  const netArea = grossArea - v.deductArea
  const rawCutLength = v.height + v.trimAllowance / 100
  const repeat = v.patternRepeat / 100
  const cutLength = repeat > 0 ? ceil(rawCutLength / repeat) * repeat : rawCutLength
  const stripsPerRoll = Math.floor(v.rollLength / cutLength)
  if (stripsPerRoll < 1) {
    return { error: `每卷长度不足以裁出一条${round(cutLength, 2)}m壁纸`, field: 'rollLength' }
  }

  const fullStrips = ceil(v.perimeter / v.rollWidth)
  const areaMinimumStrips = ceil(netArea / (v.rollWidth * v.height))
  const maxDeductStrips = Math.max(0, fullStrips - areaMinimumStrips)
  if (v.deductStrips > maxDeductStrips) {
    return {
      error: `确认可少裁整条不能超过${maxDeductStrips}条，请按实际墙面分段填写`,
      field: 'deductStrips'
    }
  }
  const baseStrips = fullStrips - v.deductStrips
  const requiredStrips = ceil(baseStrips * (1 + percent(v.wasteRate)))
  const rolls = ceil(requiredStrips / stripsPerRoll)
  const availableStrips = rolls * stripsPerRoll
  const glueArea = netArea * 1.05
  const gluePacks = ceil(glueArea / v.glueCoverage)

  return resultBase(
    tool,
    metric('建议采购', rolls, '卷', { digits: 0, emphasis: true, hint: `按${v.rollWidth}m × ${v.rollLength}m/卷向上取整`, stage: 'purchase' }),
    [
      metric('净铺贴面积', netArea, '㎡', { emphasis: true }),
      metric('单条裁切长度', cutLength, 'm'),
      metric('每卷可裁', stripsPerRoll, '条', { digits: 0 }),
      metric('墙长基础裁条', fullStrips, '条', { digits: 0 }),
      metric('确认少裁整条', v.deductStrips, '条', { digits: 0 }),
      metric('含损耗需用', requiredStrips, '条', { digits: 0 }),
      metric('整卷可供', availableStrips, '条', { digits: 0 })
    ],
    [
      purchase('壁纸', rolls, '卷', `${v.rollWidth}m × ${v.rollLength}m/卷`),
      purchase('壁纸胶', gluePacks, '包', `按${v.glueCoverage}㎡/包，含5%施工余量`)
    ],
    [
      `净面积 = ${v.perimeter} × ${v.height} - ${v.deductArea} = ${round(netArea, 2)}㎡`,
      repeat > 0
        ? `裁切长度按${v.patternRepeat}cm花距向上对齐：${round(cutLength, 2)}m/条`
        : `裁切长度 = 墙高 + ${v.trimAllowance}cm余量 = ${round(cutLength, 2)}m/条`,
      `墙长基础裁条 = ceil(${v.perimeter} ÷ ${v.rollWidth}) = ${fullStrips}条`,
      `扣除确认可少裁${v.deductStrips}条后，加入${v.wasteRate}%损耗为${requiredStrips}条`,
      `每卷可裁 = 向下取整(${v.rollLength} ÷ ${round(cutLength, 2)}) = ${stripsPerRoll}条`,
      `卷数 = 含损耗条数 ÷ 每卷条数，向上取整`
    ],
    [
      '壁纸条数按墙面总长度保守计算，门窗面积只用于净面积和壁纸胶用量',
      '只有门洞等确定能完整少裁的整条，才应填写“确认可少裁整条”',
      `每条上下裁切余量合计按${v.trimAllowance}cm计算`,
      v.patternRepeat > 0 ? `已按${v.patternRepeat}cm花距考虑对花` : '当前按无对花壁纸计算'
    ]
  )
}

function calculateWaterproof(tool, v) {
  const floorArea = v.length * v.width
  const perimeter = 2 * (v.length + v.width)
  const wallArea = perimeter * v.upturnHeight
  if (v.deductArea >= wallArea) {
    return { error: `墙面扣除面积必须小于墙面毛面积 ${round(wallArea, 2)}㎡`, field: 'deductArea' }
  }
  const netArea = floorArea + wallArea - v.deductArea
  const materialKg = netArea * v.coats * v.ratePerCoat * (1 + percent(v.wasteRate))
  const buckets = ceil(materialKg / v.bucketWeight)

  return resultBase(
    tool,
    metric('建议采购', buckets, '桶', { digits: 0, emphasis: true, hint: `按${v.bucketWeight}kg/桶向上取整`, stage: 'purchase' }),
    [
      metric('地面防水面积', floorArea, '㎡'),
      metric('墙面防水面积', wallArea - v.deductArea, '㎡'),
      metric('防水总面积', netArea, '㎡', { emphasis: true }),
      metric('理论材料用量', materialKg, 'kg'),
      metric('整桶采购重量', buckets * v.bucketWeight, 'kg')
    ],
    [
      purchase('防水涂料', buckets, '桶', `按${v.bucketWeight}kg/桶，理论${round(materialKg, 1)}kg`)
    ],
    [
      `地面面积 = ${v.length} × ${v.width} = ${round(floorArea, 2)}㎡`,
      `墙面面积 = 周长 × ${v.upturnHeight} - ${v.deductArea} = ${round(wallArea - v.deductArea, 2)}㎡`,
      `材料量 = 总面积 × ${v.coats}遍 × ${v.ratePerCoat}kg/㎡·遍 × (1 + ${v.wasteRate}%)`
    ],
    [
      '墙面涂刷高度按同一高度估算，淋浴区与非淋浴区高度不同应拆分计算',
      '阴阳角、管根、地漏等附加层未单独计量，已通过施工余量部分覆盖',
      '设计厚度、基层含水率和产品固含量会显著影响实际单位用量'
    ],
    ['防水构造和涂膜厚度必须满足设计文件及现行规范，不能仅凭桶数确定施工质量。']
  )
}

function calculateCeiling(tool, v) {
  const area = v.length * v.width
  const rows = ceil(v.length * 1000 / v.panelLength)
  const columns = ceil(v.width * 1000 / v.panelWidth)
  const basePanels = rows * columns
  const requiredPanels = ceil(basePanels * (1 + percent(v.wasteRate)))
  const packs = ceil(requiredPanels / v.panelsPerPack)
  const perimeter = 2 * (v.length + v.width)
  const trimMeters = perimeter * 1.05
  const trimPieces = ceil(trimMeters / v.trimLength)

  const mainLines = Math.max(2, ceil(v.width / v.mainSpacing) + 1)
  const secondaryLines = Math.max(2, ceil(v.length / v.secondarySpacing) + 1)
  const mainMeters = mainLines * v.length * 1.05
  const secondaryMeters = secondaryLines * v.width * 1.05
  const mainPieces = ceil(mainMeters / v.stockLength)
  const secondaryPieces = ceil(secondaryMeters / v.stockLength)
  const hangersPerLine = ceil(v.length / v.hangerSpacing) + 1
  const hangers = mainLines * hangersPerLine
  const rotatedRows = ceil(v.length * 1000 / v.panelWidth)
  const rotatedColumns = ceil(v.width * 1000 / v.panelLength)
  const rotatedBasePanels = rotatedRows * rotatedColumns
  const rotatedRequiredPanels = ceil(rotatedBasePanels * (1 + percent(v.wasteRate)))
  const rotatedPacks = ceil(rotatedRequiredPanels / v.panelsPerPack)
  const layoutPlans = v.panelLength === v.panelWidth ? [] : [
    {
      id: 'current',
      name: '方案 A · 当前方向',
      layout: `${rows} × ${columns}`,
      quantity: packs,
      unit: '包',
      selected: true
    },
    {
      id: 'rotated',
      name: '方案 B · 旋转90°',
      layout: `${rotatedRows} × ${rotatedColumns}`,
      quantity: rotatedPacks,
      unit: '包',
      action: 'swapPanelSize'
    }
  ]

  return resultBase(
    tool,
    metric('面板建议采购', packs, '包', { digits: 0, emphasis: true, hint: `按${v.panelsPerPack}片/包向上取整`, stage: 'purchase' }),
    [
      metric('吊顶面积', area, '㎡', { emphasis: true }),
      metric('面板排布', `${rows} × ${columns}`, '行列'),
      metric('含损耗面板', requiredPanels, '片', { digits: 0 }),
      metric('主龙骨估算', mainMeters, 'm'),
      metric('次龙骨估算', secondaryMeters, 'm'),
      metric('吊点估算', hangers, '个', { digits: 0 })
    ],
    [
      purchase('吊顶面板', packs, '包', `${packs * v.panelsPerPack}片，按${v.panelsPerPack}片/包`),
      purchase('收边条', trimPieces, '根', `按${v.trimLength}m/根`),
      purchase('主龙骨', mainPieces, '根', `按${v.stockLength}m/根，估算${round(mainMeters, 1)}m`),
      purchase('次龙骨', secondaryPieces, '根', `按${v.stockLength}m/根，估算${round(secondaryMeters, 1)}m`),
      purchase('吊杆/吊件', hangers, '套', '未计设备加固和转换层')
    ],
    [
      `面板基础片数 = ceil(${v.length}m ÷ ${v.panelLength}mm) × ceil(${v.width}m ÷ ${v.panelWidth}mm)`,
      `面板需用 = ${basePanels} × (1 + ${v.wasteRate}%) = ${requiredPanels}片`,
      `主龙骨按${v.mainSpacing}m间距、次龙骨按${v.secondarySpacing}m间距网格估算`,
      `龙骨和收边条长度另计5%接头余量`
    ],
    [
      '本结果为规则网格概算，灯具、风口、检修口和跌级造型均未展开',
      '龙骨间距、吊点间距和构造必须由系统厂家及设计文件确定',
      '石膏板与集成吊顶的龙骨体系不同，采购前应按实际系统调整参数'
    ],
    ['吊顶承载、吊杆锚固及设备加固属于安全构造，必须按设计和厂家系统要求实施。'],
    layoutPlans
  )
}

function calculateBrickWall(tool, v) {
  const grossArea = v.length * v.height
  const areaError = assertNetArea(grossArea, v.deductArea, '门窗洞口面积')
  if (areaError) return { error: areaError, field: 'deductArea' }

  const netArea = grossArea - v.deductArea
  const moduleArea = (v.blockLength + v.jointWidth) * (v.blockHeight + v.jointWidth) / 1000000
  const baseBlocks = ceil(netArea / moduleArea)
  const requiredBlocks = ceil(baseBlocks * (1 + percent(v.wasteRate)))
  const wallVolume = netArea * v.wallThickness / 1000
  const mortarKg = netArea * v.mortarRate * 1.05
  const mortarBags = ceil(mortarKg / v.mortarBag)
  const warnings = []
  if (Math.abs(v.blockWidth - v.wallThickness) > 5) {
    warnings.push(`砌块厚度${v.blockWidth}mm与墙体厚度${v.wallThickness}mm不一致，请确认是否为抹灰前墙厚。`)
  }

  return resultBase(
    tool,
    metric('砌块建议采购', requiredBlocks, '块', { digits: 0, emphasis: true, hint: `已含${v.wasteRate}%损耗并按整块取整`, stage: 'waste' }),
    [
      metric('墙面毛面积', grossArea, '㎡'),
      metric('墙面净面积', netArea, '㎡', { emphasis: true }),
      metric('墙体净体积', wallVolume, 'm³'),
      metric('无损耗砌块', baseBlocks, '块', { digits: 0 }),
      metric('砂浆理论需求', mortarKg, 'kg')
    ],
    [
      purchase('砌块', requiredBlocks, '块', `${v.blockLength}×${v.blockHeight}×${v.blockWidth}mm`),
      purchase('砌筑砂浆', mortarBags, '袋', `按${v.mortarBag}kg/袋，理论${round(mortarKg, 1)}kg`)
    ],
    [
      `净面积 = ${v.length} × ${v.height} - ${v.deductArea} = ${round(netArea, 2)}㎡`,
      `砌块模数面积 = (${v.blockLength} + ${v.jointWidth}) × (${v.blockHeight} + ${v.jointWidth})mm`,
      `砌块数 = 净面积 ÷ 模数面积 × (1 + ${v.wasteRate}%)，向上取整`,
      `砂浆 = 净面积 × ${v.mortarRate}kg/㎡，另计5%余量`
    ],
    [
      '采用砌块长高加灰缝的模数面积计算块数',
      '砂浆按面积定额估算，薄层砂浆、专用粘结剂需改用产品用量',
      '构造柱、圈梁、拉结筋、过梁及抹灰材料不在本结果内'
    ],
    warnings
  )
}

function calculateScreed(tool, v) {
  const wetVolume = v.area * v.thickness / 1000
  const dryVolume = wetVolume * v.dryFactor * (1 + percent(v.wasteRate))
  const totalRatio = v.cementRatio + v.sandRatio
  const cementVolume = dryVolume * v.cementRatio / totalRatio
  const sandVolume = dryVolume * v.sandRatio / totalRatio
  const cementKg = cementVolume * v.cementDensity
  const sandKg = sandVolume * v.sandDensity
  const cementBags = ceil(cementKg / v.cementBag)

  return resultBase(
    tool,
    metric('湿砂浆净方量', wetVolume, 'm³', { digits: 3, emphasis: true, hint: '施工净湿体积，采购拆料见下方', stage: 'net' }),
    [
      metric('干料折算体积', dryVolume, 'm³', { digits: 3 }),
      metric('水泥理论重量', cementKg, 'kg'),
      metric('砂理论重量', sandKg, 'kg'),
      metric('砂理论体积', sandVolume, 'm³', { digits: 3 }),
      metric('水泥整袋采购', cementBags, '袋', { digits: 0 })
    ],
    [
      purchase('水泥', cementBags, '袋', `按${v.cementBag}kg/袋，理论${round(cementKg, 1)}kg`),
      purchase('砂', round(sandVolume, 3), 'm³', `按${v.sandDensity}kg/m³约${round(sandKg, 0)}kg`)
    ],
    [
      `湿体积 = ${v.area}㎡ × ${v.thickness}mm ÷ 1000 = ${round(wetVolume, 3)}m³`,
      `干料体积 = 湿体积 × ${v.dryFactor} × (1 + ${v.wasteRate}%)`,
      `按体积比 水泥:砂 = ${v.cementRatio}:${v.sandRatio} 分配干料体积`,
      '重量 = 分项体积 × 对应材料堆积密度'
    ],
    [
      '配比按松散材料体积比估算，不等同于质量配合比',
      '基层高差较大时应使用实测平均厚度或分区计算',
      '使用预拌干混砂浆时，应直接按产品kg/㎡·mm用量采购'
    ],
    ['有强度、抗裂、地暖或防水保护层要求时，应由设计确定砂浆品种和配合比。']
  )
}

function calculateConcrete(tool, v) {
  const wetVolume = v.length * v.width * v.thickness / 1000
  const purchaseVolume = wetVolume * (1 + percent(v.wasteRate))
  const dryVolume = purchaseVolume * v.dryFactor
  const totalRatio = v.cementRatio + v.sandRatio + v.stoneRatio
  const cementVolume = dryVolume * v.cementRatio / totalRatio
  const sandVolume = dryVolume * v.sandRatio / totalRatio
  const stoneVolume = dryVolume * v.stoneRatio / totalRatio
  const cementKg = cementVolume * v.cementDensity
  const sandKg = sandVolume * v.sandDensity
  const stoneKg = stoneVolume * v.stoneDensity
  const cementBags = ceil(cementKg / v.cementBag)

  return resultBase(
    tool,
    metric('建议备料方量', purchaseVolume, 'm³', { digits: 3, emphasis: true, hint: `净体积已加${v.wasteRate}%施工余量`, stage: 'waste' }),
    [
      metric('结构净体积', wetVolume, 'm³', { digits: 3 }),
      metric('干料折算体积', dryVolume, 'm³', { digits: 3 }),
      metric('水泥理论重量', cementKg, 'kg'),
      metric('砂理论重量', sandKg, 'kg'),
      metric('石子理论重量', stoneKg, 'kg')
    ],
    [
      purchase('水泥', cementBags, '袋', `按${v.cementBag}kg/袋，理论${round(cementKg, 1)}kg`),
      purchase('砂', round(sandVolume, 3), 'm³', `约${round(sandKg, 0)}kg`),
      purchase('石子', round(stoneVolume, 3), 'm³', `约${round(stoneKg, 0)}kg`)
    ],
    [
      `净体积 = ${v.length} × ${v.width} × ${v.thickness}mm ÷ 1000`,
      `备料方量 = 净体积 × (1 + ${v.wasteRate}%)`,
      `干料体积 = 备料方量 × ${v.dryFactor}`,
      `按名义体积比 ${v.cementRatio}:${v.sandRatio}:${v.stoneRatio} 分配干料体积`
    ],
    [
      '仅适用于非结构性、小体量现场材料概算',
      '材料含水率、级配、坍落度及实际密实度未参与配合比设计',
      '商品混凝土应直接按备料方量订购，不按本页名义配比拆料'
    ],
    ['承重构件、结构层和有强度等级要求的混凝土，必须采用经设计或试验确定的配合比。']
  )
}

const CALCULATORS = {
  floorTile: calculateFloorTile,
  wallTile: calculateWallTile,
  flooring: calculateFlooring,
  paint: calculatePaint,
  wallpaper: calculateWallpaper,
  waterproof: calculateWaterproof,
  ceiling: calculateCeiling,
  brickWall: calculateBrickWall,
  screed: calculateScreed,
  concrete: calculateConcrete
}

function calculate(toolId, params) {
  const normalized = validateAndNormalize(toolId, params || {})
  if (normalized.error) return normalized
  const calculator = CALCULATORS[toolId]
  if (!calculator) return { error: '该工具暂未实现计算逻辑' }
  const result = calculator(normalized.tool, normalized.values)
  if (result.error) return result
  const inputWarnings = getPlausibilityWarnings(toolId, params).map(item => item.message)
  if (inputWarnings.length) result.warnings = [...inputWarnings, ...result.warnings]
  return result
}

module.exports = {
  calculate,
  parseNumber,
  round,
  validateAndNormalize,
  getPlausibilityWarnings
}
