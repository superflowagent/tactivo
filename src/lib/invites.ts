import { getAuthToken, ensureValidSession } from './supabase';

type SendInviteResult = {
  res: Response;
  json: any;
};

/**
 * Send an invite for a profile using the send-invite Edge Function.
 * - Ensures session validity and retries once on 401 after a refresh.
 * - Throws on network/fetch errors so callers can show useful messages.
 */
export default async function sendInviteByProfileId(
  profileIdOrEmail: string
): Promise<SendInviteResult> {
  if (!profileIdOrEmail) throw new Error('missing_profile_id_or_email');

  // Determine whether the argument is an email address
  const isEmail = profileIdOrEmail.includes('@');

  // Ensure session is valid and obtain token
  let ok = await ensureValidSession();
  if (!ok) throw new Error('invalid_session');

  let token = await getAuthToken();
  if (!token) throw new Error('no_auth_token');

  const doSend = async (tk: string) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invite`;
    try {
      const body = isEmail ? { email: profileIdOrEmail } : { profile_id: profileIdOrEmail };
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tk}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      return { res, json };
    } catch (e: any) {
      // Provide context for network failures
      throw new Error(`send-invite fetch failed (${String(e?.message || e)})`);
    }
  };

  // First attempt
  let result = await doSend(token);

  // If unauthorized, try refresh+retry once
  if (!result.res.ok && result.res.status === 401) {
    ok = await ensureValidSession();
    if (!ok) throw new Error('invalid_session_after_refresh');
    const token2 = await getAuthToken();
    if (!token2) throw new Error('no_auth_token_after_refresh');
    if (token2 !== token) {
      result = await doSend(token2);
    }
  }

  return result;
}
