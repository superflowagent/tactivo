import * as React from "react"
import { Calendar, Users, UserStar, Settings, ChevronLeft, ChevronRight, ArrowLeftFromLine, Dumbbell } from "lucide-react"
import type { ViewType } from "@/App"
import { useAuth } from "@/contexts/AuthContext"
import pb from "@/lib/pocketbase"

import { NavMain } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

export function AppSidebar({ currentView, onViewChange, ...props }: AppSidebarProps) {
  const { state, toggleSidebar, isMobile } = useSidebar()
  const { user, logout } = useAuth()
  const isCollapsed = state === "collapsed"

  // Generar avatar con iniciales del usuario
  const getUserInitials = () => {
    if (!user) return "?"
    const firstInitial = user.name?.charAt(0).toUpperCase() || ""
    const lastInitial = user.last_name?.charAt(0).toUpperCase() || ""
    return firstInitial + lastInitial
  }

  const getFullName = () => {
    if (!user) return "Usuario"
    return `${user.name} ${user.last_name}`.trim()
  }

  // Obtener URL de la foto del usuario desde PocketBase
  const getUserPhotoUrl = () => {
    if (!user?.id || !user?.photo) return null
    return pb.files.getURL({ collectionId: 'users', id: user.id }, user.photo)
  }

  const photoUrl = getUserPhotoUrl()

  const mainNavItems = [
    {
      title: "Calendario",
      view: "calendario" as ViewType,
      icon: Calendar,
    },
    {
      title: "Clientes",
      view: "clientes" as ViewType,
      icon: Users,
    },
    {
      title: "Clases",
      view: "clases" as ViewType,
      icon: Dumbbell,
    },
    {
      title: "Profesionales",
      view: "profesionales" as ViewType,
      icon: UserStar,
    },
  ]

  return (
    <Sidebar {...props} collapsible="icon">
      <SidebarHeader className="p-2">
        <div className="flex justify-end mb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
        {!isCollapsed && (
          <div className="flex items-center gap-2 md:gap-3">
            <div
              className="group/avatar relative flex aspect-square size-12 md:size-14 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground cursor-pointer overflow-hidden flex-shrink-0"
              onClick={(e) => {
                e.preventDefault()
                logout()
              }}
            >
              {photoUrl ? (
                <>
                  <img
                    src={photoUrl}
                    alt={getFullName()}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/80 opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                    <ArrowLeftFromLine className="size-3 md:size-4 text-white" />
                  </div>
                </>
              ) : (
                <>
                  <span className="text-xs md:text-sm font-medium">{getUserInitials()}</span>
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/80 opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                    <ArrowLeftFromLine className="size-3 md:size-4 text-white" />
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-col gap-0.5 leading-none min-w-0 flex-1">
              <span className="text-sm md:text-base font-semibold truncate">Tactivo</span>
              <span className="text-xs truncate">{getFullName()}</span>
            </div>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={mainNavItems} currentView={currentView} onViewChange={onViewChange} />
      </SidebarContent>
      <SidebarFooter className="mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={currentView === "ajustes"}
              onClick={() => {
                onViewChange("ajustes")
                if (isMobile) {
                  // Cerrar sidebar en móvil
                  toggleSidebar()
                }
              }}
            >
              <Settings />
              Ajustes
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
