// Default: do not print debug messages unless explicitly enabled via Vite env or process env.
const isProd = (typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process.env?.NODE_ENV === 'production')
// Enable debug only if VITE_ENABLE_DEBUG=true in Vite env or ENABLE_DEBUG=true in process env
const enableDebug = ((import.meta as any)?.env?.VITE_ENABLE_DEBUG === 'true') || (typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process.env?.ENABLE_DEBUG === 'true')
const logLevel = (enableDebug && !isProd) ? 'debug' : 'error'

export function debug(...args: any[]) {
    if (logLevel === 'debug') console.debug('[DEBUG]', ...args)
}
export function info(...args: any[]) {
    if (logLevel !== 'error') console.info('[INFO]', ...args)
}
export function error(...args: any[]) {
    console.error('[ERROR]', ...args)
}
