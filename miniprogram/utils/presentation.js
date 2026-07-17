function pad(value) {
  return String(value).padStart(2, '0')
}

function hexToRgba(hex, alpha) {
  const value = String(hex).replace('#', '')
  const number = parseInt(value, 16)
  const red = (number >> 16) & 255
  const green = (number >> 8) & 255
  const blue = number & 255
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function formatRelativeTime(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  return sameDay
    ? `今天 ${pad(date.getHours())}:${pad(date.getMinutes())}`
    : `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatShortTime(timestamp) {
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatFullTime(timestamp) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

module.exports = {
  hexToRgba,
  formatRelativeTime,
  formatShortTime,
  formatFullTime
}
