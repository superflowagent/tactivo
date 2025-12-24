export const logLevel = (typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process.env?.NODE_ENV === 'production') ? 'error' : 'debug'

export function debug(...args: any[]) {
  if (logLevel === 'debug') console.debug('[DEBUG]', ...args)
}
export function info(...args: any[]) {
  if (logLevel !== 'error') console.info('[INFO]', ...args)
}
export function error(...args: any[]) {
  console.error('[ERROR]', ...args)
}
