/*
Simple Express worker for PocketBase credit operations
- Authenticates against PB with PB_SERVICE_EMAIL/PB_SERVICE_PASSWORD
- Re-authenticates automatically on auth failure
- Exposes endpoints:
  POST /api/events/:id/sign  -> { clientId?, force?, callerId? }
  POST /api/events/:id/unsign -> { clientId?, callerId? }
  POST /api/events -> { event }
  PUT  /api/events/:id -> { event }
  DELETE /api/events/:id
- Validates caller by checking that the provided callerId is the owner of the incoming session token
  (calls GET /api/collections/users/records/:callerId with Authorization: Bearer <token>)
- Uses admin token to mutate events and users.class_credits
*/

const express = require('express')
// Node 18+ ships a global fetch; prefer that instead of node-fetch dependency
const fetch = globalThis.fetch
const app = express()
app.use(express.json())

const PB_BASE_URL = process.env.PB_BASE_URL
const PB_SERVICE_EMAIL = process.env.PB_SERVICE_EMAIL
const PB_SERVICE_PASSWORD = process.env.PB_SERVICE_PASSWORD
const PB_ADMIN_TOKEN = process.env.PB_ADMIN_TOKEN
const PORT = process.env.PORT || 4001

if (!PB_BASE_URL || (!(PB_SERVICE_EMAIL && PB_SERVICE_PASSWORD) && !PB_ADMIN_TOKEN)) {
    console.error('Missing PB_BASE_URL and either PB_ADMIN_TOKEN or PB_SERVICE_EMAIL/PB_SERVICE_PASSWORD env vars')
    process.exit(1)
}

let adminToken = PB_ADMIN_TOKEN || null
let adminTokenFetchedAt = PB_ADMIN_TOKEN ? Date.now() : 0

async function adminAuth() {
    // If PB_ADMIN_TOKEN provided, use it and skip password auth
    if (PB_ADMIN_TOKEN) {
        adminToken = PB_ADMIN_TOKEN
        adminTokenFetchedAt = Date.now()
        console.info('Using PB_ADMIN_TOKEN from env')
        return
    }

    // obtain a new admin token via auth-with-password (users collection)
    const url = `${PB_BASE_URL.replace(/\/$/, '')}/api/collections/users/auth-with-password`
    let res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: PB_SERVICE_EMAIL, password: PB_SERVICE_PASSWORD })
    })

    if (res.ok) {
        const j = await res.json()
        adminToken = j.token
        adminTokenFetchedAt = Date.now()
        console.info('Acquired admin token via users auth')
        return
    }

    // If users auth failed, attempt admin auth endpoint (for superuser in _superusers)
    try {
        const adminUrl = `${PB_BASE_URL.replace(/\/$/, '')}/api/admins/auth-with-password`
        const r2 = await fetch(adminUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: PB_SERVICE_EMAIL, password: PB_SERVICE_PASSWORD })
        })
        if (r2.ok) {
            const j2 = await r2.json()
            adminToken = j2.token
            adminTokenFetchedAt = Date.now()
            console.info('Acquired admin token via admin auth endpoint')
            return
        } else {
            const txt = await res.text()
            const txt2 = await r2.text().catch(() => '')
            throw new Error(`admin auth failed: users_auth=${res.status} ${txt}; admins_auth=${r2.status} ${txt2}`)
        }
    } catch (err) {
        throw err
    }
}

async function ensureAdminToken() {
    if (!adminToken) await adminAuth()
    // Optionally: could check token expiry here and refresh if needed
}

