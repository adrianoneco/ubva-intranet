import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
const LoginPage = React.lazy(() => import('@/pages/login').then(mod => ({ default: mod.LoginPage })));
const LoginModal = React.lazy(() => import('@/pages/login').then(mod => ({ default: mod.LoginModal })));
import { useAuth } from '@/contexts/AuthContext';
import ContactsPage from "@/pages/contacts";
import AgendamentoPage from "@/pages/agendamento";
import SettingsPage from "@/pages/settings";
import { apiRequest } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { EditableCard } from "@/components/editable-card";
import CardEditorModal, { CardData } from "@/components/card-editor-modal";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { Card as CardType } from "@shared/schema";
import { Globe, LogOut } from "lucide-react";

function App() {
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  const cardsQuery = useQuery({ queryKey: ["/api/cards"] });
  const cards = (cardsQuery.data ?? []) as CardType[];

  const qc = useQueryClient();

  // Global SSE listener to keep cards updated in real-time across the app
  React.useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/cards/stream');
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data || '{}');
          if (!payload) return;
          if (payload.type === 'tick') return; // ignore heartbeat here

          if (payload.type === 'card:created' && payload.card) {
            qc.setQueryData(['/api/cards'], (old: any) => {
              const arr = Array.isArray(old) ? old.slice() : [];
              arr.unshift(payload.card);
              return arr;
            });
            return;
          }

          if (payload.type === 'card:deleted' && payload.id) {
            qc.setQueryData(['/api/cards'], (old: any) => {
              if (!Array.isArray(old)) return old;
              return old.filter((c: any) => String(c.id) !== String(payload.id));
            });
            return;
          }

          if (payload.type === 'card:updated') {
            if (payload.card) {
              qc.setQueryData(['/api/cards'], (old: any) => {
                if (!Array.isArray(old)) return old;
                return old.map((c: any) => (String(c.id) === String(payload.card.id) ? payload.card : c));
              });
              return;
            }

            const cardId = payload.cardId ?? payload.id;
            if (!cardId) {
              qc.invalidateQueries({ queryKey: ['/api/cards'] });
              return;
            }

            qc.setQueryData(['/api/cards'], (old: any) => {
              if (!Array.isArray(old)) return old;
              return old.map((c: any) => {
                if (String(c.id) !== String(cardId)) return c;
                const updated = { ...c };
                if (Object.prototype.hasOwnProperty.call(payload, 'image')) {
                  updated.image = payload.image;
                }
                if (Object.prototype.hasOwnProperty.call(payload, 'scheduleWeekdays')) {
                  updated.scheduleWeekdays = payload.scheduleWeekdays;
                }
                return updated;
              });
            });
            return;
          }

          // fallback: refresh cards list
          qc.invalidateQueries({ queryKey: ['/api/cards'] });
        } catch (err) {
          try { qc.invalidateQueries({ queryKey: ['/api/cards'] }); } catch (e) {}
        }
      };
      es.onerror = () => {
        try { es?.close(); } catch (e) {}
        es = null;
      };
    } catch (e) {}
    return () => { try { es?.close(); } catch (e) {} };
  }, [qc]);

  const [myCreatedIds, setMyCreatedIds] = React.useState<string[]>([]);
  React.useEffect(() => {
    try {
      const arr = JSON.parse(localStorage.getItem('myCreatedCards') || '[]');
      if (Array.isArray(arr)) setMyCreatedIds(arr.map(String));
    } catch (e) {
      setMyCreatedIds([]);
    }
  }, []);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/cards/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/cards"] }),
  });

  const createCardMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/cards", payload);
      return (await res.json());
    },
    onSuccess: (created: any) => {
      qc.invalidateQueries({ queryKey: ["/api/cards"] });
      try {
        const idStr = String(created.id);
        const existing = JSON.parse(localStorage.getItem('myCreatedCards') || '[]');
        const arr = Array.isArray(existing) ? existing : [];
        if (!arr.includes(idStr)) arr.push(idStr);
        localStorage.setItem('myCreatedCards', JSON.stringify(arr));
        setMyCreatedIds(arr.map(String));
      } catch (e) {}
    },
  });

  const updateCardMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiRequest("PATCH", `/api/cards/${id}`, payload);
      return (await res.json());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/cards"] }),
  });

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingCard, setEditingCard] = React.useState<CardData | undefined>(undefined);
  const [location, setLocation] = useLocation();

  const auth = useAuth();
  const user = auth.user;

  // client-side guard: redirect to /login when unauthenticated users access protected SPA routes
  React.useEffect(() => {
    try {
      // Skip if already on login page or loading
      if (location.startsWith('/login') || auth.loading) {
        return;
      }
      
      // Dashboard (/app) and contacts are public, no authentication required
      if (!user) {
        // Only redirect to login for protected routes (agendamento, settings)
        if (location.startsWith('/agendamento') || location.startsWith('/settings') || location.startsWith('/calendario')) {
          setLocation(`/login?redirect=${encodeURIComponent(location)}`);
        }
        return;
      }
      
      // Check permissions for each route (only for authenticated users)
      if (location.startsWith('/agendamento') && !auth.hasPermission('calendar:view')) {
        setLocation('/app');
        return;
      }
      if ((location.startsWith('/settings') || location.startsWith('/calendario')) && !auth.hasPermission('settings:view')) {
        setLocation('/app');
        return;
      }
    } catch (e) {}
  }, [location, user, setLocation, auth, auth.loading]);

  function handleEdit(id: string) {
    const card = cards.find((c) => String(c.id) === id);
    if (!card) return;
    // parse schedules stored in scheduleWeekdays (if present)
    let schedules: any[] | undefined = undefined;
    try {
      if (card.scheduleWeekdays) schedules = JSON.parse(card.scheduleWeekdays);
    } catch (e) {
      schedules = undefined;
    }
    setEditingCard({
      id: String(card.id),
      title: card.title,
      subtitle: card.subtitle ?? undefined,
      image: card.image ?? undefined,
      schedules,
    });
    setEditorOpen(true);
  }

  function handleDelete(id: string) {
    const num = parseInt(id, 10);
    if (!Number.isNaN(num)) deleteMutation.mutate(num);
  }

  function handleCreate() {
    setEditingCard(undefined);
    setEditorOpen(true);
  }

  async function handleSave(data: CardData) {
    const payload: any = {
      // we store the schedules JSON in scheduleWeekdays text column
      scheduleWeekdays: data.schedules ? JSON.stringify(data.schedules) : undefined,
    };

    // Only update title/subtitle/image when explicitly editing those fields (i.e., when editingCard is set and values differ)
    if (editingCard) {
      // If user changed the top-level image/title/subtitle in the modal, include them in the patch
      if (data.title !== undefined && data.title !== editingCard.title) payload.title = data.title;
      if (data.subtitle !== undefined && data.subtitle !== editingCard.subtitle) payload.subtitle = data.subtitle;
      if (data.image !== undefined && data.image !== editingCard.image) payload.image = data.image;

      const id = parseInt(editingCard.id || "", 10);
      if (!Number.isNaN(id)) {
        updateCardMutation.mutate({ id, payload });
      }
    } else {
      // creating a brand new card: include title/subtitle/image from the modal
      payload.title = data.title;
      if (data.subtitle) payload.subtitle = data.subtitle;
      if (data.image) payload.image = data.image;
      createCardMutation.mutate(payload);
    }

    setEditorOpen(false);
  }

  // route selection
  let content: React.ReactNode = null;
  if (location.startsWith('/contacts')) {
    // Contacts page is public, no authentication required
    content = <ContactsPage />;
  } else if (location.startsWith('/agendamento')) {
    if (!user || !auth.hasPermission('calendar:view')) {
      content = <div className="p-8 text-center"><p className="text-muted-foreground">Você não tem permissão para acessar esta página</p></div>;
    } else {
      content = <AgendamentoPage />;
    }
  } else if (location.startsWith('/settings') || location.startsWith('/calendario')) {
    if (!user || !auth.hasPermission('settings:view')) {
      content = <div className="p-8 text-center"><p className="text-muted-foreground">Você não tem permissão para acessar esta página</p></div>;
    } else {
      content = <SettingsPage />;
    }
  } else if (location.startsWith('/login')) {
    content = (
      <React.Suspense fallback={<div>Loading...</div>}>
        <LoginPage />
      </React.Suspense>
    );
  } else {
    // Dashboard (/app) is public, no authentication required
    content = (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Cards</h1>
          <div>
            {user ? (
              <button className="btn" onClick={handleCreate}>Adicionar</button>
            ) : (
              <button className="btn btn-ghost" onClick={() => setLocation('/login')}>Entrar</button>
            )}
          </div>
        </div>
        {cards.length === 0 ? (
          <p className="text-muted-foreground">No cards available</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cards.map((c) => {
              let schedules: any[] | undefined = undefined;
              try {
                if (c.scheduleWeekdays) schedules = JSON.parse(c.scheduleWeekdays);
              } catch (e) {
                schedules = undefined;
              }

              // find next upcoming start (start > now)
              let nextStart: string | undefined = undefined;
              if (Array.isArray(schedules)) {
                const now = new Date();
                const upcoming = schedules
                  .map((s) => ({ ...s, startDate: s.startDate ? new Date(s.startDate) : null }))
                  .filter((s) => s.startDate && s.startDate > now)
                  .sort((a, b) => (a.startDate as Date).getTime() - (b.startDate as Date).getTime());
                if (upcoming.length) nextStart = (upcoming[0].startDate as Date).toISOString();
              }

              return (
                <EditableCard
                  key={c.id}
                  id={String(c.id)}
                  title={c.title}
                  subtitle={c.subtitle ?? undefined}
                  image={c.image ?? undefined}
                  nextScheduleStart={nextStart}
                  schedules={schedules}
                  createdByMe={myCreatedIds.includes(String(c.id))}
                  {...(user ? { onEdit: handleEdit, onDelete: handleDelete } : {})}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Login page doesn't need sidebar/header
  if (location.startsWith('/login')) {
    return (
      <>
        <TooltipProvider>
          {content}
          <Toaster />
        </TooltipProvider>
      </>
    );
  }

  return (
    <>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <header className="flex items-center justify-between p-4 border-b bg-background">
              <div className="flex items-center gap-3">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-lg">INTRANET</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                  <ThemeToggle />
                  {user ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent((user as any).displayName || user.username)}`} alt={(user as any).displayName || user.username} />
                          <AvatarFallback />
                        </Avatar>
                        <span className="text-sm font-medium">{(user as any).displayName || user.username}</span>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={async () => {
                            try {
                              await auth.logout();
                            } catch (e) {}
                            setLocation('/');
                          }}>
                            <LogOut className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Sair</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ) : (
                    <React.Suspense fallback={null}>
                      <button className="btn btn-ghost" onClick={() => setLocation('/login')}>Entrar</button>
                    </React.Suspense>
                  )}
                </div>
            </header>
            <main className="flex-1 overflow-auto p-6">
              {content}
            </main>
          </div>
        </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
      <CardEditorModal open={editorOpen} initial={editingCard} onClose={() => setEditorOpen(false)} onSave={handleSave} />
    </>
  );
}

export default App;