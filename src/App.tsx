import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { LoginView } from '@/components/views/LoginView'
import { Panel } from '@/components/Panel'
import PasswordResetView from '@/components/views/PasswordResetView'
import HashPasswordResetRedirect from '@/components/HashPasswordResetRedirect'
import AcceptInviteView from '@/components/views/AcceptInviteView'

export type ViewType = "calendario" | "clientes" | "clases" | "ejercicios" | "profesionales" | "ajustes"

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Detect hash-style password reset links and convert to path route */}
        <HashPasswordResetRedirect />

        <Routes>
          <Route path="/" element={<LoginView />} />
          <Route
            path="/:companyName/panel"
            element={
              <ProtectedRoute>
                <Panel />
              </ProtectedRoute>
            }
          />
          <Route path="/auth/password-reset" element={<PasswordResetView />} />
          <Route path="/auth/password-reset/:token" element={<PasswordResetView />} />
          <Route path="/accept-invite" element={<AcceptInviteView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
