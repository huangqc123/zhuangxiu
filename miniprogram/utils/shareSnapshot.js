const SNAPSHOT_VERSION = 1
const MAX_SNAPSHOT_LENGTH = 900

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function encodeShareSnapshot(data) {
  if (!isPlainObject(data)) return ''
  try {
    const encoded = encodeURIComponent(JSON.stringify({ v: SNAPSHOT_VERSION, data }))
    return encoded.length <= MAX_SNAPSHOT_LENGTH ? encoded : ''
  } catch (error) {
    return ''
  }
}

function decodeShareSnapshot(raw) {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const payload = JSON.parse(decodeURIComponent(raw))
    if (!isPlainObject(payload) || payload.v !== SNAPSHOT_VERSION || !isPlainObject(payload.data)) return null
    return payload.data
  } catch (error) {
    return null
  }
}

module.exports = {
  SNAPSHOT_VERSION,
  MAX_SNAPSHOT_LENGTH,
  encodeShareSnapshot,
  decodeShareSnapshot
}
