import * as React from "react"
import { Calendar, Users, UserCog, Settings, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import type { ViewType } from "@/App"

import { NavMain } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

export function AppSidebar({ currentView, onViewChange, ...props }: AppSidebarProps) {
  const { state, toggleSidebar } = useSidebar()
  const isCollapsed = state === "collapsed"
  
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
      title: "Profesionales",
      view: "profesionales" as ViewType,
      icon: UserCog,
    },
  ]

  const footerNavItems = [
    {
      title: "Ajustes",
      view: "ajustes" as ViewType,
      icon: Settings,
    },
  ]

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        {isCollapsed ? (
          <div className="flex items-center justify-center py-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-2 py-2">
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
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8 ml-auto"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={mainNavItems} currentView={currentView} onViewChange={onViewChange} />
      </SidebarContent>
      <SidebarFooter>
        <NavMain items={footerNavItems} currentView={currentView} onViewChange={onViewChange} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
