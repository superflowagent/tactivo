import { info, error } from './logger'

interface CreditChange {
    clientId: string
    change: number // +1 for refund, -1 for deduct
}

/**
 * Adjust class_credits for multiple clients using `profiles` table where
 * user_id references the auth user.
 */
async function adjustCredits(changes: CreditChange[]): Promise<void> {
    const promises = changes.map(async ({ clientId, change }) => {
        try {
            // Fetch and update profile using robust helpers that handle different schema variants
            const profile = await (await import('./supabase')).fetchProfileByUserId(clientId)
            const currentCredits = profile?.class_credits ?? 0
            const newCredits = currentCredits + change

            const upd = await (await import('./supabase')).updateProfileByUserId(clientId, { class_credits: newCredits })
            if (upd?.error) throw upd.error

            info(`Updated class_credits for client ${clientId}: ${currentCredits} -> ${newCredits}`)
        } catch (err) {
            error(`Failed to adjust credits for client ${clientId}:`, err)
        }
    })

    await Promise.all(promises)
}

export async function onEventCreate(eventData: any): Promise<void> {
    if (eventData.type !== 'class') return

    const clientIds = Array.isArray(eventData.client) ? eventData.client : []
    if (clientIds.length === 0) return

    const changes: CreditChange[] = clientIds.map((id: string) => ({ clientId: id, change: -1 }))
    await adjustCredits(changes)
}

export async function onEventUpdate(oldData: any, newData: any): Promise<void> {
    const oldType = oldData.type
    const newType = newData.type
    const oldClients = Array.isArray(oldData.client) ? oldData.client : []
    const newClients = Array.isArray(newData.client) ? newData.client : []

    const changes: CreditChange[] = []

    if (oldType === 'class' && newType !== 'class') {
        oldClients.forEach((id: string) => changes.push({ clientId: id, change: +1 }))
    } else if (oldType !== 'class' && newType === 'class') {
        newClients.forEach((id: string) => changes.push({ clientId: id, change: -1 }))
    } else if (oldType === 'class' && newType === 'class') {
        const removed = oldClients.filter((id: string) => !newClients.includes(id))
        const added = newClients.filter((id: string) => !oldClients.includes(id))

        removed.forEach((id: string) => changes.push({ clientId: id, change: +1 }))
        added.forEach((id: string) => changes.push({ clientId: id, change: -1 }))
    }

    if (changes.length > 0) {
        await adjustCredits(changes)
    }
}

export async function onEventDelete(eventData: any): Promise<void> {
    if (eventData.type !== 'class') return

    const clientIds = Array.isArray(eventData.client) ? eventData.client : []
    if (clientIds.length === 0) return

    const changes: CreditChange[] = clientIds.map((id: string) => ({ clientId: id, change: +1 }))
    await adjustCredits(changes)
}

export async function onBatchEventsCreate(eventsData: any[]): Promise<void> {
    const creditMap = new Map<string, number>()

    eventsData.forEach(eventData => {
        if (eventData.type !== 'class') return

        const clientIds = Array.isArray(eventData.client) ? eventData.client : []
        clientIds.forEach((clientId: string) => {
            const current = creditMap.get(clientId) || 0
            creditMap.set(clientId, current - 1)
        })
    })

    const changes: CreditChange[] = Array.from(creditMap.entries()).map(([clientId, change]) => ({
        clientId,
        change
    }))

    if (changes.length > 0) {
        info(`📊 Batch adjusting credits for ${changes.length} client(s)`)
        await adjustCredits(changes)
    }
}
