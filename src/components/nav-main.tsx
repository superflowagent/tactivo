import { type LucideIcon } from "lucide-react"
import type { ViewType } from "@/App"

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
  currentView,
  onViewChange,
  isFooter,
}: {
  items: {
    title: string
    view: ViewType
    icon?: LucideIcon
  }[]
  currentView: ViewType
  onViewChange: (view: ViewType) => void
  isFooter?: boolean
}) {
  const { isMobile, setOpenMobile } = useSidebar()

  const handleViewChange = (view: ViewType) => {
    onViewChange(view)
    // Cerrar sidebar en móvil después de seleccionar
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <SidebarGroup className={isFooter ? "" : ""}>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              isActive={currentView === item.view}
              onClick={() => handleViewChange(item.view)}
            >
              {item.icon && <item.icon />}
              {item.title}
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
