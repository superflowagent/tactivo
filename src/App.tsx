import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { CalendarioView } from "@/components/views/CalendarioView"
import { ClientesView } from "@/components/views/ClientesView"
import { ProfesionalesView } from "@/components/views/ProfesionalesView"
import { AjustesView } from "@/components/views/AjustesView"

export type ViewType = "calendario" | "clientes" | "profesionales" | "ajustes"

function App() {
  const [currentView, setCurrentView] = useState<ViewType>("calendario")

  const viewTitles: Record<ViewType, string> = {
    calendario: "Calendario",
    clientes: "Clientes",
    profesionales: "Profesionales",
    ajustes: "Ajustes",
  }

  const renderView = () => {
    switch (currentView) {
      case "calendario":
        return <CalendarioView />
      case "clientes":
        return <ClientesView />
      case "profesionales":
        return <ProfesionalesView />
      case "ajustes":
        return <AjustesView />
      default:
        return <CalendarioView />
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar currentView={currentView} onViewChange={setCurrentView} />
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">{viewTitles[currentView]}</h1>
          </div>
          {renderView()}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
