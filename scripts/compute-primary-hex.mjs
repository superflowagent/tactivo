import fs from 'fs'
const css = fs.readFileSync('./src/index.css', 'utf8')
const m = css.match(/--primary:\s*([0-9.]+)\s*([0-9.]+)%\s*([0-9.]+)%/)
if (!m) { console.log('primary color not found'); process.exit(0) }
const h = Number(m[1]), s = Number(m[2]), l = Number(m[3])
const toHex = (h, s, l) => {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l)
    const f = n => {
        const k = (n + h / 30) % 12
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
        return Math.round(255 * color).toString(16).padStart(2, '0')
    }
    return `#${f(0)}${f(8)}${f(4)}`
}
console.log('primary HSL:', h, s, l, 'hex:', toHex(h, s, l))
