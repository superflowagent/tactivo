import { useState, useEffect } from 'react';
import { supabase, getFilePublicUrl, getAuthToken } from '@/lib/supabase';

export default function useResolvedFileUrl(
  bucket: string,
  id?: string | null,
  filename?: string | null
) {
  const [url, setUrl] = useState<string | null>(() => {
    try {
      if (!id || !filename) return null;
      // If filename is already a URL, use it
      if (String(filename).startsWith('http')) return String(filename);
      return getFilePublicUrl(bucket, id, filename);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let mounted = true;
    if (!id || !filename) {
      setUrl(null);
      return;
    }

    // If filename is already a full URL, use it and skip signed-url creation
    if (String(filename).startsWith('http')) {
      setUrl(String(filename));
      return () => {
        mounted = false;
      };
    }

    const fileExists = async (bucketName: string, path: string) => {
      try {
        if (!path.includes('/')) {
          // root file
          const { data, error } = await supabase.storage.from(bucketName).list('');
          if (error || !data) return false;
          return data.some((item: any) => item.name === path);
        }
        const parts = path.split('/');
        const folder = parts.slice(0, -1).join('/');
        const filenameOnly = parts[parts.length - 1];
        const { data, error } = await supabase.storage.from(bucketName).list(folder);
        if (error || !data) return false;
        return data.some((item: any) => item.name === filenameOnly);
      } catch {
        return false;
      }
    };

    const init = async () => {
      try {
        // Try public URL first (prefer root then id-prefixed), but verify accessibility
        const pubRoot = getFilePublicUrl(bucket, null, filename);
        if (mounted && pubRoot) {
          try {
            const headRes = await fetch(pubRoot, { method: 'HEAD' });
            if (headRes.ok) {
              setUrl(pubRoot);
              return;
            }
          } catch {
            // HEAD failed or CORS blocked, continue to next candidate
          }
        }
        const pubId = getFilePublicUrl(bucket, id, filename);
        if (mounted && pubId) {
          try {
            const headRes = await fetch(pubId, { method: 'HEAD' });
            if (headRes.ok) {
              setUrl(pubId);
              return;
            }
          } catch {
            // HEAD failed or CORS blocked, continue to signed URL fallback
          }
        }

        // Fallback: attempt to get a signed URL for likely candidate paths via a server-side function (uses service role)
        const candidates = [`${filename}`, `${id}/${filename}`];
        const authToken = await getAuthToken();
        for (const path of candidates) {
          try {
            // Try server-side signed URL generator (stronger permissions than client createSignedUrl)
            const fnUrl = `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/get-signed-url`;
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (authToken) headers.Authorization = `Bearer ${authToken}`;
            const res = await fetch(fnUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify({ bucket, path, expires: 60 * 60 })
            });
            if (!res.ok) {
              // If the server-side attempt fails, try next candidate
              let txt = null;
              try { txt = await res.text(); } catch { }
              console.debug('get-signed-url failed', { status: res.status, body: txt });
              continue;
            }
            const j = await res.json().catch(() => null);
            if (j && j.signedUrl) {
              if (mounted) setUrl(j.signedUrl);
              break;
            }
          } catch {
            // try next candidate
            continue;
          }
        }
      } catch {
        // ignore errors and keep whatever url we have (possibly null)
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [bucket, id, filename]);

  return url;
}
