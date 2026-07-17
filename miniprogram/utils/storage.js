const HISTORY_KEY = 'renovation_calculation_history_v1'
const FAVORITES_KEY = 'renovation_favorite_tools_v1'
const MAX_HISTORY = 60
const SCHEMA_VERSION = 2
const ENGINE_VERSION = '1.1.0'

function safeGet(key, fallback) {
  try {
    const value = wx.getStorageSync(key)
    return value || fallback
  } catch (error) {
    return fallback
  }
}

function safeSet(key, value) {
  try {
    wx.setStorageSync(key, value)
    return true
  } catch (error) {
    return false
  }
}

function getHistory() {
  const list = safeGet(HISTORY_KEY, [])
  if (!Array.isArray(list)) return []
  return list
    .filter(item => item && item.id && item.toolId && item.params && item.primary)
    .map(item => ({
      ...item,
      schemaVersion: Number(item.schemaVersion) || 1,
      engineVersion: item.engineVersion || '1.0.0',
      recordName: typeof item.recordName === 'string' ? item.recordName : '',
      purchases: Array.isArray(item.purchases) ? item.purchases : [],
      budgetLines: Array.isArray(item.budgetLines) ? item.budgetLines : [],
      budgetTotal: typeof item.budgetTotal === 'string' ? item.budgetTotal : '0.00'
    }))
}

function saveHistory(tool, params, result, options = {}) {
  const now = Date.now()
  const paramsSnapshot = { ...params }
  const history = getHistory()
  const sourceRecord = options.sourceRecordId
    ? history.find(item => item.id === options.sourceRecordId)
    : null
  const inheritedRecord = sourceRecord || history.find(item => (
    item.toolId === tool.id && JSON.stringify(item.params) === JSON.stringify(paramsSnapshot)
  ))
  const record = {
    id: `${now}_${Math.random().toString(36).slice(2, 8)}`,
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    toolId: tool.id,
    toolName: tool.name,
    icon: tool.icon,
    accent: tool.accent,
    params: paramsSnapshot,
    primary: { ...result.primary },
    purchases: result.purchases.map(item => ({ ...item })),
    recordName: typeof options.recordName === 'string'
      ? options.recordName.trim().slice(0, 24)
      : (inheritedRecord ? inheritedRecord.recordName : ''),
    budgetLines: Array.isArray(options.budgetLines)
      ? options.budgetLines.map(item => ({ ...item }))
      : (inheritedRecord ? inheritedRecord.budgetLines : []),
    budgetTotal: typeof options.budgetTotal === 'string'
      ? options.budgetTotal
      : (inheritedRecord ? inheritedRecord.budgetTotal : '0.00'),
    time: now
  }
  const serializedParams = JSON.stringify(paramsSnapshot)
  const previous = history.filter(item => (
    item.toolId !== tool.id || JSON.stringify(item.params) !== serializedParams
  ))
  const list = [record, ...previous].slice(0, MAX_HISTORY)
  return safeSet(HISTORY_KEY, list) ? record : null
}

function updateRecord(id, patch) {
  const history = getHistory()
  const index = history.findIndex(item => item.id === id)
  if (index < 0) return null

  const allowed = {}
  if (typeof patch.recordName === 'string') allowed.recordName = patch.recordName.trim().slice(0, 24)
  if (Array.isArray(patch.budgetLines)) allowed.budgetLines = patch.budgetLines.map(item => ({ ...item }))
  if (typeof patch.budgetTotal === 'string') allowed.budgetTotal = patch.budgetTotal
  const nextRecord = {
    ...history[index],
    ...allowed,
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION
  }
  const next = history.map((item, itemIndex) => itemIndex === index ? nextRecord : item)
  return safeSet(HISTORY_KEY, next) ? nextRecord : null
}

function getRecord(id) {
  return getHistory().find(item => item.id === id) || null
}

function clearHistory() {
  safeSet(HISTORY_KEY, [])
}

function removeRecord(id) {
  const list = getHistory().filter(item => item.id !== id)
  safeSet(HISTORY_KEY, list)
  return list
}

function getFavorites() {
  const list = safeGet(FAVORITES_KEY, [])
  return Array.isArray(list) ? list : []
}

function toggleFavorite(toolId) {
  const list = getFavorites()
  const next = list.includes(toolId)
    ? list.filter(id => id !== toolId)
    : [toolId, ...list]
  safeSet(FAVORITES_KEY, next)
  return next
}

module.exports = {
  getHistory,
  saveHistory,
  getRecord,
  updateRecord,
  clearHistory,
  removeRecord,
  getFavorites,
  toggleFavorite,
  SCHEMA_VERSION,
  ENGINE_VERSION
}