async function pbFetch(path, opts = {}) {
    await ensureAdminToken()
    const url = `${PB_BASE_URL.replace(/\/$/, '')}${path}`
    const headers = Object.assign({}, opts.headers || {}, { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' })
    let res = await fetch(url, Object.assign({}, opts, { headers }))
    if (res.status === 401 || res.status === 403) {
        // try reauth once
        try {
            await adminAuth()
            const headers2 = Object.assign({}, opts.headers || {}, { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' })
            res = await fetch(url, Object.assign({}, opts, { headers: headers2 }))
        } catch (err) {
            throw err
        }
    }
    return res
}

// Validate that the token in `authHeader` belongs to the userId provided
async function validateTokenBelongsToUser(authHeader, userId) {
    if (!authHeader) return false
    const cleaned = authHeader.replace(/^Bearer\s+/i, '')
    const url = `${PB_BASE_URL.replace(/\/$/, '')}/api/collections/users/records/${encodeURIComponent(userId)}`
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${cleaned}` } })
    if (!res.ok) return false
    const j = await res.json()
    return j && j.id === userId
}

// Resolve user role from caller token and callerId
async function resolveCaller(authHeader, callerId) {
    if (!authHeader || !callerId) return null
    const cleaned = authHeader.replace(/^Bearer\s+/i, '')
    const url = `${PB_BASE_URL.replace(/\/$/, '')}/api/collections/users/records/${encodeURIComponent(callerId)}`
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${cleaned}` } })
    if (!res.ok) return null
    const j = await res.json()
    return j // object with id, role, etc.
}

// Helper to get event by id (admin)
async function getEvent(eventId) {
    const res = await pbFetch(`/api/collections/events/records/${encodeURIComponent(eventId)}`)
    if (!res.ok) throw new Error('event not found')
    return res.json()
}

// Helper to update event (admin)
async function saveEvent(eventId, body) {
    const res = await pbFetch(`/api/collections/events/records/${encodeURIComponent(eventId)}`, { method: 'PATCH', body: JSON.stringify(body) })
    if (!res.ok) {
        const txt = await res.text()
        throw new Error(`failed to save event: ${res.status} ${txt}`)
    }
    return res.json()
}

// Helper to create event
async function createEvent(body) {
    const res = await pbFetch('/api/collections/events/records', { method: 'POST', body: JSON.stringify(body) })
    if (!res.ok) {
        const txt = await res.text()
        throw new Error(`failed to create event: ${res.status} ${txt}`)
    }
    return res.json()
}

// Helper to get user and adjust credits
async function getUser(userId) {
    const res = await pbFetch(`/api/collections/users/records/${encodeURIComponent(userId)}`)
    if (!res.ok) return null
    return res.json()
}

async function saveUserCredits(userId, newCredits) {
    const res = await pbFetch(`/api/collections/users/records/${encodeURIComponent(userId)}`, { method: 'PATCH', body: JSON.stringify({ class_credits: newCredits }) })
    if (!res.ok) {
        const txt = await res.text()
        throw new Error(`failed to save user credits: ${res.status} ${txt}`)
    }
    return res.json()
}

// compute minutes until event start
function minutesUntilStart(dtStr) {
    const dt = new Date(dtStr)
    return Math.round((dt.getTime() - Date.now()) / (1000 * 60))
}

// Sign handler
app.post('/api/events/:id/sign', async (req, res) => {
    try {
        const eventId = req.params.id
        const { clientId, force, callerId } = req.body || {}
        const authHeader = req.headers['authorization']

        if (!clientId && !callerId) return res.status(400).json({ error: 'clientId or callerId required' })
        const actualClientId = clientId || callerId
        if (!actualClientId) return res.status(400).json({ error: 'clientId required' })

        // Resolve caller identity and role (callerId must be provided)
        if (!callerId) return res.status(400).json({ error: 'callerId required' })
        const caller = await resolveCaller(authHeader, callerId)
        if (!caller) return res.status(401).json({ error: 'invalid caller token' })

        // If caller is client and not acting for themselves, reject
        if (callerId !== actualClientId && caller.role !== 'professional' && caller.role !== 'admin') {
            return res.status(403).json({ error: 'insufficient permissions to sign another user' })
        }

        // Load event
        const evt = await getEvent(eventId)
        const evtType = evt?.type
        if (evtType === 'class') {
            // retrieve company settings
            const companyId = evt.company
            let companyRec = null
            try {
                const r = await pbFetch(`/api/collections/companies/records/${encodeURIComponent(companyId)}`)
                if (r.ok) companyRec = await r.json()
            } catch (e) { }

            // timing check, if caller is professional and force==true we ignore timing and credits
            if (!(force && (caller.role === 'professional' || caller.role === 'admin'))) {
                // Check class_block_mins only applies when class has no clients and a client tries to sign
                const clients = Array.isArray(evt.client) ? evt.client : []
                const minutes = minutesUntilStart(evt.datetime)
                if (clients.length === 0 && companyRec && typeof companyRec.class_block_mins === 'number') {
                    if (minutes < companyRec.class_block_mins) {
                        return res.status(400).json({ error: 'class blocked' })
                    }
                }
            }

            // Credits check unless force by professional
            if (!(force && (caller.role === 'professional' || caller.role === 'admin'))) {
                // get client record
                const c = await getUser(actualClientId)
                if (!c) return res.status(400).json({ error: 'client not found' })
                if ((c.class_credits || 0) <= 0) return res.status(400).json({ error: 'insufficient credits' })
            }

            // add client to event
            const clients = Array.isArray(evt.client) ? evt.client.slice() : []
            if (clients.includes(actualClientId)) return res.status(400).json({ error: 'already signed' })
            clients.push(actualClientId)

            await saveEvent(eventId, { client: clients })

            // deduct credit (allow negative if force admin/professional)
            const cuser = await getUser(actualClientId)
            if (cuser) {
                const current = cuser.class_credits || 0
                const newCredits = current - 1
                await saveUserCredits(actualClientId, newCredits)
            }
        } else {
            // Non-class types: just add client
            const clients = Array.isArray(evt.client) ? evt.client.slice() : []
            if (clients.includes(actualClientId)) return res.status(400).json({ error: 'already signed' })
            clients.push(actualClientId)
            await saveEvent(eventId, { client: clients })
        }

        return res.json({ ok: true })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: String(err) })
    }
})

