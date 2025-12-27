import pb from './pocketbase'
import { debug, info, error } from './logger'

interface CreditChange {
    clientId: string
    change: number // +1 for refund, -1 for deduct
}

/**
 * Adjust class_credits for multiple clients
 */
async function adjustCredits(changes: CreditChange[]): Promise<void> {
    const promises = changes.map(async ({ clientId, change }) => {
        try {
            const client = await pb.collection('users').getOne(clientId)
            const currentCredits = client.class_credits || 0
            const newCredits = currentCredits + change

            await pb.collection('users').update(clientId, {
                class_credits: newCredits
            })
        } catch (err) {
            error(`Failed to adjust credits for client ${clientId}:`, err)
        }
    })

    await Promise.all(promises)
}

/**
 * Handle credit adjustments when creating a class event
 */
export async function onEventCreate(eventData: any): Promise<void> {
    if (eventData.type !== 'class') return

    const clientIds = Array.isArray(eventData.client) ? eventData.client : []
    if (clientIds.length === 0) return

    const changes: CreditChange[] = clientIds.map((id: string) => ({ clientId: id, change: -1 }))
    await adjustCredits(changes)
}

/**
 * Handle credit adjustments when updating an event
 */
export async function onEventUpdate(oldData: any, newData: any): Promise<void> {
    const oldType = oldData.type
    const newType = newData.type
    const oldClients = Array.isArray(oldData.client) ? oldData.client : []
    const newClients = Array.isArray(newData.client) ? newData.client : []

    const changes: CreditChange[] = []

    // Case 1: Type changed from class to non-class → refund all old clients
    if (oldType === 'class' && newType !== 'class') {
        oldClients.forEach((id: string) => changes.push({ clientId: id, change: +1 }))
    }
    // Case 2: Type changed from non-class to class → deduct all new clients
    else if (oldType !== 'class' && newType === 'class') {
        newClients.forEach((id: string) => changes.push({ clientId: id, change: -1 }))
    }
    // Case 3: Type remained "class" → handle client list diff
    else if (oldType === 'class' && newType === 'class') {
        const removed = oldClients.filter((id: string) => !newClients.includes(id))
        const added = newClients.filter((id: string) => !oldClients.includes(id))

        removed.forEach((id: string) => changes.push({ clientId: id, change: +1 }))
        added.forEach((id: string) => changes.push({ clientId: id, change: -1 }))
    }

    if (changes.length > 0) {
        await adjustCredits(changes)
    }
}

/**
 * Handle credit adjustments when deleting a class event
 */
export async function onEventDelete(eventData: any): Promise<void> {
    if (eventData.type !== 'class') return

    const clientIds = Array.isArray(eventData.client) ? eventData.client : []
    if (clientIds.length === 0) return

    const changes: CreditChange[] = clientIds.map((id: string) => ({ clientId: id, change: +1 }))
    await adjustCredits(changes)
}

/**
 * Handle batch credit adjustments for propagated events
 * Aggregates changes per client for efficiency
 */
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
