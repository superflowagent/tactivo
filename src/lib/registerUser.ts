type RegisterPayload = {
  email: string;
  centro: string;
  name: string;
  last_name: string;
  movil?: string;
};

export default async function registerUser(payload: RegisterPayload) {
  // Use unified create-account function for public registrations
  const url = `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/create-account`;
  try {
    const body = {
      email: payload.email,
      name: payload.name,
      last_name: payload.last_name,
      phone: payload.movil,
      role: 'professional',
      create_company: true,
      company_name: payload.centro,
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  } catch (e: any) {
    throw new Error(`register-user fetch failed: ${String(e?.message || e)}`);
  }
}