app.post('/api/events/:id/unsign', async (req, res) => {
    try {
        const eventId = req.params.id
        const { clientId, callerId } = req.body || {}
        const authHeader = req.headers['authorization']
        if (!callerId || !clientId) return res.status(400).json({ error: 'callerId and clientId required' })

        const caller = await resolveCaller(authHeader, callerId)
        if (!caller) return res.status(401).json({ error: 'invalid caller token' })

        // If caller is client, they can only unsign themselves
        if (callerId !== clientId && caller.role !== 'professional' && caller.role !== 'admin') {
            return res.status(403).json({ error: 'insufficient permissions to unsign another user' })
        }

        const evt = await getEvent(eventId)
        const clients = Array.isArray(evt.client) ? evt.client.slice() : []
        if (!clients.includes(clientId)) return res.status(400).json({ error: 'not signed' })

        // time checks (unless caller is professional/admin)
        const companyId = evt.company
        let companyRec = null
        try { const r = await pbFetch(`/api/collections/companies/records/${encodeURIComponent(companyId)}`); if (r.ok) companyRec = await r.json() } catch (e) { }
        if (caller.role !== 'professional' && caller.role !== 'admin') {
            const minutes = minutesUntilStart(evt.datetime)
            if (companyRec && typeof companyRec.class_unenroll_mins === 'number' && minutes < companyRec.class_unenroll_mins) {
                return res.status(400).json({ error: 'too late to unenroll' })
            }
        }

        const newClients = clients.filter(c => c !== clientId)
        await saveEvent(eventId, { client: newClients })

        // refund if class
        if (evt.type === 'class') {
            const cuser = await getUser(clientId)
            if (cuser) {
                const current = cuser.class_credits || 0
                await saveUserCredits(clientId, current + 1)
            }
        }

        return res.json({ ok: true })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: String(err) })
    }
})

