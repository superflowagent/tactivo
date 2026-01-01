import { useState, useEffect } from 'react'
import { supabase, getFilePublicUrl } from '@/lib/supabase'

export default function useResolvedFileUrl(bucket: string, id?: string | null, filename?: string | null) {
  const [url, setUrl] = useState<string | null>(() => {
    try {
      if (!id || !filename) return null
      return getFilePublicUrl(bucket, id, filename)
    } catch {
      return null
    }
  })

  useEffect(() => {
    let mounted = true
    if (!id || !filename) {
      setUrl(null)
      return
    }

    // If we already have a public url, keep it but still attempt to create a signed url
    const init = async () => {
      try {
        const pub = getFilePublicUrl(bucket, id, filename)
        if (mounted && pub) setUrl(pub)

        // Try to create a signed URL as a fallback or to ensure accessibility
        // (use 1 hour expiry)
        const path = `${id}/${filename}`
        const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60)
        if (mounted && signed?.data?.signedUrl) {
          setUrl(signed.data.signedUrl)
        }
      } catch (err) {
        // ignore errors and keep whatever url we have (possibly null)
      }
    }

    init()

    return () => { mounted = false }
  }, [bucket, id, filename])

  return url
}
