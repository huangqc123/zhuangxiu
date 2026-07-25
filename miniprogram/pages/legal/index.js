const { acceptAgreement } = require('../../utils/agreement')

const TERMS_SECTIONS = [
  {
    title: '1. 服务定位',
    content: '本小程序提供装修材料用量、包装数量和费用的辅助估算。计算结果属于参考性概算，不构成设计文件、施工方案、工程量清单、报价承诺、质量验收结论或任何专业意见。'
  },
  {
    title: '2. 使用前提',
    content: '用户应自行确保尺寸、单位、扣除量、产品规格、损耗率和施工参数真实准确，并在采购或施工前结合现场复尺、排版深化、产品技术资料以及设计和施工专业人员意见进行复核。'
  },
  {
    title: '3. 专业边界',
    content: '本小程序不判断结构安全、承重拆改、防火等级、防水构造、吊顶锚固、材料性能、强度等级及其他依法应由具备相应能力的单位或人员确认的事项。任何涉及人身、财产或工程安全的决定均不得仅依据本小程序作出。'
  },
  {
    title: '4. 默认参数与结果',
    content: '默认参数只是常见场景的可编辑起点，不是统一消耗定额。材料包装、涂布率、单位用量、施工体系和规范可能调整；开发者会尽力维护计算逻辑，但不承诺结果完全无误、适合所有工程或持续保持不变。'
  },
  {
    title: '5. 用户责任',
    content: '因输入错误、单位混淆、未按提示复核、忽略专业边界、超出适用场景，或把概算作为采购及施工唯一依据而产生的差异、补退货、工期、费用或其他损失，由用户自行承担相应风险。如不同意，请您退出本程序'
  },
  {
    title: '6. 免责声明',
    content: '本工具仅提供材料用量的辅助估算，因使用本工具产生的任何直接或间接损失，开发者不承担任何法律责任。'
  },
  {
    title: '7. 服务调整',
    content: '开发者可根据产品维护、规范变化和实际运营情况调整计算方式、功能或协议内容。继续使用即表示接受更新后的规则。'
  }
]

const PRIVACY_SECTIONS = [
  {
    title: '1. 信息处理说明',
    content: '本小程序仅为提供材料计算、记录与相关功能处理用户主动填写的信息。请勿在计算参数和记录名称中填写与功能无关的个人信息。'
  },
  {
    title: '2. 本地保存的数据',
    content: '用户填写的房间尺寸、材料参数、记录名称、收藏、计算历史、材料单价和预算仅保存在当前设备的微信小程序本地存储中，不会由本小程序上传至开发者服务器。请勿在记录名称中填写不必要的个人敏感信息。'
  },
  {
    title: '3. 剪贴板与分享',
    content: '只有在用户主动点击复制清单、复制反馈微信号时，本小程序才会写入剪贴板。用户主动分享计算结果时，分享链接会携带当前工具的计算参数，供接收方在其设备上重新生成同一类采购清单；位置名称、材料单价、预算和本地历史不会加入分享参数，也不会上传至开发者服务器。相关平台能力由微信按照其规则提供。'
  },
  {
    title: '4. 数据管理与删除',
    content: '用户可以在计算记录页删除单条记录或清空台账，也可以通过微信的小程序数据管理能力清除本地数据。卸载、清理微信数据或更换设备可能导致本地记录无法恢复。'
  },
]

Page({
  data: {
    active: 'terms',
    updatedAt: '更新日期：2026年7月17日',
    termsSections: TERMS_SECTIONS,
    privacySections: PRIVACY_SECTIONS,
    fromConsent: false,
    accepted: false
  },

  onLoad(options) {
    const active = options.mode === 'privacy' ? 'privacy' : 'terms'
    this.setData({ active, fromConsent: options.consent === '1' })
    wx.setNavigationBarTitle({ title: active === 'privacy' ? '隐私政策' : '用户协议' })
  },

  onSwitch(e) {
    const active = e.currentTarget.dataset.mode === 'privacy' ? 'privacy' : 'terms'
    this.setData({ active })
    wx.setNavigationBarTitle({ title: active === 'privacy' ? '隐私政策' : '用户协议' })
    if (typeof wx.pageScrollTo === 'function') wx.pageScrollTo({ scrollTop: 0, duration: 220 })
  },

  onAcceptAgreement() {
    if (!acceptAgreement()) {
      wx.showToast({ title: '暂无法保存确认状态', icon: 'none' })
      return
    }
    this.setData({ accepted: true })
    wx.showToast({ title: '已同意协议', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 300)
  },

  onUnload() {
    if (!this.data.fromConsent || this.data.accepted) return
    const app = getApp()
    if (app && typeof app.showAgreementPrompt === 'function') {
      setTimeout(() => app.showAgreementPrompt(), 180)
    }
  }
})
