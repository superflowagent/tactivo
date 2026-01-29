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
      // Do not return public URL immediately to avoid unnecessary HEAD/GET failures for private buckets.
      return null;
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

    const init = async () => {
      try {
        // Simplified: use the provided filename (photo_path) directly and request a signed URL from server.
        const path = String(filename);
        const authToken = await getAuthToken();
        const fnUrl = `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/get-signed-url`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authToken) headers.Authorization = `Bearer ${authToken}`;
        const res = await fetch(fnUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ bucket, path, expires: 60 * 60 })
        });
        if (!res.ok) {
          // In production, fail silently; in dev, log a short diagnostic
          if (import.meta.env.DEV) {
            let txt = null;
            try { txt = await res.text(); } catch { }
            try { console.debug('useResolvedFileUrl: signed-url call failed', res.status, txt && txt.slice ? (txt.slice(0, 200) + '...') : txt); } catch (e) { }
          }
          return;
        }
        const j = await res.json().catch(() => null);
        if (j && j.signedUrl) {
          if (mounted) setUrl(j.signedUrl);
        } else if (j && j.error === 'object_not_found') {
          // Missing object is expected; do not log to avoid console noise
          return;
        } else {
          if (import.meta.env.DEV) {
            try { console.debug('useResolvedFileUrl: signed-url no url returned', bucket, path, j && j.error); } catch (e) { }
          }
        }
      } catch (err: unknown) {
        try {
          const msg = err instanceof Error ? err.message : String(err);
          console.debug('useResolvedFileUrl: signed-url error', msg);
        } catch (e) { }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [bucket, id, filename]);

  return url;
}
