const AGREEMENT_KEY = 'renovation_agreement_version_v1'
const AGREEMENT_VERSION = '2026-07-16'

function hasAcceptedAgreement() {
  try {
    return wx.getStorageSync(AGREEMENT_KEY) === AGREEMENT_VERSION
  } catch (error) {
    return false
  }
}

function acceptAgreement() {
  try {
    wx.setStorageSync(AGREEMENT_KEY, AGREEMENT_VERSION)
    return true
  } catch (error) {
    return false
  }
}

module.exports = {
  AGREEMENT_KEY,
  AGREEMENT_VERSION,
  hasAcceptedAgreement,
  acceptAgreement
}
