const { getTool, getDefaultParams } = require('../../utils/tools')
const { calculate, validateAndNormalize, getPlausibilityWarnings } = require('../../utils/calculators')
const { saveHistory, getRecord, updateRecord, getFavorites, toggleFavorite } = require('../../utils/storage')
const { encodeShareSnapshot, decodeShareSnapshot } = require('../../utils/shareSnapshot')

function decorateFields(fields) {
  return fields.map((item, index) => ({
    ...item,
    inputType: item.digits === 0 ? 'number' : 'digit',
    confirmType: index < fields.length - 1 ? 'next' : 'done'
  }))
}

function buildAdvancedSummary(tool, params) {
  if (!tool || !tool.summaryKeys || !tool.summaryKeys.length) return '包装规格、损耗率和单位用量'
  const fieldMap = tool.fields.reduce((map, item) => {
    map[item.key] = item
    return map
  }, {})
  return tool.summaryKeys
    .map(key => fieldMap[key])
    .filter(Boolean)
    .map(item => `${item.label.replace('施工', '').replace('综合', '')} ${params[item.key]}${item.unit}`)
    .join(' · ')
}

function createBudgetLines(purchases, savedLines = []) {
  return purchases.map(item => {
    const saved = savedLines.find(line => line.label === item.label && line.unit === item.unit)
    const price = saved && /^(?:\d+\.?\d*|\.\d+)$/.test(String(saved.price || '').trim())
      ? String(saved.price)
      : ''
    return {
      ...item,
      price,
      subtotal: (Number(item.quantity) * Number(price || 0)).toFixed(2)
    }
  })
}

function sumBudget(lines) {
  return lines.reduce((sum, line) => sum + Number(line.subtotal || 0), 0).toFixed(2)
}

function pickToolParams(tool, params) {
  return tool.fields.reduce((output, field) => {
    const value = params[field.key]
    if (typeof value === 'string' || typeof value === 'number') output[field.key] = value
    return output
  }, {})
}

function restoreSharedCalculation(tool, defaults, rawSnapshot) {
  const snapshot = decodeShareSnapshot(rawSnapshot)
  if (!snapshot || snapshot.toolId !== tool.id || !snapshot.params ||
      typeof snapshot.params !== 'object' || Array.isArray(snapshot.params)) return null

  const params = { ...defaults }
  for (const field of tool.fields) {
    if (!Object.prototype.hasOwnProperty.call(snapshot.params, field.key)) continue
    const value = snapshot.params[field.key]
    if (typeof value !== 'string' && typeof value !== 'number') return null
    params[field.key] = value
  }
  const result = calculate(tool.id, params)
  return result.error ? null : { params, result }
}

