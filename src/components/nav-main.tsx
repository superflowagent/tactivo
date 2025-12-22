import { type LucideIcon } from "lucide-react"
import type { ViewType } from "@/App"

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
  return (
    <SidebarGroup className={isFooter ? "group-data-[collapsible=icon]:px-0" : ""}>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              isActive={currentView === item.view}
              onClick={() => onViewChange(item.view)}
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
