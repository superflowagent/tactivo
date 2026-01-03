const fs = require('fs')
    ; (async () => {
        try {
            const envPath = require('path').resolve(process.cwd(), '.env.local')
            const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
            const vars = Object.fromEntries(env.split(/\r?\n/).filter(Boolean).map(l => l.split(/=(.+)/)).map(([k, v]) => [k, v]))
            const ADMIN_SECRET = vars.ADMIN_SECRET
            const SUPABASE_URL = vars.SUPABASE_URL
            if (!ADMIN_SECRET || !SUPABASE_URL) {
                console.error('.env.local missing ADMIN_SECRET or SUPABASE_URL')
                process.exit(1)
            }

            const res = await fetch(`${SUPABASE_URL}/functions/v1/send-invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
                body: JSON.stringify({ email: 'dev+e2e@tactivo.local' })
            })
            console.log('status', res.status)
            const txt = await res.text().catch(() => null)
            console.log('body', txt)
        } catch (e) {
            console.error('error', e)
        }
    })()
