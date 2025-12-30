import pb from './pocketbase'
import { error as logError } from './logger'

export async function syncUserCardOnUpsert(userRecord: any) {
    try {
        if (!userRecord?.id) return
        const filter = `user = "${userRecord.id}"`
        const list = await pb.collection('user_cards').getList(1, 1, { filter })
        // Build sanitized card data: only include primitive values to avoid schema validation errors
        const cardData: any = {
            user: userRecord.id,
            name: typeof userRecord.name === 'string' ? userRecord.name : '',
            last_name: typeof userRecord.last_name === 'string' ? userRecord.last_name : '',
            company: typeof userRecord.company === 'string' ? userRecord.company : null,
            role: typeof userRecord.role === 'string' ? userRecord.role : null,
        }

        // Try to set a photo URL string if possible. If the incoming value is not a string
        // (e.g. upload metadata), fetch the fresh user record and extract the filename.
        let photoUrl: string | null = null
        try {
            if (userRecord.photo && typeof userRecord.photo === 'string') {
                photoUrl = pb.files.getURL(userRecord, userRecord.photo)
            } else if (userRecord.id) {
                // Try refetching the user to get a normalized photo field
                const fresh = await pb.collection('users').getOne(userRecord.id)
                if (fresh?.photo && typeof fresh.photo === 'string') {
                    photoUrl = pb.files.getURL(fresh, fresh.photo)
                }
            }
        } catch (err) {
            // ignore photo resolution failures — fallback to null
            logError('Could not resolve user photo URL:', err)
        }
        cardData.photo = photoUrl

        if (list?.items?.length) {
            const existing = list.items[0]
            // Prepare update payload without the 'user' relation to avoid schema mismatches
            const updateData: any = {
                name: cardData.name,
                last_name: cardData.last_name,
                company: cardData.company,
                role: cardData.role,
            }

            // Include photo URL only when available as a string
            if (typeof cardData.photo === 'string' && cardData.photo) {
                updateData.photo = cardData.photo
            } else if (cardData.photo === null) {
                // Explicitly set photo to null when the user removed their photo
                updateData.photo = null
            }

            try {
                await pb.collection('user_cards').update(existing.id, updateData)
            } catch (err: any) {
                // If update fails (schema mismatch), try delete + create fallback
                logError('Update user_card failed, attempting delete+create:', err)
                try {
                    await pb.collection('user_cards').delete(existing.id)
                    // Create with sanitized cardData (photo already sanitized above)
                    await pb.collection('user_cards').create(cardData)
                } catch (err2) {
                    logError('Delete+create fallback also failed:', err2)
                    throw err2
                }
            }
        } else {
            await pb.collection('user_cards').create(cardData)
        }
    } catch (err: any) {
        // Provide detailed error info when possible
        logError('Error sincronizando user_card:', err)
        if (err?.response?.data) logError('Response data:', err.response.data)
        if (err?.data) logError('Error data:', err.data)
    }
}

export async function deleteUserCardForUser(userId: string) {
    try {
        if (!userId) return
        const filter = `user = "${userId}"`
        const list = await pb.collection('user_cards').getList(1, 1, { filter })
        if (list?.items?.length) {
            await pb.collection('user_cards').delete(list.items[0].id)
        }
    } catch (err) {
        logError('Error eliminando user_card:', err)
    }
}

// Fetch user_cards for a set of user IDs and return a map keyed by user id.
export async function getUserCardsByIds(ids: string[]) {
    try {
        if (!ids || ids.length === 0) return {}

        // Use equality for a single id; for multiple ids prefer an OR expression
        // (e.g., `user = "id1" || user = "id2"`) because PocketBase can reject `in(...)`
        // when `user` is a relation field.
        const filter = ids.length === 1
            ? `user = "${ids[0]}"`
            : ids.map(id => `user = "${id}"`).join(' || ')

        const records = await pb.collection('user_cards').getFullList({ filter })
        const map: Record<string, any> = {}
        const userIds: string[] = []
        for (const r of records) {
            if (r?.user) {
                map[r.user] = r
                userIds.push(r.user)
            }
        }

        // Enrich map entries with class_credits from the users collection when available
        try {
            const userFetches = userIds.map(id => pb.collection('users').getOne(id).catch(() => null))
            const users = await Promise.all(userFetches)
            for (const u of users) {
                if (u && u.id && typeof u.class_credits !== 'undefined') {
                    if (map[u.id]) map[u.id].class_credits = u.class_credits
                } else if (u && u.id) {
                    if (map[u.id]) map[u.id].class_credits = 0
                }
            }
        } catch (err) {
            logError('Error fetching users for credits:', err)
        }

        return map
    } catch (err: any) {
        logError('Error fetching user_cards by ids:', err)
        if (err?.response?.data) logError('Response data:', err.response.data)
        return {}
    }
}

// Fetch user_cards for a specific company and role (e.g., 'client' or 'professional')
export async function getUserCardsByRole(companyId: string, role: string) {
    try {
        if (!companyId || !role) return []
        const filter = `company = "${companyId}" && role = "${role}"`
        const records = await pb.collection('user_cards').getFullList({ filter, sort: 'name' })

        // Enrich records with class_credits from the users collection
        try {
            const userIds = records.map(r => r.user).filter(Boolean)
            const userFetches = userIds.map(id => pb.collection('users').getOne(id).catch(() => null))
            const users = await Promise.all(userFetches)
            const userMap: Record<string, any> = {}
            for (const u of users) {
                if (u && u.id) userMap[u.id] = u
            }
            for (const r of records) {
                if (r?.user && userMap[r.user] && typeof userMap[r.user].class_credits !== 'undefined') {
                    r.class_credits = userMap[r.user].class_credits
                } else {
                    r.class_credits = 0
                }
            }
        } catch (err) {
            logError('Error fetching users for credits:', err)
        }

        return records
    } catch (err) {
        logError('Error fetching user_cards by role:', err)
        return []
    }
}
