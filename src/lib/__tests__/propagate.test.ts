import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../supabase', () => ({
    ensureValidSession: vi.fn().mockResolvedValue(true),
    getAuthToken: vi.fn().mockResolvedValue('fake-token'),
}));

const { default: propagateClasses } = await import('../propagate');

describe('propagateClasses', () => {
    let originalFetch: any;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('succeeds when function returns ok', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true, inserted: 2 }),
        });

        const res = await propagateClasses('c1', 2, 2026, [{ id: 't1', day: 1, time: '10:00', duration: 60, client: ['u1'] }]);
        expect(res.ok).toBe(true);
        expect(res.data).toBeDefined();
        expect(res.data.inserted).toBe(2);
    });

    it('returns non-ok result when function responds with error', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ error: 'server error' }),
        });

        const res = await propagateClasses('c1', 2, 2026, [{ id: 't1', day: 1 }]);
        expect(res.ok).toBe(false);
        expect(res.status).toBe(500);
        expect(res.data).toBeDefined();
        expect(res.data.error).toBe('server error');
    });

    it('throws when session invalid', async () => {
        const sup = await import('../supabase');
        (sup.ensureValidSession as any).mockResolvedValue(false);
        await expect(() => propagateClasses('c1', 2, 2026, [{ id: 't1' }])).rejects.toThrow('invalid_session');
    });

    it('retries once on 401 after refreshing session', async () => {
        // simulate first call returns 401, second returns success
        let call = 0;
        globalThis.fetch = vi.fn().mockImplementation(async () => {
            call++;
            if (call === 1) return { ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) };
            return { ok: true, status: 200, json: async () => ({ ok: true, inserted: 3 }) };
        });

        const sup = await import('../supabase');
        (sup.ensureValidSession as any).mockResolvedValue(true);
        (sup.getAuthToken as any).mockResolvedValueOnce('old-token').mockResolvedValueOnce('new-token');

        const res = await propagateClasses('c1', 2, 2026, [{ id: 't1', day: 1 }]);
        expect(res.ok).toBe(true);
        expect(res.data.inserted).toBe(3);
    });

    it('throws when templates missing or empty', async () => {
        await expect(() => propagateClasses('c1', 2, 2026, [])).rejects.toThrow('missing_templates');
        await expect(() => propagateClasses('c1', 2, 2026, null as any)).rejects.toThrow('missing_templates');
    });
});
