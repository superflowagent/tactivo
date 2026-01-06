type RegisterPayload = {
  email: string;
  centro: string;
  name: string;
  last_name: string;
  movil?: string;
};

export default async function registerUser(payload: RegisterPayload) {
  const url = `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/register-user`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  } catch (e: any) {
    throw new Error(`register-user fetch failed: ${String(e?.message || e)}`);
  }
}
