const { hasAcceptedAgreement, acceptAgreement } = require('./utils/agreement')

App({
  globalData: {
    appName: '装修材料计算器',
    version: '1.1.0'
  },

  onLaunch() {
    this.agreementPromptVisible = false
    this.agreementAcceptedCallbacks = []
  },

  onShow() {
    this.showAgreementPrompt()
  },

  showAgreementPrompt(onAccepted) {
    if (hasAcceptedAgreement()) {
      if (typeof onAccepted === 'function') onAccepted()
      return true
    }

    if (typeof onAccepted === 'function' && !this.agreementAcceptedCallbacks.includes(onAccepted)) {
      this.agreementAcceptedCallbacks.push(onAccepted)
    }
    if (this.agreementPromptVisible) return false

    this.agreementPromptVisible = true
    wx.showModal({
      title: '使用前请阅读',
      content: '请阅读并同意《用户协议》和《隐私政策》。本工具仅提供材料用量辅助估算，采购和施工前请自行复核。',
      cancelText: '查看协议',
      confirmText: '同意继续',
      confirmColor: '#A85037',
      success: res => {
        this.agreementPromptVisible = false
        if (res.confirm) {
          if (acceptAgreement()) this.flushAgreementAcceptedCallbacks()
          return
        }
        this.agreementAcceptedCallbacks = []
        wx.navigateTo({ url: '/pages/legal/index?mode=terms&consent=1' })
      },
      fail: () => {
        this.agreementPromptVisible = false
        this.agreementAcceptedCallbacks = []
      }
    })
    return false
  },

  flushAgreementAcceptedCallbacks() {
    const callbacks = this.agreementAcceptedCallbacks.slice()
    this.agreementAcceptedCallbacks = []
    callbacks.forEach(callback => callback())
  },

  removeAgreementAcceptedCallback(callback) {
    this.agreementAcceptedCallbacks = this.agreementAcceptedCallbacks.filter(item => item !== callback)
  }
})
