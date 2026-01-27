import { createClient } from '@supabase/supabase-js';
import { debug, error as logError } from '@/lib/logger';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // Not throwing to allow builds of non-auth code; environment may be configured elsewhere
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// DEV-only instrumentation: catch any accidental REST queries building malformed `or=` on profiles
if (import.meta.env.DEV) {
  try {
    const _origFetch = ((window as any).fetch(window as any).fetch = async function (
      ...args: any[]
    ): Promise<any> {
      try {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
        if (url && url.includes('/rest/v1/profiles') && url.includes('or=')) {
          // DEV instrumentation: detected profiles OR request (stack omitted)
        }
      } catch {
        // ignore
      }
      return _origFetch.apply(this, args);
    });
  } catch {
    // ignore in environments where fetch cannot be overridden
  }
}

export const getPublicUrl = (bucket: string, path: string) => {
  try {
    const b = bucket;
    const p = encodeURI(path.replace(/^\/+/, ''));
    return supabaseUrl
      ? `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${b}/${p}`
      : null;
  } catch {
    return null;
  }
};

/**
 * Conveniencia para obtener la URL pública de un archivo asociado a un "record".
 * Por convención usa un bucket con el mismo nombre que la "collection" y asume
 * rutas con formato `${id}/${filename}`. Revisa si tus buckets difieren.
 */
export const getFilePublicUrl = (
  collection: string,
  id: string | undefined | null,
  filename: string | undefined | null,
  bucket?: string
) => {
  if (!filename || !supabaseUrl) return null;
  try {
    const b = bucket || collection;
    // Prefer root filename first, then <id>/<filename> for legacy entries
    const candidates = id ? [`${filename}`, `${id}/${filename}`] : [`${filename}`];
    // Return the first candidate public URL (no network check)
    const candidate = candidates[0];
    return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${b}/${encodeURI(
      candidate.replace(/^\/+/, '')
    )}`;
  } catch {
    return null;
  }
};

export const getAuthToken = async () => {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
};

// Ensure the current session's access token is valid. If expired, attempt to refresh
export async function ensureValidSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return false;
    const access = session.access_token;
    const refresh = session.refresh_token;
    if (!access) return false;

    // decode token payload to check exp
    try {
      const payload = access.split('.')[1];
      const decoded = JSON.parse(decodeURIComponent(escape(window.atob(payload))));
      const exp = decoded.exp || decoded.expiration || 0;
      const now = Math.floor(Date.now() / 1000);
      // If token is valid for at least another 30 seconds, we're fine
      if (exp && exp > now + 30) return true;
    } catch {
      // cannot decode, continue to refresh attempt
    }

    // Attempt refresh using GoTrue token endpoint
    if (!refresh) return false;
    const url = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/token`;
    const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refresh)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        apikey: supabaseAnonKey,
      },
      body,
    });
    if (!res.ok) return false;
    const json = await res.json().catch(() => null);
    if (!json || !json.access_token) return false;

    // Try to update client session if client supports it
    try {
      // supabase.auth.setSession exists in newer clients; use it if available
      if (typeof (supabase.auth as any).setSession === 'function') {
        await (supabase.auth as any).setSession({
          access_token: json.access_token,
          refresh_token: json.refresh_token,
        });
      } else if (typeof (supabase.auth as any).refreshSession === 'function') {
        // fallback API if present
        await (supabase.auth as any).refreshSession();
      } else {
        // Last resort: reload page to ensure session is refreshed via cookie flow
        console.warn('No client session setter available; reloading to refresh session');
        window.location.reload();
      }
      return true;
    } catch (e) {
      console.warn('Failed to set new session locally', e);
      try {
        window.location.reload();
      } catch {
        /* ignore */
      }
      return false;
    }
  } catch (e) {
    console.warn('ensureValidSession error', e);
    return false;
  }
}

/**
 * Fetch profile by user id with fallback for legacy schemas.
 * Tries columns in order: `user` (current schema), `id`, `user_id` (legacy).
 */
export async function fetchProfileByUserId(userId: string) {
  if (!userId) return null;

  // Prefer RPC to avoid PostgREST column-name parsing issues for reserved column names like "user"
  try {
    const sessionRes = await supabase.auth.getSession();
    debug('fetchProfileByUserId session:', sessionRes);
    const access = sessionRes?.data?.session?.access_token;
    debug('fetchProfileByUserId access_token present:', !!access);

    const { data, error } = await supabase.rpc('get_profile_by_user', { p_user: userId });
    if (!error && data) return data;
    if (error) {
      debug('RPC get_profile_by_user error:', error);
    }
  } catch (e) {
    debug('RPC get_profile_by_user threw:', e);
    // ignore and fallthrough to direct selects
  }

  // try current 'user' column
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user', userId)
      .maybeSingle();
    if (!error && data) return data;
  } catch {
    // ignore and fallthrough
  }

  // try primary key 'id'
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (!error && data) return data;
  } catch {
    // ignore and fallthrough
  }

  // legacy 'user_id' removed — prefer 'user' or 'id' only (column not present)
  // skipped user_id for performance and to avoid 400 errors.

  return null;
}

