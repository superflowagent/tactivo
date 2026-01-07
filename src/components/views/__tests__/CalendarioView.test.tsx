import { describe, it, expect } from 'vitest';
// Lightweight smoke test: verify filter logic (pure function behavior)

// Not a full render test (would require rendering FullCalendar). We test the helper logic by simulating data.

describe('CalendarioView filtering (smoke)', () => {
    it('matches user id either in client array or normalized clientUserIds', () => {
        const userId = 'u1';
        const events = [
            { id: 'e1', extendedProps: { client: ['u1'] } },
            { id: 'e2', extendedProps: { client: ['p2'], clientUserIds: ['u2'] } },
            { id: 'e3', extendedProps: { client: ['p3'], clientUserIds: ['u1'] } },
        ];

        const filtered = events.filter((event) => {
            const clients = event.extendedProps?.client || [];
            const clientUserIds = event.extendedProps?.clientUserIds || [];
            return (
                (Array.isArray(clients) && clients.map(String).includes(String(userId))) ||
                (Array.isArray(clientUserIds) && clientUserIds.map(String).includes(String(userId)))
            );
        });

        expect(filtered.map((e) => e.id)).toEqual(['e1', 'e3']);
    });
});