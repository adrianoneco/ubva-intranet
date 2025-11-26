import React from "react";
import { Globe, FolderKanban, LayoutDashboard, Phone, Users, Calendar, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

const menuItems = [
  {
    title: "Dashboard",
    url: "/app",
    icon: LayoutDashboard,
    permission: "dashboard:view",
  },
  {
    title: "Contatos",
    url: "/contacts",
    icon: Phone,
    permission: "contacts:view",
  },
  {
    title: "Agendamento",
    url: "/agendamento",
    icon: Calendar,
    permission: "calendar:view",
  },
  {
    title: "Configurações",
    url: "/settings",
    icon: Settings,
    permission: "settings:view",
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, loading, hasPermission } = useAuth();

  const visibleMenuItems = React.useMemo(() => {
    if (loading) return [];
    // when not logged in, show Dashboard and Contacts publicly
    if (!user) {
      return menuItems.filter(item => item.permission === 'dashboard:view' || item.permission === 'contacts:view');
    }
    return menuItems.filter(item => hasPermission(item.permission));
  }, [user, loading, hasPermission]);

  return (
    <Sidebar>
      <SidebarHeader className="p-2">
        <div className="flex items-center justify-center">
          <img src="/ubva-logo.png" alt="UBVA Logo" className="h-12 object-contain" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
              ) : visibleMenuItems.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">Nenhum item disponível</div>
              ) : (
                visibleMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tech Stack removed per design: only show logo and Dashboard link */}
      </SidebarContent>
    </Sidebar>
  );
}
