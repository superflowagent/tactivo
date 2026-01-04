import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function HashPasswordResetRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    (async () => {
      const hash = window.location.hash || ''

      // If Supabase appended auth fragments like access_token=... try to process them first
      if (hash.includes('access_token=') || hash.includes('refresh_token=')) {
        try {
          // Call getSessionFromUrl() if available (supabase client may auto-detect, but call explicitly to be robust)
          if (typeof (supabase.auth as any).getSessionFromUrl === 'function') {
            await (supabase.auth as any).getSessionFromUrl()
          }
        } catch {
          // ignore errors
        }
      }

      // match hash patterns like /auth/password-reset/{TOKEN}
      const m = hash.match(/\/auth\/password-reset\/([^\/?#]+)/)
      if (m) {
        const token = m[1]
        // Navigate to the path-based route so the PasswordResetView mounts
        navigate(`/auth/password-reset/${token}`, { replace: true })
        return
      }

      // match fragment-style query such as #/auth/password-reset?invite_token=...&next=...
      const idx = hash.indexOf('/auth/password-reset')
      if (idx !== -1) {
        const frag = hash.slice(idx) // /auth/password-reset?invite_token=...&next=...
        const qIdx = frag.indexOf('?')
        let search = ''
        if (qIdx !== -1) search = frag.slice(qIdx)
        // Preserve invite_token and next into normal search query so PasswordResetView can read them
        navigate(`/auth/password-reset${search}`, { replace: true })
      }
    })()
  }, [navigate])

  return null
}

export default HashPasswordResetRedirect
