export function formatDateWithOffset(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  const year = d.getFullYear()
  const month = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const hours = pad(d.getHours())
  const minutes = pad(d.getMinutes())
  const seconds = pad(d.getSeconds())

  // timezone offset in minutes, positive if behind UTC
  const tzOffsetMin = -d.getTimezoneOffset()
  const tzSign = tzOffsetMin >= 0 ? '+' : '-'
  const absOffsetMin = Math.abs(tzOffsetMin)
  const tzHours = pad(Math.floor(absOffsetMin / 60))
  const tzMinutes = pad(absOffsetMin % 60)

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${tzSign}${tzHours}:${tzMinutes}`
}
