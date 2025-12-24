import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL || 'https://pocketbase.superflow.es'
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('PB admin credentials required in env')
    process.exit(1)
}

async function run() {
    const pb = new PocketBase(PB_URL)
    try {
        await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD)
        console.log('Authenticated')

        const endpoints = [
            '/api/settings/templates',
            '/api/settings/mail/templates',
            '/api/admin/templates',
            '/api/admin/mail/templates',
            '/api/templates',
            '/api/mail/templates',
            '/api/settings/mail'
        ]

        for (const ep of endpoints) {
            try {
                const res = await pb.client.send(ep, { method: 'GET' })
                console.log('\nGOT', ep, '->', JSON.stringify(res, null, 2))
            } catch (err) {
                console.log('\nERR', ep, '->', err?.response?.data || err?.message || err)
            }
        }

        // Also fetch settings via SDK getAll
        const settings = await pb.settings.getAll()
        console.log('\nSettings dump (partial):', JSON.stringify(settings, null, 2))

        pb.authStore.clear()
    } catch (e) {
        console.error('Auth/update error:', e)
    }
}

run()
