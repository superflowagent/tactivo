import { getAuthToken, ensureValidSession } from './supabase';

export default async function propagateClasses(
    companyId: string,
    month: number,
    year: number,
    templates: any[]
) {
    if (!companyId) throw new Error('missing_company');
    if (!month || !year) throw new Error('missing_month_or_year');
    if (!templates || !Array.isArray(templates) || templates.length === 0) throw new Error('missing_templates');

    let ok = await ensureValidSession();
    if (!ok) throw new Error('invalid_session');
    const token = await getAuthToken();
    if (!token) throw new Error('no_auth_token');

    const url = `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/propagate-classes`;

    const doCall = async (tk: string) => {
        const body = { company: companyId, month, year, templates };
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tk}`,
            },
            body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => null);
        return { res, json };
    };

    try {
        // First attempt
        let { res, json } = await doCall(token);

        // If unauthorized, try to refresh session once and retry
        if (!res.ok && res.status === 401) {
            const refreshed = await ensureValidSession();
            if (refreshed) {
                const token2 = await getAuthToken();
                if (token2 && token2 !== token) {
                    ({ res, json } = await doCall(token2));
                }
            }
        }

        return { ok: res.ok, status: res.status, data: json };
    } catch (e: any) {
        throw new Error(`propagate-classes fetch failed (${String(e?.message || e)})`);
    }
}