/**
 * Update the profile identified by a user id; tries columns in order and returns the result.
 */
export async function updateProfileByUserId(userId: string, payload: any) {
  if (!userId) return { error: 'missing userId' };
  // try 'id' first (safer when 'user' column causes PostgREST issues)
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select()
      .maybeSingle();
    if (!error && data) return { data, error: null };
  } catch {
    // ignore
  }
  // try 'user'
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('user', userId)
      .select()
      .maybeSingle();
    if (!error && data) return { data, error: null };
  } catch {
    // ignore
  }
  // legacy 'user_id' removed — update by 'id' or 'user' only.

  return { error: 'not_updated' };
}

/** Delete profile rows matching the given user id using available schema columns */
export async function deleteProfileByUserId(userId: string) {
  if (!userId) return { error: 'missing userId' };
  // try delete by primary key id first
  try {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (!error) return { deleted: true };
  } catch {
    // ignore
  }
  // then try by 'user' column
  try {
    const { error } = await supabase.from('profiles').delete().eq('user', userId);
    if (!error) return { deleted: true };
  } catch {
    // ignore
  }
  // legacy 'user_id' removed — delete by 'id' or 'user' only.
  return { error: 'not_deleted' };
}

/**
 * Request server-side delete of both profile and auth user using a Functions endpoint
 * This calls the Supabase Edge Function `delete-user` which runs with the Service Role
 * and removes the auth user (if present) and the profile row. Caller must be authenticated
 * and authorized (the function enforces company-role checks).
 */
