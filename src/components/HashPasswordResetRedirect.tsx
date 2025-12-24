import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function HashPasswordResetRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    const hash = window.location.hash || ''
    // match hash patterns like /auth/password-reset/{TOKEN}
    const m = hash.match(/\/auth\/password-reset\/([^\/?#]+)/)
    if (m) {
      const token = m[1]
      // Navigate to the path-based route so the PasswordResetView mounts
      navigate(`/auth/password-reset/${token}`, { replace: true })
    }
  }, [navigate])

  return null
}

export default HashPasswordResetRedirect
