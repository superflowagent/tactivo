import { vi } from 'vitest';

// Global mock for supabase client to avoid background timers and real network calls
// during unit tests which can keep the test runner alive.
vi.mock('@/lib/supabase', () => {
    const mockStorageFrom = vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const mockSupabase = {
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        },
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            update: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
        }),
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
        storage: {
            from: mockStorageFrom,
        },
    } as any;

    return {
        supabase: mockSupabase,
        getAuthToken: vi.fn().mockResolvedValue(null),
        ensureValidSession: vi.fn().mockResolvedValue(false),
        getFilePublicUrl: vi.fn().mockReturnValue(null),
        uploadVideoWithCompression: vi.fn().mockResolvedValue({ data: null, error: 'mock' }),
        fetchProfileByUserId: vi.fn().mockResolvedValue(null),
        deleteUserByProfileId: vi.fn().mockResolvedValue({ error: 'not_deleted' }),
    };
});
