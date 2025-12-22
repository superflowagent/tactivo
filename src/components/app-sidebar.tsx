import * as React from "react"
import { Calendar, Users, UserCog, Settings } from "lucide-react"
import type { ViewType } from "@/App"

import { NavMain } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

export function AppSidebar({ currentView, onViewChange, ...props }: AppSidebarProps) {
  const navItems = [
    {
      title: "Calendario",
      view: "calendario" as ViewType,
      icon: Calendar,
    },
    {
      title: "🔗 Clientes",
      view: "clientes" as ViewType,
      icon: Users,
    },
    {
      title: "Profesionales",
      view: "profesionales" as ViewType,
      icon: UserCog,
    },
    {
      title: "Ajustes",
      view: "ajustes" as ViewType,
      icon: Settings,
    },
  ]

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Calendar className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Mi Proyecto</span>
                  <span className="">Sistema de Gestión</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} currentView={currentView} onViewChange={onViewChange} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