Page({
  data: {
    tool: null,
    params: {},
    basicFields: [],
    advancedFields: [],
    advancedOpen: false,
    result: null,
    showResult: false,
    errorField: '',
    isFavorite: false,
    loadedFromHistory: false,
    loadedFromShare: false,
    budgetOpen: false,
    budgetLines: [],
    budgetTotal: '0.00',
    sourceBudgetLines: [],
    sourceRecordId: '',
    currentRecordId: '',
    recordName: '',
    advancedSummary: '',
    focusedField: ''
  },

  onLoad(options = {}) {
    this._pendingLoadOptions = options
    this._agreementAcceptedHandler = () => {
      if (this._pageInitialized) return
      this._pageInitialized = true
      this.initializePage(this._pendingLoadOptions)
    }
    this.ensureAgreementAndInitialize()
  },

  onShow() {
    this.ensureAgreementAndInitialize()
  },

  onUnload() {
    if (typeof getApp !== 'function' || !this._agreementAcceptedHandler) return
    const app = getApp()
    if (app && typeof app.removeAgreementAcceptedCallback === 'function') {
      app.removeAgreementAcceptedCallback(this._agreementAcceptedHandler)
    }
  },

  ensureAgreementAndInitialize() {
    if (this._pageInitialized || !this._agreementAcceptedHandler) return
    if (typeof getApp !== 'function') {
      this._agreementAcceptedHandler()
      return
    }
    const app = getApp()
    if (!app || typeof app.showAgreementPrompt !== 'function') {
      this._agreementAcceptedHandler()
      return
    }
    app.showAgreementPrompt(this._agreementAcceptedHandler)
  },

  initializePage(options = {}) {
    const tool = getTool(options.type)
    if (!tool) {
      wx.showModal({
        title: '工具不可用',
        content: '未找到该材料计算工具，请返回首页重新选择。',
        showCancel: false,
        success: () => wx.navigateBack()
      })
      return
    }

    const defaults = getDefaultParams(tool)
    const shared = options.snapshot ? restoreSharedCalculation(tool, defaults, options.snapshot) : null
    if (options.snapshot && !shared) {
      wx.showToast({ title: '分享参数已失效，请重新填写', icon: 'none' })
    }
    const record = !shared && options.recordId ? getRecord(options.recordId) : null
    const params = shared
      ? shared.params
      : (record && record.toolId === tool.id ? { ...defaults, ...record.params } : defaults)
    const favorites = getFavorites()
    const sharedBudgetLines = shared ? createBudgetLines(shared.result.purchases) : []

    wx.setNavigationBarTitle({ title: tool.name })
    this.setData({
      tool,
      params,
      basicFields: decorateFields(tool.fields.filter(item => item.group === 'basic')),
      advancedFields: decorateFields(tool.fields.filter(item => item.group === 'advanced')),
      isFavorite: favorites.includes(tool.id),
      loadedFromHistory: Boolean(record),
      loadedFromShare: Boolean(shared),
      sourceRecordId: record ? record.id : '',
      recordName: record ? record.recordName : '',
      sourceBudgetLines: shared ? sharedBudgetLines : (record ? record.budgetLines : []),
      result: shared ? shared.result : null,
      showResult: Boolean(shared),
      budgetLines: sharedBudgetLines,
      budgetTotal: shared ? sumBudget(sharedBudgetLines) : '0.00',
      advancedSummary: buildAdvancedSummary(tool, params)
    })
  },

  onFieldInput(e) {
    const key = e.currentTarget.dataset.key
    const params = { ...this.data.params, [key]: e.detail.value }
    this.setData({
      [`params.${key}`]: e.detail.value,
      errorField: this.data.errorField === key ? '' : this.data.errorField,
      showResult: false,
      result: null,
      loadedFromShare: false,
      budgetOpen: false,
      budgetLines: [],
      budgetTotal: '0.00',
      sourceBudgetLines: this.data.budgetLines.length ? this.data.budgetLines : this.data.sourceBudgetLines,
      sourceRecordId: this.data.currentRecordId || this.data.sourceRecordId,
      currentRecordId: '',
      advancedSummary: buildAdvancedSummary(this.data.tool, params)
    })
  },

  onFieldConfirm(e) {
    const group = e.currentTarget.dataset.group
    const index = Number(e.currentTarget.dataset.index)
    const fields = group === 'advanced' ? this.data.advancedFields : this.data.basicFields
    const next = fields[index + 1]
    if (next) this.setData({ focusedField: next.key })
    else this.setData({ focusedField: '' })
  },

  onFieldFocus(e) {
    const key = e.currentTarget.dataset.key
    if (key && this.data.focusedField !== key) this.setData({ focusedField: key })
  },

  onToggleAdvanced() {
    this.setData({ advancedOpen: !this.data.advancedOpen })
  },

  onCalculate() {
    wx.hideKeyboard()
    const validation = validateAndNormalize(this.data.tool.id, this.data.params)
    if (validation.error) {
      this.performCalculate()
      return
    }
    const plausibilityWarnings = getPlausibilityWarnings(this.data.tool.id, this.data.params)
    if (plausibilityWarnings.length) {
      wx.showModal({
        title: '确认输入值与单位',
        content: plausibilityWarnings.slice(0, 3).map(item => item.message).join('\n'),
        confirmText: '仍要计算',
        confirmColor: '#A85037',
        success: res => {
          if (res.confirm) this.performCalculate()
        }
      })
      return
    }
    this.performCalculate()
  },

  performCalculate() {
    const result = calculate(this.data.tool.id, this.data.params)
    if (result.error) {
      const field = result.field || ''
      const fieldConfig = this.data.tool.fields.find(item => item.key === field)
      const shouldOpen = fieldConfig && fieldConfig.group === 'advanced'
      this.setData({
        errorField: field,
        advancedOpen: shouldOpen ? true : this.data.advancedOpen,
        showResult: false,
        result: null
      }, () => {
        if (field && typeof wx.pageScrollTo === 'function') {
          wx.pageScrollTo({ selector: `#field-${field}`, duration: 280 })
        }
        if (field) this.setData({ focusedField: field })
      })
      wx.showToast({ title: result.error, icon: 'none', duration: 2200 })
      return
    }

    const budgetLines = createBudgetLines(result.purchases, this.data.sourceBudgetLines)
    const budgetTotal = sumBudget(budgetLines)
    const savedRecord = saveHistory(this.data.tool, this.data.params, result, {
      sourceRecordId: this.data.sourceRecordId,
      recordName: this.data.recordName,
      budgetLines,
      budgetTotal
    })
    this.setData({
      result,
      showResult: true,
      loadedFromShare: false,
      errorField: '',
      budgetOpen: false,
      budgetLines,
      budgetTotal,
      currentRecordId: savedRecord ? savedRecord.id : '',
      sourceRecordId: savedRecord ? savedRecord.id : this.data.sourceRecordId,
      sourceBudgetLines: budgetLines
    }, () => {
      if (typeof wx.pageScrollTo === 'function') {
        wx.pageScrollTo({ selector: '#result-anchor', duration: 380 })
      }
      wx.showToast({
        title: savedRecord ? '已生成采购清单' : '清单已生成，记录保存失败',
        icon: 'none'
      })
    })
  },

  onReset() {
    this.setData({
      params: getDefaultParams(this.data.tool),
      advancedOpen: false,
      result: null,
      showResult: false,
      errorField: '',
      loadedFromHistory: false,
      loadedFromShare: false,
      budgetOpen: false,
      budgetLines: [],
      budgetTotal: '0.00',
      sourceBudgetLines: [],
      sourceRecordId: '',
      currentRecordId: '',
      recordName: '',
      focusedField: '',
      advancedSummary: buildAdvancedSummary(this.data.tool, getDefaultParams(this.data.tool))
    })
    wx.pageScrollTo({ scrollTop: 0, duration: 250 })
    wx.showToast({ title: '已恢复推荐示例', icon: 'none' })
  },

  onToggleFavorite() {
    const list = toggleFavorite(this.data.tool.id)
    const isFavorite = list.includes(this.data.tool.id)
    this.setData({ isFavorite })
    wx.showToast({ title: isFavorite ? '已加入常用' : '已取消常用', icon: 'none' })
  },

  onToggleBudget() {
    this.setData({ budgetOpen: !this.data.budgetOpen })
  },

  onPriceInput(e) {
    const index = Number(e.currentTarget.dataset.index)
    const priceText = e.detail.value
    const lines = this.data.budgetLines.map((line, lineIndex) => {
      if (lineIndex !== index) return line
      const valid = /^(?:\d+\.?\d*|\.\d+)$/.test(priceText.trim())
      const price = valid ? Number(priceText) : 0
      return {
        ...line,
        price: priceText,
        subtotal: (Number(line.quantity) * price).toFixed(2)
      }
    })
    const total = lines.reduce((sum, line) => sum + Number(line.subtotal || 0), 0)
    const budgetTotal = total.toFixed(2)
    this.setData({ budgetLines: lines, budgetTotal, sourceBudgetLines: lines }, () => {
      if (this.data.currentRecordId) {
        updateRecord(this.data.currentRecordId, { budgetLines: lines, budgetTotal })
      }
    })
  },

  onRecordNameInput(e) {
    const recordName = e.detail.value.slice(0, 24)
    this.setData({ recordName }, () => {
      if (this.data.currentRecordId) updateRecord(this.data.currentRecordId, { recordName })
    })
  },

  onApplyLayoutPlan(e) {
    const action = e.currentTarget.dataset.action
    if (!action) return
    const params = { ...this.data.params }
    if (action === 'swapTileSize') {
      const length = params.tileLength
      params.tileLength = params.tileWidth
      params.tileWidth = length
      params.deductPieces = '0'
    } else if (action === 'swapPanelSize') {
      const length = params.panelLength
      params.panelLength = params.panelWidth
      params.panelWidth = length
    } else {
      return
    }
    this.setData({
      params,
      showResult: false,
      result: null,
      loadedFromShare: false,
      sourceBudgetLines: this.data.budgetLines,
      sourceRecordId: this.data.currentRecordId,
      currentRecordId: '',
      advancedSummary: buildAdvancedSummary(this.data.tool, params)
    }, () => this.onCalculate())
  },

  onCopyResult() {
    if (!this.data.result) return
    const result = this.data.result
    const budgetText = Number(this.data.budgetTotal) > 0
      ? [
          '',
          '预算估算：',
          ...this.data.budgetLines
            .filter(item => Number(item.price) > 0)
            .map(item => `- ${item.label}：${item.quantity}${item.unit} × ¥${item.price} = ¥${item.subtotal}`),
          `- 合计：¥${this.data.budgetTotal}`
        ]
      : []
    const lines = [
      `【${this.data.recordName ? `${this.data.recordName}｜` : ''}${result.toolName}】`,
      `${result.primary.label}：${result.primary.value}${result.primary.unit}`,
      result.primary.hint ? `口径：${result.primary.hint}` : '',
      '',
      '采购清单：',
      ...result.purchases.map(item => `- ${item.label}：${item.quantity}${item.unit}${item.detail ? `（${item.detail}）` : ''}`),
      '',
      '关键数据：',
      ...result.metrics.map(item => `- ${item.label}：${item.value}${item.unit}`),
      ...budgetText,
      ...(result.warnings.length ? ['', '复核提醒：', ...result.warnings.map(item => `- ${item}`)] : []),
      '',
      '注：结果为材料采购概算，请结合现场排版和产品说明复核。'
    ].filter((item, index, array) => item !== '' || array[index - 1] !== '')
    wx.setClipboardData({ data: lines.join('\n') })
  },

  onOpenGuide() {
    wx.navigateTo({ url: '/pages/guide/index' })
  },

  onShareAppMessage() {
    const tool = this.data.tool
    if (tool && this.data.showResult && this.data.result) {
      const snapshot = encodeShareSnapshot({
        toolId: tool.id,
        params: pickToolParams(tool, this.data.params)
      })
      if (!snapshot) {
        wx.showToast({ title: '参数较长，本次仅分享工具入口', icon: 'none' })
      }
      return {
        title: `${tool.name}：${this.data.result.primary.value}${this.data.result.primary.unit}（查看参数与采购清单）`,
        path: `/pages/calculator/index?type=${tool.id}${snapshot ? `&snapshot=${snapshot}` : ''}`
      }
    }
    return {
      title: tool ? `${tool.name}｜装修材料计算器` : '装修材料计算器',
      path: tool ? `/pages/calculator/index?type=${tool.id}` : '/pages/home/index'
    }
  }
})
