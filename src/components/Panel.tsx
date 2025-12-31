import { useState, useEffect } from "react"
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from "@/contexts/AuthContext"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar"
import ActionButton from "@/components/ui/ActionButton";
import { Menu } from "lucide-react"
import { CalendarioView } from "@/components/views/CalendarioView"
import { ClientesView } from "@/components/views/ClientesView"
import { ClasesView } from "@/components/views/ClasesView"
import { ProfesionalesView } from "@/components/views/ProfesionalesView"
import { AjustesView } from "@/components/views/AjustesView"
import { EjerciciosView } from "@/components/views/EjerciciosView"

export type ViewType = "calendario" | "clientes" | "clases" | "ejercicios" | "profesionales" | "ajustes"

function MobileHamburgerButton() {
  const { toggleSidebar } = useSidebar()
  return (
    <ActionButton
      tooltip="Expandir menú"
      className="md:hidden h-7 w-7"
      onClick={toggleSidebar}
      aria-label="Expandir menú"
    >
      <Menu className="h-5 w-5" />
    </ActionButton>
  )
}

export function Panel() {
  const { user, companyName } = useAuth()
  // Persist current view so remounts / focus changes don't reset it unintentionally
  const initialView = (() => {
    try {
      const sv = localStorage.getItem('tactivo.currentView')
      if (sv === 'clientes' || sv === 'clases' || sv === 'ejercicios' || sv === 'profesionales' || sv === 'ajustes') return sv as ViewType
    } catch (e) {}
    return 'calendario'
  })()
  const [currentView, setCurrentView] = useState<ViewType>(initialView)

  // Persist changes
  useEffect(() => {
    try { localStorage.setItem('tactivo.currentView', currentView) } catch (e) {}
  }, [currentView])

  // Ensure the URL contains the correct companyName path segment
  // If the route's param (provided by react-router) doesn't match the logged-in user's companyName,
  // redirect to the canonical `/:companyName/panel` URL.
  const { companyName: routeCompany } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    // Always redirect to canonical company route when we have a companyName
    if (companyName && companyName !== routeCompany) {
      navigate(`/${companyName}/panel`, { replace: true })
    }
  }, [companyName, routeCompany, navigate])

  // Prefetch heavy calendar chunk when the company is known so the calendar renders fast
  useEffect(() => {
    if (companyName) {
      import('./views/FullCalendarWrapper').catch(() => null)
    }
  }, [companyName])

  // If the user is a client, force the view to 'calendario' and prevent switching
  useEffect(() => {
    if (user?.role === 'client') {
      setCurrentView('calendario')
    }
  }, [user])

  const viewTitles: Record<ViewType, string> = {
    calendario: "Calendario",
    clientes: "Clientes",
    clases: "Clases",
    ejercicios: "Ejercicios",
    profesionales: "Profesionales",
    ajustes: "Ajustes",
  }

  const renderView = () => {
    switch (currentView) {
      case "calendario":
        return <CalendarioView />
      case "clientes":
        return <ClientesView />
      case "clases":
        return <ClasesView />
      case "ejercicios":
        return <EjerciciosView />
      case "profesionales":
        return <ProfesionalesView />
      case "ajustes":
        return <AjustesView />
      default:
        return <CalendarioView />
    }
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar currentView={currentView} onViewChange={setCurrentView} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <MobileHamburgerButton />
          <h1 className="text-xl md:text-2xl font-bold">{viewTitles[currentView]}</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 min-h-0">
          {renderView()}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

