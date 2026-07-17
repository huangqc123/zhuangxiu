const CATEGORIES = [
  { id: 'surface', name: '墙地面材料', shortName: '饰面', color: '#176B5B' },
  { id: 'finish', name: '涂装与防水', shortName: '涂装', color: '#C66A2B' },
  { id: 'structure', name: '基层与结构', shortName: '基层', color: '#3D6087' }
]

function field(key, label, unit, defaultValue, options = {}) {
  return {
    key,
    label,
    unit,
    defaultValue: String(defaultValue),
    placeholder: options.placeholder || `请输入${label}`,
    group: options.group || 'basic',
    allowZero: Boolean(options.allowZero),
    min: options.min == null ? (options.allowZero ? 0 : 0.001) : options.min,
    max: options.max == null ? 100000 : options.max,
    digits: options.digits == null ? 3 : options.digits,
    note: options.note || '',
    sensibleMin: options.sensibleMin == null ? null : options.sensibleMin,
    sensibleMax: options.sensibleMax == null ? null : options.sensibleMax,
    sensibleMessage: options.sensibleMessage || ''
  }
}

const TOOLS = [
  {
    id: 'floorTile',
    category: 'surface',
    icon: '砖',
    name: '地砖计算',
    subtitle: '整砖排布、损耗、箱数及辅料',
    accent: '#176B5B',
    visualType: 'floor-tile',
    visualTitle: '地面排砖平面',
    visualLabel: '铺装网格',
    scene: '矩形房间；不规则区域可拆分后分别计算',
    summaryKeys: ['wasteRate', 'piecesPerBox', 'adhesiveRate'],
    fields: [
      field('length', '房间长度', 'm', 5, { sensibleMax: 100, sensibleMessage: '房间长度超过100m，是否把厘米填成了米？' }),
      field('width', '房间宽度', 'm', 4, { sensibleMax: 100, sensibleMessage: '房间宽度超过100m，是否把厘米填成了米？' }),
      field('deductArea', '不铺贴面积', '㎡', 0, { allowZero: true, note: '固定柜、地台等无需铺砖的面积' }),
      field('tileLength', '单砖长度', 'mm', 800, { max: 10000, sensibleMax: 3000, sensibleMessage: '单砖长度超过3000mm，请确认产品尺寸单位。' }),
      field('tileWidth', '单砖宽度', 'mm', 800, { max: 10000, sensibleMax: 3000, sensibleMessage: '单砖宽度超过3000mm，请确认产品尺寸单位。' }),
      field('deductPieces', '确认可少铺整砖', '片', 0, { group: 'advanced', allowZero: true, digits: 0, note: '仅填写排版后确认能完整减少的砖片数' }),
      field('jointWidth', '砖缝宽度', 'mm', 2, { group: 'advanced', allowZero: true }),
      field('wasteRate', '瓷砖损耗率', '%', 8, { group: 'advanced', allowZero: true, max: 50 }),
      field('piecesPerBox', '每箱片数', '片', 3, { group: 'advanced', digits: 0 }),
      field('adhesiveRate', '瓷砖胶用量', 'kg/㎡', 5, { group: 'advanced', note: '请优先采用产品包装标注值' }),
      field('adhesiveBag', '瓷砖胶包装', 'kg/袋', 20, { group: 'advanced' }),
      field('groutRate', '填缝剂用量', 'kg/㎡', 0.25, { group: 'advanced', note: '受砖缝宽深和砖尺寸影响' }),
      field('groutBag', '填缝剂包装', 'kg/袋', 2, { group: 'advanced' })
    ]
  },
  {
    id: 'wallTile',
    category: 'surface',
    icon: '墙',
    name: '墙砖计算',
    subtitle: '净墙面积、砖片、箱数及铺贴辅料',
    accent: '#24806D',
    visualType: 'wall-tile',
    visualTitle: '墙面铺贴立面',
    visualLabel: '门洞扣除',
    scene: '厨房、卫生间等连续墙面铺贴',
    summaryKeys: ['wasteRate', 'piecesPerBox', 'adhesiveRate'],
    fields: [
      field('perimeter', '铺贴墙面总长度', 'm', 10, { sensibleMax: 100, sensibleMessage: '铺贴墙面总长度超过100m，请确认是否需要分房间计算。' }),
      field('height', '铺贴高度', 'm', 2.4, { max: 1000, sensibleMax: 10, sensibleMessage: '铺贴高度超过10m，是否把厘米填成了米？' }),
      field('deductArea', '门窗及空洞面积', '㎡', 2, { allowZero: true }),
      field('tileLength', '单砖水平尺寸', 'mm', 600, { max: 10000, sensibleMax: 3000, sensibleMessage: '单砖水平尺寸超过3000mm，请确认产品尺寸单位。' }),
      field('tileWidth', '单砖竖向尺寸', 'mm', 300, { max: 10000, sensibleMax: 3000, sensibleMessage: '单砖竖向尺寸超过3000mm，请确认产品尺寸单位。' }),
      field('deductPieces', '确认可少铺整砖', '片', 0, { group: 'advanced', allowZero: true, digits: 0, note: '仅填写排版后确认能完整减少的砖片数' }),
      field('jointWidth', '砖缝宽度', 'mm', 2, { group: 'advanced', allowZero: true }),
      field('wasteRate', '瓷砖损耗率', '%', 10, { group: 'advanced', allowZero: true, max: 50 }),
      field('piecesPerBox', '每箱片数', '片', 8, { group: 'advanced', digits: 0 }),
      field('adhesiveRate', '瓷砖胶用量', 'kg/㎡', 5, { group: 'advanced' }),
      field('adhesiveBag', '瓷砖胶包装', 'kg/袋', 20, { group: 'advanced' }),
      field('groutRate', '填缝剂用量', 'kg/㎡', 0.3, { group: 'advanced' }),
      field('groutBag', '填缝剂包装', 'kg/袋', 2, { group: 'advanced' })
    ]
  },
  {
    id: 'flooring',
    category: 'surface',
    icon: '木',
    name: '木地板计算',
    subtitle: '地板包数、采购面积、踢脚线与地膜',
    accent: '#8B6B45',
    visualType: 'flooring',
    visualTitle: '木地板铺向示意',
    visualLabel: '错缝排布',
    scene: '强化、实木复合及同类按包装面积销售的地板',
    summaryKeys: ['wasteRate', 'skirtingWaste', 'underlayWaste'],
    fields: [
      field('length', '房间长度', 'm', 5, { sensibleMax: 100, sensibleMessage: '房间长度超过100m，是否把厘米填成了米？' }),
      field('width', '房间宽度', 'm', 4, { sensibleMax: 100, sensibleMessage: '房间宽度超过100m，是否把厘米填成了米？' }),
      field('deductArea', '不铺装面积', '㎡', 0, { allowZero: true }),
      field('packageArea', '每包覆盖面积', '㎡/包', 2.2, { note: '必须按实际产品包装填写' }),
      field('wasteRate', '地板损耗率', '%', 7, { group: 'advanced', allowZero: true, max: 50 }),
      field('doorWidth', '门洞宽度合计', 'm', 0.9, { group: 'advanced', allowZero: true }),
      field('skirtingLength', '单根踢脚线长度', 'm/根', 2.4, { group: 'advanced' }),
      field('skirtingWaste', '踢脚线损耗率', '%', 8, { group: 'advanced', allowZero: true, max: 50 }),
      field('underlayWaste', '地膜损耗率', '%', 5, { group: 'advanced', allowZero: true, max: 50 })
    ]
  },
  {
    id: 'paint',
    category: 'finish',
    icon: '漆',
    name: '乳胶漆计算',
    subtitle: '墙顶净面积、面漆、底漆与腻子',
    accent: '#C66A2B',
    visualType: 'paint',
    visualTitle: '墙顶涂刷示意',
    visualLabel: '滚涂覆盖',
    scene: '室内墙面与顶面滚涂；覆盖率按实际产品调整',
    summaryKeys: ['primerCoats', 'puttyRate', 'wasteRate'],
    fields: [
      field('perimeter', '墙面周长', 'm', 18, { sensibleMax: 100, sensibleMessage: '墙面周长超过100m，请确认是否需要分房间计算。' }),
      field('height', '墙面高度', 'm', 2.8, { max: 1000, sensibleMax: 10, sensibleMessage: '墙面高度超过10m，是否把厘米填成了米？' }),
      field('ceilingArea', '顶面涂刷面积', '㎡', 20, { allowZero: true }),
      field('deductArea', '门窗扣除面积', '㎡', 5, { allowZero: true }),
      field('topCoats', '面漆遍数', '遍', 2, { digits: 0, max: 6 }),
      field('topCoverage', '面漆单遍覆盖率', '㎡/L', 10, { note: '按产品说明和基层状态填写' }),
      field('topBucket', '面漆单桶容量', 'L/桶', 5),
      field('primerCoats', '底漆遍数', '遍', 1, { group: 'advanced', allowZero: true, digits: 0, max: 4 }),
      field('primerCoverage', '底漆单遍覆盖率', '㎡/L', 10, { group: 'advanced' }),
      field('primerBucket', '底漆单桶容量', 'L/桶', 5, { group: 'advanced' }),
      field('puttyRate', '腻子参考用量', 'kg/㎡', 1.5, { group: 'advanced', allowZero: true }),
      field('puttyBag', '腻子单袋重量', 'kg/袋', 20, { group: 'advanced' }),
      field('wasteRate', '综合余量', '%', 5, { group: 'advanced', allowZero: true, max: 30 })
    ]
  },
  {
    id: 'wallpaper',
    category: 'finish',
    icon: '纸',
    name: '壁纸计算',
    subtitle: '裁切对花、条数与整卷采购',
    accent: '#8D5AA8',
    visualType: 'wallpaper',
    visualTitle: '壁纸裁条示意',
    visualLabel: '竖向裁条',
    scene: '按竖向裁条铺贴的成卷壁纸',
    summaryKeys: ['patternRepeat', 'wasteRate', 'glueCoverage'],
    fields: [
      field('perimeter', '铺贴墙面总长度', 'm', 18, { sensibleMax: 100, sensibleMessage: '铺贴墙面总长度超过100m，请确认是否需要分房间计算。' }),
      field('height', '墙面高度', 'm', 2.8, { max: 1000, sensibleMax: 10, sensibleMessage: '墙面高度超过10m，是否把厘米填成了米？' }),
      field('deductArea', '门窗扣除面积', '㎡', 5, { allowZero: true }),
      field('rollWidth', '壁纸卷宽', 'm', 0.53),
      field('rollLength', '每卷长度', 'm', 10),
      field('trimAllowance', '每条裁切余量', 'cm', 10, { group: 'advanced', allowZero: true }),
      field('patternRepeat', '花距', 'cm', 0, { group: 'advanced', allowZero: true, note: '无对花填0' }),
      field('deductStrips', '确认可少裁整条', '条', 0, { group: 'advanced', allowZero: true, digits: 0, note: '仅扣除门洞等确定能完整少裁的整条数' }),
      field('glueCoverage', '壁纸胶单包覆盖', '㎡/包', 20, { group: 'advanced', note: '按实际产品包装说明填写' }),
      field('wasteRate', '施工损耗率', '%', 5, { group: 'advanced', allowZero: true, max: 40 })
    ]
  },
  {
    id: 'waterproof',
    category: 'finish',
    icon: '防',
    name: '防水涂料计算',
    subtitle: '地面、墙面上翻、遍数与桶数',
    accent: '#2779A7',
    visualType: 'waterproof',
    visualTitle: '防水涂膜示意',
    visualLabel: '墙面上翻',
    scene: '厨卫、阳台等涂膜防水材料估算',
    preflight: '防水构造、上翻高度和成膜厚度必须以设计要求及产品施工说明为准。',
    summaryKeys: ['wasteRate'],
    fields: [
      field('length', '地面长度', 'm', 3, { sensibleMax: 100, sensibleMessage: '地面长度超过100m，是否把厘米填成了米？' }),
      field('width', '地面宽度', 'm', 2, { sensibleMax: 100, sensibleMessage: '地面宽度超过100m，是否把厘米填成了米？' }),
      field('upturnHeight', '墙面涂刷高度', 'm', 1.8, { max: 1000, sensibleMax: 10, sensibleMessage: '墙面涂刷高度超过10m，是否把厘米填成了米？' }),
      field('deductArea', '墙面扣除面积', '㎡', 1.5, { allowZero: true }),
      field('coats', '涂刷遍数', '遍', 2, { digits: 0, max: 6 }),
      field('ratePerCoat', '单遍单位用量', 'kg/㎡', 0.75, { note: '必须结合设计厚度和产品说明' }),
      field('bucketWeight', '单桶净重', 'kg/桶', 18),
      field('wasteRate', '施工余量', '%', 8, { group: 'advanced', allowZero: true, max: 30 })
    ]
  },
  {
    id: 'ceiling',
    category: 'surface',
    icon: '顶',
    name: '吊顶材料计算',
    subtitle: '面板、收边条、龙骨与吊点估算',
    accent: '#4F6E91',
    visualType: 'ceiling',
    visualTitle: '吊顶排布仰视',
    visualLabel: '龙骨网格',
    scene: '矩形房间的规则排布吊顶；异形及设备开孔需深化',
    preflight: '吊点、龙骨间距、锚固和设备加固属于安全构造，必须按设计及系统厂家要求确认。',
    summaryKeys: ['wasteRate', 'mainSpacing', 'secondarySpacing'],
    fields: [
      field('length', '房间长度', 'm', 5, { sensibleMax: 100, sensibleMessage: '房间长度超过100m，是否把厘米填成了米？' }),
      field('width', '房间宽度', 'm', 4, { sensibleMax: 100, sensibleMessage: '房间宽度超过100m，是否把厘米填成了米？' }),
      field('panelLength', '面板长度', 'mm', 600, { max: 10000, sensibleMax: 3000, sensibleMessage: '面板长度超过3000mm，请确认产品尺寸单位。' }),
      field('panelWidth', '面板宽度', 'mm', 600, { max: 10000, sensibleMax: 3000, sensibleMessage: '面板宽度超过3000mm，请确认产品尺寸单位。' }),
      field('panelsPerPack', '每包面板数', '片', 8, { digits: 0 }),
      field('wasteRate', '面板损耗率', '%', 8, { group: 'advanced', allowZero: true, max: 40 }),
      field('trimLength', '单根收边条长度', 'm/根', 3, { group: 'advanced' }),
      field('mainSpacing', '主龙骨间距', 'm', 1.2, { group: 'advanced' }),
      field('secondarySpacing', '次龙骨间距', 'm', 0.4, { group: 'advanced' }),
      field('stockLength', '单根龙骨长度', 'm/根', 3, { group: 'advanced' }),
      field('hangerSpacing', '吊点纵向间距', 'm', 1.2, { group: 'advanced' })
    ]
  },
  {
    id: 'brickWall',
    category: 'structure',
    icon: '砌',
    name: '砌墙材料计算',
    subtitle: '砌块片数、墙体体积与砂浆',
    accent: '#9A5F42',
    visualType: 'brick-wall',
    visualTitle: '砌块墙体立面',
    visualLabel: '洞口扣除',
    scene: '规则砌块非承重墙的材料概算',
    preflight: '本工具只用于非承重墙材料概算；不得据此判断能否拆改、开洞或变更承重结构。',
    summaryKeys: ['wasteRate', 'mortarRate', 'jointWidth'],
    fields: [
      field('length', '墙体总长度', 'm', 4, { sensibleMax: 100, sensibleMessage: '墙体总长度超过100m，请确认是否需要分段计算。' }),
      field('height', '墙体高度', 'm', 2.8, { max: 1000, sensibleMax: 10, sensibleMessage: '墙体高度超过10m，是否把厘米填成了米？' }),
      field('deductArea', '门窗洞口面积', '㎡', 2, { allowZero: true }),
      field('wallThickness', '墙体厚度', 'mm', 100, { max: 3000, sensibleMax: 500, sensibleMessage: '墙体厚度超过500mm，请确认用途与单位。' }),
      field('blockLength', '砌块长度', 'mm', 600, { max: 5000, sensibleMax: 1500, sensibleMessage: '砌块长度超过1500mm，请确认产品尺寸单位。' }),
      field('blockHeight', '砌块高度', 'mm', 200, { max: 5000, sensibleMax: 1000, sensibleMessage: '砌块高度超过1000mm，请确认产品尺寸单位。' }),
      field('blockWidth', '砌块厚度', 'mm', 100, { max: 3000, sensibleMax: 500, sensibleMessage: '砌块厚度超过500mm，请确认产品尺寸单位。' }),
      field('jointWidth', '灰缝厚度', 'mm', 10, { group: 'advanced', allowZero: true }),
      field('wasteRate', '砌块损耗率', '%', 5, { group: 'advanced', allowZero: true, max: 30 }),
      field('mortarRate', '砌筑砂浆用量', 'kg/㎡', 18, { group: 'advanced', note: '薄层砌筑或不同砌块应改用厂家值' }),
      field('mortarBag', '砂浆单袋重量', 'kg/袋', 25, { group: 'advanced' })
    ]
  },
  {
    id: 'screed',
    category: 'structure',
    icon: '砂',
    name: '找平砂浆计算',
    subtitle: '湿体积、水泥、砂与包装数量',
    accent: '#94713F',
    visualType: 'screed',
    visualTitle: '找平层构造剖面',
    visualLabel: '厚度控制',
    scene: '现场体积比拌制的水泥砂浆找平层概算',
    preflight: '有强度、抗裂、地暖或防水保护层要求时，应由设计或产品系统确定砂浆品种。',
    summaryKeys: ['dryFactor', 'wasteRate', 'cementBag'],
    fields: [
      field('area', '施工面积', '㎡', 20, { sensibleMax: 10000, sensibleMessage: '施工面积超过10000㎡，请确认是否需要分区计算。' }),
      field('thickness', '平均厚度', 'mm', 30, { max: 5000, sensibleMax: 300, sensibleMessage: '找平层平均厚度超过300mm，请确认是否把厘米填成了毫米。' }),
      field('cementRatio', '水泥体积份数', '份', 1),
      field('sandRatio', '砂体积份数', '份', 3),
      field('dryFactor', '干料体积系数', '倍', 1.33, { group: 'advanced', note: '考虑空隙与收缩的估算系数' }),
      field('wasteRate', '施工损耗率', '%', 5, { group: 'advanced', allowZero: true, max: 30 }),
      field('cementDensity', '水泥堆积密度', 'kg/m³', 1440, { group: 'advanced' }),
      field('sandDensity', '砂堆积密度', 'kg/m³', 1600, { group: 'advanced' }),
      field('cementBag', '水泥单袋重量', 'kg/袋', 50, { group: 'advanced' })
    ]
  },
  {
    id: 'concrete',
    category: 'structure',
    icon: '砼',
    name: '混凝土用量计算',
    subtitle: '浇筑方量及名义配比材料概算',
    accent: '#58636D',
    visualType: 'concrete',
    visualTitle: '混凝土浇筑剖面',
    visualLabel: '方量构成',
    scene: '非结构性小体量浇筑概算；结构混凝土必须采用设计配合比',
    preflight: '承重构件、结构层及有强度等级要求的混凝土，不得使用本页名义配比作为施工依据。',
    summaryKeys: ['dryFactor', 'wasteRate', 'cementBag'],
    fields: [
      field('length', '浇筑长度', 'm', 4, { sensibleMax: 100, sensibleMessage: '浇筑长度超过100m，请确认是否需要分段计算。' }),
      field('width', '浇筑宽度', 'm', 3, { sensibleMax: 100, sensibleMessage: '浇筑宽度超过100m，请确认是否需要分段计算。' }),
      field('thickness', '平均厚度', 'mm', 100, { max: 10000, sensibleMax: 1000, sensibleMessage: '平均厚度超过1000mm，请确认用途与尺寸单位。' }),
      field('cementRatio', '水泥体积份数', '份', 1),
      field('sandRatio', '砂体积份数', '份', 2),
      field('stoneRatio', '石子体积份数', '份', 3),
      field('dryFactor', '干料体积系数', '倍', 1.54, { group: 'advanced' }),
      field('wasteRate', '施工损耗率', '%', 5, { group: 'advanced', allowZero: true, max: 30 }),
      field('cementDensity', '水泥堆积密度', 'kg/m³', 1440, { group: 'advanced' }),
      field('sandDensity', '砂堆积密度', 'kg/m³', 1600, { group: 'advanced' }),
      field('stoneDensity', '石子堆积密度', 'kg/m³', 1500, { group: 'advanced' }),
      field('cementBag', '水泥单袋重量', 'kg/袋', 50, { group: 'advanced' })
    ]
  }
]

const TOOL_MAP = TOOLS.reduce((map, tool) => {
  map[tool.id] = tool
  return map
}, {})

function getTool(id) {
  return TOOL_MAP[id] || null
}

function getDefaultParams(tool) {
  return tool.fields.reduce((params, item) => {
    params[item.key] = item.defaultValue
    return params
  }, {})
}

module.exports = {
  CATEGORIES,
  TOOLS,
  TOOL_MAP,
  getTool,
  getDefaultParams
}
