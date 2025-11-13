import { Home, FolderKanban, LayoutDashboard } from "lucide-react";
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

const menuItems = [
  {
    title: "Landing Page",
    url: "/",
    icon: Home,
  },
  {
    title: "Dashboard",
    url: "/app",
    icon: LayoutDashboard,
  },
  {
    title: "All Tasks",
    url: "/app",
    icon: FolderKanban,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Home className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">TaskFlow</h1>
            <p className="text-xs text-muted-foreground">Monorepo Demo</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel>Tech Stack</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="space-y-2 px-3 py-2">
              <div className="text-xs text-muted-foreground">
                <p className="font-semibold mb-1">Frontend:</p>
                <p>React + Vite + TypeScript</p>
                <p>Tailwind CSS + Shadcn UI</p>
              </div>
              <div className="text-xs text-muted-foreground">
                <p className="font-semibold mb-1">Backend:</p>
                <p>Express + TypeScript</p>
                <p>Drizzle ORM + PostgreSQL</p>
              </div>
              <div className="text-xs text-muted-foreground">
                <p className="font-semibold mb-1">Architecture:</p>
                <p>Monorepo with shared types</p>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
