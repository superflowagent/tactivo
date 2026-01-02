import { useState, useEffect } from 'react'
import { supabase, getFilePublicUrl } from '@/lib/supabase'

export default function useResolvedFileUrl(bucket: string, id?: string | null, filename?: string | null) {
    const [url, setUrl] = useState<string | null>(() => {
        try {
            if (!id || !filename) return null
            // If filename is already a URL, use it
            if (String(filename).startsWith('http')) return String(filename)
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

        // If filename is already a full URL, use it and skip signed-url creation
        if (String(filename).startsWith('http')) {
            setUrl(String(filename))
            return () => { mounted = false }
        }

        const fileExists = async (bucketName: string, path: string) => {
            try {
                if (!path.includes('/')) {
                    // root file
                    const { data, error } = await supabase.storage.from(bucketName).list('')
                    if (error || !data) return false
                    return data.some((item: any) => item.name === path)
                }
                const parts = path.split('/')
                const folder = parts.slice(0, -1).join('/')
                const filenameOnly = parts[parts.length - 1]
                const { data, error } = await supabase.storage.from(bucketName).list(folder)
                if (error || !data) return false
                return data.some((item: any) => item.name === filenameOnly)
            } catch {
                return false
            }
        }

        const init = async () => {
            try {
                // Try public URL first (prefer root then id-prefixed)
                const pubRoot = getFilePublicUrl(bucket, null, filename)
                if (mounted && pubRoot) {
                    setUrl(pubRoot)
                    return
                }
                const pubId = getFilePublicUrl(bucket, id, filename)
                if (mounted && pubId) {
                    setUrl(pubId)
                    return
                }

                // Fallback: attempt to create signed URL only for existing objects, prefer root then id-prefixed
                const candidates = [`${filename}`, `${id}/${filename}`]
                for (const path of candidates) {
                    try {
                        const exists = await fileExists(bucket, path)
                        if (!exists) continue
                        const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60)
                        if (signed?.data?.signedUrl) {
                            if (mounted) setUrl(signed.data.signedUrl)
                            break
                        }
                    } catch {
                        // try next candidate
                        continue
                    }
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
