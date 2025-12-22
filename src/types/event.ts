export interface Event {
    id?: string
    type: 'appointment' | 'class' | 'vacation'
    datetime: string
    duration: number
    client?: string[]
    professional?: string[]
    company: string
    cost: number
    paid: boolean
    notes?: string
    created?: string
    updated?: string
}
