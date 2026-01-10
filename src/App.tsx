import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginView } from '@/components/views/LoginView';
import { LandingView } from '@/components/views/LandingView';
import { Panel } from '@/components/Panel';
import ClienteView from '@/components/views/ClienteView';
import PasswordResetView from '@/components/views/PasswordResetView';
import HashPasswordResetRedirect from '@/components/HashPasswordResetRedirect';
import AcceptInviteView from '@/components/views/AcceptInviteView';
import { useEffect } from 'react';

export type ViewType =
  | 'calendario'
  | 'clientes'
  | 'clases'
  | 'ejercicios'
  | 'profesionales'
  | 'programas'
  | 'ajustes';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Detect hash-style password reset links and convert to path route */}
        <HashPasswordResetRedirect />

        <Routes>
          <Route path="/" element={<LandingView />} />
          <Route path="/login" element={<LoginView />} />
          <Route
            path="/:companyName/panel"
            element={
              <ProtectedRoute>
                <Panel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:companyName/panel/cliente/:uid"
            element={
              <ProtectedRoute>
                <ClienteView />
              </ProtectedRoute>
            }
          />
          <Route path="/auth/password-reset" element={<PasswordResetView />} />
          <Route path="/auth/password-reset/:token" element={<PasswordResetView />} />
          <Route path="/password-reset" element={<PasswordResetView />} />
          <Route path="/accept-invite" element={<AcceptInviteView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
