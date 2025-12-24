import PocketBase from 'pocketbase'
import fs from 'fs'
import path from 'path'

function parsePrimaryFromCss(cssPath) {
    const css = fs.readFileSync(cssPath, 'utf8')
    const m = css.match(/--primary:\s*([0-9.]+)\s*([0-9.]+)%\s*([0-9.]+)%\s*;/)
    if (!m) return null
    const h = Number(m[1])
    const s = Number(m[2])
    const l = Number(m[3])
    return { h, s, l }
}

function hslToHex(h, s, l) {
    // h in [0,360], s,l in [0,100]
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
        const k = (n + h / 30) % 12
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
        return Math.round(255 * color).toString(16).padStart(2, '0')
    }
    return `#${f(0)}${f(8)}${f(4)}`
}

function buildTemplates({ hsl, hex }) {
    const hslStr = `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`
    const subject = 'Restablece tu contraseña — Tactivo'
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color: #111;">
    <div style="max-width:600px;margin:0 auto;padding:24px;text-align:left;">
      <h2 style="margin:0 0 8px 0;text-align:left;">Hola,</h2>
      <p style="margin:0 0 16px 0;text-align:left;">Recibimos una solicitud para restablecer tu contraseña. Pulsa el botón de abajo para establecer una nueva contraseña:</p>
      <p style="margin:18px 0;">
        <a href="{{ .PasswordResetURL }}" style="background-color:${hex};display:inline-block;padding:10px 18px;border-radius:8px;color:#fff;text-decoration:none;font-weight:600;">Restablecer contraseña</a>
      </p>
      <p style="margin:0 0 8px 0;text-align:left;">Si no solicitaste este cambio, puedes ignorar este email.</p>
      <p style="margin:16px 0 0 0;text-align:left;">Saludos,<br/>El equipo de Tactivo</p>
      <hr style="margin-top:20px;border:none;border-top:1px solid #eee" />
      <small style="color:#666;text-align:left;display:block;">Si el botón no funciona, copia y pega este enlace en tu navegador: {{ .PasswordResetURL }}</small>
    </div>
  </body>
</html>`

    const text = `Hola,\n\nRecibimos una solicitud para restablecer tu contraseña. Usa este enlace:\n\n{{ .PasswordResetURL }}\n\nSi no solicitaste este cambio, puedes ignorar este email.\n\nSaludos,\nEl equipo de Tactivo`;
    return { subject, html, text }
}

async function run() {
    const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'
    const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL
    const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        console.error('Please set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD environment variables')
        process.exit(1)
    }

    const cssPath = path.resolve(process.cwd(), 'src', 'index.css')
    const hsl = parsePrimaryFromCss(cssPath) || { h: 217, s: 91, l: 60 }
    const hex = hslToHex(hsl.h, hsl.s, hsl.l)

    const templates = buildTemplates({ hsl, hex })

    const pb = new PocketBase(PB_URL)

    try {
        await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD)
        console.log('Authenticated as admin')

        // Update settings: set mail.templates.requestPasswordReset
        const update = {
            mail: {
                templates: {
                    requestPasswordReset: {
                        subject: templates.subject,
                        html: templates.html,
                        text: templates.text
                    }
                }
            }
        }

        await pb.settings.update(update)
        console.log('Updated PocketBase mail template: requestPasswordReset')

        if (process.argv.includes('--test')) {
            console.log('Sending test email to admin...')
            // pb.settings.testEmail(collection?, email, template)
            await pb.settings.testEmail(null, ADMIN_EMAIL, 'requestPasswordReset')
            console.log('Test email requested (check admin inbox)')
        } else {
            console.log('Run with --test to send a test email to admin')
        }

        pb.authStore.clear()
    } catch (err) {
        console.error('Error:', err)
        process.exit(1)
    }
}

// ESM-compatible main check
if (process.argv[1] && process.argv[1].endsWith('set-pocketbase-email-reset.mjs')) {
    run()
}
