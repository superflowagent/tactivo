import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import pb from '@/lib/pocketbase'
import { error } from '@/lib/logger'

interface User {
  id: string
  email: string
  name: string
  last_name: string
  role: string
  company: string
  photo?: string
}

interface AuthContextType {
  user: User | null
  companyName: string | null
  companyId: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Verificar si hay sesión activa
    checkAuth()
  }, [])

  // Función para normalizar el nombre de la compañía para usar en URL
  const normalizeCompanyName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-') // Reemplazar espacios por guiones
      .replace(/[^a-z0-9-]/g, '') // Eliminar caracteres especiales excepto guiones
  }

  // Sanitizar un dominio (ej: https://example.com/path -> example.com)
  const sanitizeDomain = (domain: string): string => {
    try {
      // Quitar protocolo si existe
      let d = domain.replace(/^https?:\/\//i, '')
      // Quedarse solo con el hostname
      d = d.split('/')[0]
      // Lowercase y eliminar caracteres raros
      return d.toLowerCase().replace(/[^a-z0-9.-]/g, '')
    } catch {
      return domain.toLowerCase().replace(/[^a-z0-9.-]/g, '')
    }
  }

  const getCompanyUrlName = (companyData: any) => {
    if (!companyData) return 'company'
    if (companyData.domain) return sanitizeDomain(companyData.domain)
    if (companyData.name) return normalizeCompanyName(companyData.name)
    return 'company'
  }

  const checkAuth = async () => {
    try {
      if (pb.authStore.isValid && pb.authStore.model) {
        const authData = pb.authStore.model as any

        // Verificar que sea professional
        if (authData.role === 'professional') {
          // Obtener el usuario actual con expand de company
          const userData = await pb.collection('users').getOne(authData.id, {
            expand: 'company'
          })

          const companyData = userData.expand?.company

          setUser({
            id: userData.id,
            email: userData.email,
            name: userData.name,
            last_name: userData.last_name,
            role: userData.role,
            company: userData.company,
            photo: userData.photo,
          })
          // Guardar el ID de la compañía
          setCompanyId(userData.company)
          // Obtener la URL de la compañía (domain si existe, si no normalizar name)
          const companyUrlName = getCompanyUrlName(companyData)
          setCompanyName(companyUrlName)
        } else {
          pb.authStore.clear()
        }
      }
    } catch (err) {
      error('Error checking auth:', err)
      pb.authStore.clear()
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      // Autenticar con PocketBase con expand de company
      const authData = await pb.collection('users').authWithPassword(email, password, {
        expand: 'company'
      })

      // Verificar que sea professional
      if (authData.record.role !== 'professional') {
        pb.authStore.clear()
        throw new Error('Solo los profesionales pueden acceder al panel')
      }

      // Obtener información de la compañía desde el expand o directamente
      let company = authData.record.expand?.company

      // Si el expand no funcionó, obtener la compañía directamente
      if (!company && authData.record.company) {
        try {
          company = await pb.collection('companies').getOne(authData.record.company)
        } catch (err) {
          error('Error obteniendo compañía:', err)
        }
      }

      setUser({
        id: authData.record.id,
        email: authData.record.email,
        name: authData.record.name,
        last_name: authData.record.last_name,
        role: authData.record.role,
        company: authData.record.company,
        photo: authData.record.photo,
      })

      // Guardar el ID de la compañía
      setCompanyId(authData.record.company)
      // Si existe domain, usarlo; sino fallback al name y normalizar
      const companyUrlName = company?.domain ? sanitizeDomain(company.domain) : normalizeCompanyName(company?.name || authData.record.company || 'company')
      setCompanyName(companyUrlName)
    } catch (err: any) {
      error('Login error:', err)
      throw err
    }
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
    setCompanyName(null)
    setCompanyId(null)
  }

  return (
    <AuthContext.Provider value={{ user, companyName, companyId, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
