import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import ActionButton from '@/components/ui/ActionButton';
import InviteToast from '@/components/InviteToast';
import { Menu } from 'lucide-react';
const CalendarioView = lazy(() =>
  import('@/components/views/CalendarioView').then((m) => ({ default: m.CalendarioView }))
);
const ClientesView = lazy(() =>
  import('@/components/views/ClientesView').then((m) => ({ default: m.ClientesView }))
);
const ClasesView = lazy(() =>
  import('@/components/views/ClasesView').then((m) => ({ default: m.ClasesView }))
);
const ProfesionalesView = lazy(() =>
  import('@/components/views/ProfesionalesView').then((m) => ({ default: m.ProfesionalesView }))
);
const AjustesView = lazy(() =>
  import('@/components/views/AjustesView').then((m) => ({ default: m.AjustesView }))
);
const EjerciciosView = lazy(() =>
  import('@/components/views/EjerciciosView').then((m) => ({ default: m.EjerciciosView }))
);
const ProgramasView = lazy(() =>
  import('@/components/views/ProgramasViewNew').then((m) => ({ default: m.ProgramasView }))
);

export type ViewType =
  | 'calendario'
  | 'clientes'
  | 'clases'
  | 'ejercicios'
  | 'profesionales'
  | 'programas'
  | 'ajustes';

function MobileHamburgerButton() {
  const { toggleSidebar } = useSidebar();
  return (
    <ActionButton
      tooltip="Expandir menú"
      className="md:hidden h-7 w-7"
      onClick={toggleSidebar}
      aria-label="Expandir menú"
    >
      <Menu className="h-5 w-5" />
    </ActionButton>
  );
}

export function Panel() {
  const { companyName } = useAuth();
  // Persist current view so remounts / focus changes don't reset it unintentionally
  const initialView = (() => {
    try {
      const sv = localStorage.getItem('tactivo.currentView');
      if (
        sv === 'clientes' ||
        sv === 'clases' ||
        sv === 'ejercicios' ||
        sv === 'profesionales' ||
        sv === 'programas' ||
        sv === 'ajustes'
      )
        return sv as ViewType;
    } catch {}
    return 'calendario';
  })();
  const [currentView, setCurrentView] = useState<ViewType>(initialView);

  // Persist changes
  useEffect(() => {
    try {
      localStorage.setItem('tactivo.currentView', currentView);
    } catch {}
  }, [currentView]);

  // Ensure the URL contains the correct companyName path segment
  // If the route's param (provided by react-router) doesn't match the logged-in user's companyName,
  // redirect to the canonical `/:companyName/panel` URL.
  const { companyName: routeCompany } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Always redirect to canonical company route when we have a companyName
    if (companyName && companyName !== routeCompany) {
      navigate(`/${companyName}/panel`, { replace: true });
    }
  }, [companyName, routeCompany, navigate]);

  // Prefetch heavy calendar chunk when the company is known so the calendar renders fast
  useEffect(() => {
    if (companyName) {
      import('./views/FullCalendarWrapper').catch(() => null);
    }
  }, [companyName]);

  // Invite toast: read any persisted toast set before navigation and listen for dispatched invite events
  const [inviteToast, setInviteToast] = useState<{ title: string; durationMs?: number } | null>(
    null
  );
  useEffect(() => {
    try {
      const raw = localStorage.getItem('tactivo.inviteToast');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.title) {
          setInviteToast({ title: parsed.title, durationMs: parsed.durationMs ?? 4000 });
        }
        localStorage.removeItem('tactivo.inviteToast');
      }
    } catch {
      /* ignore */
    }

    const handler = (e: any) => {
      const d = e?.detail || {};
      if (d?.title) setInviteToast({ title: d.title, durationMs: d.durationMs ?? 4000 });
    };
    window.addEventListener('tactivo.invite', handler as EventListener);
    return () => window.removeEventListener('tactivo.invite', handler as EventListener);
  }, []);

  const viewTitles: Record<ViewType, string> = {
    calendario: 'Calendario',
    clientes: 'Clientes',
    clases: 'Clases',
    ejercicios: 'Ejercicios',
    profesionales: 'Profesionales',
    programas: 'Programas',
    ajustes: 'Ajustes',
  };

  const renderView = () => {
    switch (currentView) {
      case 'calendario':
        return (
          <Suspense fallback={<div className="p-4">Cargando calendario...</div>}>
            <CalendarioView />
          </Suspense>
        );
      case 'clientes':
        return (
          <Suspense fallback={<div className="p-4">Cargando clientes...</div>}>
            <ClientesView />
          </Suspense>
        );
      case 'clases':
        return (
          <Suspense fallback={<div className="p-4">Cargando clases...</div>}>
            <ClasesView />
          </Suspense>
        );
      case 'ejercicios':
        return (
          <Suspense fallback={<div className="p-4">Cargando ejercicios...</div>}>
            <EjerciciosView />
          </Suspense>
        );
      case 'profesionales':
        return (
          <Suspense fallback={<div className="p-4">Cargando profesionales...</div>}>
            <ProfesionalesView />
          </Suspense>
        );
      case 'programas':
        return (
          <Suspense fallback={<div className="p-4">Cargando programas...</div>}>
            <ProgramasView />
          </Suspense>
        );
      case 'ajustes':
        return (
          <Suspense fallback={<div className="p-4">Cargando ajustes...</div>}>
            <AjustesView />
          </Suspense>
        );
      default:
        return (
          <Suspense fallback={<div className="p-4">Cargando calendario...</div>}>
            <CalendarioView />
          </Suspense>
        );
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar currentView={currentView} onViewChange={setCurrentView} />
      {inviteToast && (
        <InviteToast
          title={inviteToast.title}
          durationMs={inviteToast.durationMs ?? 4000}
          onClose={() => setInviteToast(null)}
        />
      )}
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <MobileHamburgerButton />
          <h1 className="text-xl md:text-2xl font-bold">{viewTitles[currentView]}</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 min-h-0">{renderView()}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