export async function deleteUserByProfileId(profileId: string) {
  if (!profileId) return { error: 'missing profileId' };
  try {
    const token = await getAuthToken();
    const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/delete-user`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    // Do not send the anon apikey header in browser requests to avoid triggering CORS preflight issues;
    // the function accepts Bearer tokens or admin secret headers for admin calls.
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ profile_id: profileId }),
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data: json };
  } catch (e) {
    const msg = (e as any)?.message ?? String(e);
    return { error: String(msg) };
  }
}

// Helper to compress videos on the client before uploading. Use this for any frontend
// uploads to ensure files are reasonable in size. It falls back to the original file on errors.
import { compressVideoFile } from './video';
export const uploadVideoWithCompression = async (
  bucket: string,
  path: string,
  file: File,
  options?: any,
  meta?: { company?: string; exerciseId?: string }
) => {
  try {
    let toUpload = file;
    if (file.type?.startsWith('video/')) {
      try {
        // Attempt client-side compression; allow longer time for large/slow files
        const compressAttemptTimeoutMs = 45_000; // 45s fail-fast attempt
        try {
          toUpload = await Promise.race([
            compressVideoFile(file),
            new Promise<File>((_res, rej) =>
              setTimeout(
                () => rej(new Error('compression attempt timed out')),
                compressAttemptTimeoutMs
              )
            ),
          ]);
        } catch {
          // compression failed within timeout; proceed with original file
          toUpload = file;
        }
      } catch {
        // fallback to original on unexpected errors
        toUpload = file;
      }
    }

    // If file is large, attempt direct storage upload (no Edge Function fallback)
    const directUploadAbove = 5 * 1024 * 1024; // 5MB
    if ((toUpload as File).size > directUploadAbove) {
      try {
        const parts = (path || '').split('/');
        const company = meta?.company ?? (parts.length > 0 ? parts[0] : null);
        const exerciseId = meta?.exerciseId ?? (parts.length > 1 ? parts[1] : null);
        const filenameOnly = (toUpload as File).name || 'file';
        const dirPartLarge = company && exerciseId ? `${company}/${exerciseId}` : null;
        const finalFilenameLarge = filenameOnly;
        const pathToUploadLarge = dirPartLarge ? `${dirPartLarge}/${finalFilenameLarge}` : finalFilenameLarge;

        const uploadPromiseLarge = supabase.storage.from(bucket).upload(pathToUploadLarge, toUpload, options);
        const timeoutMsLarge = 120_000; // allow longer timeout for large files
        const timeoutPromiseLarge = new Promise((_res, rej) =>
          setTimeout(() => rej(new Error('upload timed out')), timeoutMsLarge)
        );
        const uploadResultLarge = (await Promise.race([uploadPromiseLarge, timeoutPromiseLarge])) as any;
        if (uploadResultLarge?.error) {
          throw uploadResultLarge.error;
        }
        const returnedPath = pathToUploadLarge;
        return { data: { path: returnedPath }, error: null };
      } catch (err) {
        logError('uploadVideoWithCompression: large file direct upload failed', err);
        return { data: null, error: err };
      }
    }

    // Wrap upload with a timeout to avoid hanging indefinitely
    // Before attempting client upload, ensure session is valid; if not, return an error (no Edge Function fallback)
    const sessionValid = await ensureValidSession();
    if (!sessionValid) {
      return { data: null, error: new Error('session_invalid') };
    }

    // Use the compressed file's name if it changed so extension/content-type matches
    const filenameOnlyFromPath = path && path.includes('/') ? path.split('/').slice(-1)[0] : path;
    const dirPart = path && path.includes('/') ? path.split('/').slice(0, -1).join('/') : null;
    const finalFilenameRaw = (toUpload as File).name || filenameOnlyFromPath || 'file';
    // Sanitize filename to avoid storage rejecting keys with non-ASCII / unsafe chars
    const { sanitizeFilename } = await import('./stringUtils');
    const finalFilename = sanitizeFilename(finalFilenameRaw);
    const pathToUpload = dirPart ? `${dirPart}/${finalFilename}` : finalFilename;

    // If the current user is a professional, proceed with direct upload; RLS policies should permit uploads
    try {
      const sess = await supabase.auth.getSession();
      const userId = (sess as any)?.data?.session?.user?.id;
      if (userId) {
        const profile = await fetchProfileByUserId(userId);
        if (profile?.role === 'professional') {
          debug(
            'uploadVideoWithCompression: user role = professional; proceeding with direct storage upload (RLS policies expected to allow uploads under company path)'
          );
        }
      }
    } catch {
      // ignore errors here and proceed with the regular upload attempt
    }

    const uploadPromise = supabase.storage.from(bucket).upload(pathToUpload, toUpload, options);
    const timeoutMs = 60_000; // 60s
    const timeoutPromise = new Promise((_res, rej) =>
      setTimeout(() => rej(new Error('upload timed out')), timeoutMs)
    );

    let uploadResult: any;
    try {
      uploadResult = (await Promise.race([uploadPromise, timeoutPromise])) as any;
    } catch (err) {
      logError('uploadVideoWithCompression: upload promise rejected', err);
      const msg = String((err as any)?.message || err || '').toLowerCase();

      // Transient upstream errors (502 / invalid response): short retry
      if (msg.includes('invalid response') || msg.includes('bad gateway') || (err as any)?.status === 502) {
        try {
          await new Promise((r) => setTimeout(r, 1000));
          const retryPromise = supabase.storage.from(bucket).upload(pathToUpload, toUpload, options);
          uploadResult = (await Promise.race([retryPromise, timeoutPromise])) as any;
        } catch (retryErr) {
          logError('uploadVideoWithCompression: retry after transient storage error failed', retryErr);
          return { data: null, error: retryErr };
        }
      }

      // RLS / permission issues: try refresh + retry once
      if (
        msg.includes('row-level security') ||
        msg.includes('violates') ||
        (err as any)?.status === 403
      ) {
        try {
          await ensureValidSession();
          // Retry upload once
          try {
            const retryPromise = supabase.storage.from(bucket).upload(pathToUpload, toUpload, options);
            uploadResult = (await Promise.race([retryPromise, timeoutPromise])) as any;
          } catch (retryErr) {
            logError('uploadVideoWithCompression: retry after refresh failed', retryErr);
            return { data: null, error: retryErr };
          }
        } catch (refreshErr) {
          logError('uploadVideoWithCompression: session refresh failed', refreshErr);
          return { data: null, error: refreshErr };
        }
      }

      return { data: null, error: err };
    }

    const { data, error } = uploadResult as any;
    const errMsg = String(error?.message || '').toLowerCase();
    if (error) {
      if (
        errMsg.includes('row-level security') ||
        errMsg.includes('violates') ||
        error?.status === 403 ||
        error?.statusCode === '403'
      ) {
        debug(
          'uploadVideoWithCompression: upload result indicates RLS or permission failure; will attempt edge-function fallback',
          error
        );
      } else {
        logError('uploadVideoWithCompression: upload result error', error);
      }
    }

    // If storage returned a RLS-like error in manifested object, do not attempt Edge Function fallback; return error
    if (
      error &&
      (errMsg.includes('row-level security') ||
        errMsg.includes('violates') ||
        error?.status === 403 ||
        error?.statusCode === '403')
    ) {
      debug(
        'uploadVideoWithCompression: detected RLS in storage response and no Edge Function fallback is configured; returning error',
        error
      );
      // Provide a clearer, actionable error for UI
      const userErr = new Error('upload_permission_denied: comprueba que tu sesión esté activa y que el archivo se suba bajo el path company/{exerciseId}/{filename}');
      (userErr as any).original = error;
      return { data: null, error: userErr };
    }

    return { data, error };
  } catch (err) {
    logError('uploadVideoWithCompression: error', err);
    return { data: null, error: err };
  }
};
