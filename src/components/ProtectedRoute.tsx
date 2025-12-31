import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect } from 'react'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, companyName } = useAuth()
  const navigate = useNavigate()
  const { companyName: routeCompany } = useParams()

  useEffect(() => {
    if (isLoading || !user) return

    const ensureCanonical = async () => {
      // If we already have companyName in context and it differs from the route, redirect
      if (companyName && companyName !== routeCompany) {
        console.debug('ProtectedRoute: redirecting to canonical company route', companyName)
        navigate(`/${companyName}/panel`, { replace: true })
        return
      }

      // If no companyName available yet, fetch the user's profile and company domain and redirect
      if (!companyName && user?.id) {
        try {
          const fetcher = await import('@/lib/supabase')
          const profile = await fetcher.fetchProfileByUserId(user.id)
          if (profile?.company) {
            const { data: comp } = await fetcher.supabase.from('companies').select('domain').eq('id', profile.company).maybeSingle()
            const sanitizeDomain = (domain: string) => {
              try {
                let d = domain.replace(/^https?:\/\//i, '')
                d = d.split('/')[0]
                return d.toLowerCase().replace(/[^a-z0-9.-]/g, '')
              } catch {
                return domain
              }
            }
            const domain = comp?.domain ? sanitizeDomain(comp.domain) : null
            if (domain && domain !== routeCompany) {
              console.debug('ProtectedRoute: fetched domain and redirecting to', domain)
              navigate(`/${domain}/panel`, { replace: true })
            }
          }
        } catch (e) {
          // ignore — we don't want to block rendering
          console.debug('ProtectedRoute: error resolving canonical company', e)
        }
      }
    }

    ensureCanonical()
  }, [isLoading, user, companyName, routeCompany, navigate])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
            <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Cargando...</span>
          </div>
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
