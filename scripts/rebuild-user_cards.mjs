#!/usr/bin/env node
import PocketBase from 'pocketbase'

const url = process.env.PB_URL || 'https://pocketbase.superflow.es/'
const email = process.env.PB_ADMIN_EMAIL
const password = process.env.PB_ADMIN_PASSWORD

if (!email || !password) {
    console.error('Missing PB_ADMIN_EMAIL or PB_ADMIN_PASSWORD env vars')
    process.exit(1)
}

const pb = new PocketBase(url)

function resolvePhotoUrl(user) {
    try {
        if (user?.photo && typeof user.photo === 'string') {
            return pb.files.getURL(user, user.photo)
        }
    } catch (err) {
        // ignore resolution errors
    }
    return null
}

async function deleteAllUserCards() {
    console.log('Fetching existing user_cards...')
    const existing = await pb.collection('user_cards').getFullList()
    console.log(`Found ${existing.length} user_cards, deleting...`)
    let deleted = 0
    for (const rec of existing) {
        try {
            await pb.collection('user_cards').delete(rec.id)
            deleted++
        } catch (err) {
            console.error('Failed deleting user_card', rec.id, err)
        }
    }
    console.log(`Deleted ${deleted}/${existing.length} user_cards`)
}

async function createFromUsers() {
    console.log('Fetching users...')
    const users = await pb.collection('users').getFullList()
    console.log(`Found ${users.length} users, creating user_cards...`)
    let created = 0
    let failed = 0
    for (const u of users) {
        const cardData = {
            user: u.id,
            name: typeof u.name === 'string' ? u.name : '',
            last_name: typeof u.last_name === 'string' ? u.last_name : '',
            company: typeof u.company === 'string' ? u.company : null,
            role: typeof u.role === 'string' ? u.role : null,
            photo: resolvePhotoUrl(u)
        }

        try {
            await pb.collection('user_cards').create(cardData)
            created++
        } catch (err) {
            failed++
            console.error(`Failed creating user_card for user ${u.id}`, err?.response?.data || err)
        }
    }

    console.log(`Created ${created} user_cards; ${failed} failed`)
}

async function main() {
    try {
        await pb.admins.authWithPassword(email, password)
        console.log('Authenticated as admin')

        await deleteAllUserCards()
        await createFromUsers()

        console.log('Rebuild completed')
    } catch (err) {
        console.error('Error during rebuild:', err)
        if (err?.response?.data) console.error('Response data:', JSON.stringify(err.response.data, null, 2))
        process.exit(1)
    }
}

main()