// Create event
app.post('/api/events', async (req, res) => {
    try {
        const { event, callerId } = req.body || {}
        const authHeader = req.headers['authorization']
        if (!callerId) return res.status(400).json({ error: 'callerId required' })

        const caller = await resolveCaller(authHeader, callerId)
        if (!caller) return res.status(401).json({ error: 'invalid caller token' })
        if (caller.role !== 'professional' && caller.role !== 'admin') return res.status(403).json({ error: 'insufficient permissions' })

        // For classes: check credits for clients unless force passed (force not supported here for simplicity)
        if (event.type === 'class') {
            const clients = Array.isArray(event.client) ? event.client : []
            for (const cid of clients) {
                const u = await getUser(cid)
                if (!u) return res.status(400).json({ error: `client ${cid} not found` })
                if ((u.class_credits || 0) <= 0) return res.status(400).json({ error: `client ${cid} has insufficient credits` })
            }
        }

        const created = await createEvent(event)

        // Deduct credits for class
        if (event.type === 'class') {
            const clients = Array.isArray(event.client) ? event.client : []
            for (const cid of clients) {
                const u = await getUser(cid)
                if (u) {
                    await saveUserCredits(cid, (u.class_credits || 0) - 1)
                }
            }
        }

        return res.status(201).json(created)
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: String(err) })
    }
})

// Update event
app.put('/api/events/:id', async (req, res) => {
    try {
        const eventId = req.params.id
        const { event, callerId } = req.body || {}
        const authHeader = req.headers['authorization']
        if (!callerId) return res.status(400).json({ error: 'callerId required' })
        const caller = await resolveCaller(authHeader, callerId)
        if (!caller) return res.status(401).json({ error: 'invalid caller token' })
        if (caller.role !== 'professional' && caller.role !== 'admin') return res.status(403).json({ error: 'insufficient permissions' })

        const old = await getEvent(eventId)
        const oldClients = Array.isArray(old.client) ? old.client : []
        const newClients = Array.isArray(event.client) ? event.client : []

        // compute diffs
        const removed = oldClients.filter(x => !newClients.includes(x))
        const added = newClients.filter(x => !oldClients.includes(x))

        // Apply event update
        await saveEvent(eventId, event)

        // Refund removed, deduct added (only for class types)
        const oldType = old.type
        const newType = event.type || oldType

        if (oldType === 'class' && newType !== 'class') {
            // refund all old
            for (const cid of oldClients) {
                const u = await getUser(cid); if (u) await saveUserCredits(cid, (u.class_credits || 0) + 1)
            }
        } else if (oldType !== 'class' && newType === 'class') {
            for (const cid of newClients) {
                const u = await getUser(cid); if (u) await saveUserCredits(cid, (u.class_credits || 0) - 1)
            }
        } else if (oldType === 'class' && newType === 'class') {
            for (const cid of removed) { const u = await getUser(cid); if (u) await saveUserCredits(cid, (u.class_credits || 0) + 1) }
            for (const cid of added) { const u = await getUser(cid); if (u) await saveUserCredits(cid, (u.class_credits || 0) - 1) }
        }

        return res.json({ ok: true })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: String(err) })
    }
})

app.delete('/api/events/:id', async (req, res) => {
    try {
        const eventId = req.params.id
        const authHeader = req.headers['authorization']
        const callerId = req.query.callerId || req.body && req.body.callerId
        if (!callerId) return res.status(400).json({ error: 'callerId required' })
        const caller = await resolveCaller(authHeader, callerId)
        if (!caller) return res.status(401).json({ error: 'invalid caller token' })
        if (caller.role !== 'professional' && caller.role !== 'admin') return res.status(403).json({ error: 'insufficient permissions' })

        const evt = await getEvent(eventId)
        if (evt.type === 'class') {
            const clients = Array.isArray(evt.client) ? evt.client : []
            for (const cid of clients) {
                const u = await getUser(cid); if (u) await saveUserCredits(cid, (u.class_credits || 0) + 1)
            }
        }

        // delete record
        const r = await pbFetch(`/api/collections/events/records/${encodeURIComponent(eventId)}`, { method: 'DELETE' })
        if (!r.ok) { const t = await r.text(); throw new Error(t) }

        return res.status(204).end()
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: String(err) })
    }
})

app.get('/health', async (req, res) => {
    try {
        await ensureAdminToken()
        res.json({ ok: true, authed: !!adminToken })
    } catch (err) {
        res.status(500).json({ ok: false, error: String(err) })
    }
})

app.listen(PORT, () => console.log(`pb-credit-worker listening on ${PORT}`))
