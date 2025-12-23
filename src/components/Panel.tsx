import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { CalendarioView } from "@/components/views/CalendarioView"
import { ClientesView } from "@/components/views/ClientesView"
import { ClasesView } from "@/components/views/ClasesView"
import { ProfesionalesView } from "@/components/views/ProfesionalesView"
import { AjustesView } from "@/components/views/AjustesView"

export type ViewType = "calendario" | "clientes" | "clases" | "profesionales" | "ajustes"

export function Panel() {
  const [currentView, setCurrentView] = useState<ViewType>("calendario")

  const viewTitles: Record<ViewType, string> = {
    calendario: "Calendario",
    clientes: "Clientes",
    clases: "Clases",
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
          <h1 className="text-xl md:text-2xl font-bold">{viewTitles[currentView]}</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          {renderView()}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
