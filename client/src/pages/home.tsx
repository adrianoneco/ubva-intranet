import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Task, Category, InsertTask, Card as CardType, InsertCard } from "@shared/schema";
import { TaskCard } from "@/components/task-card";
import { EditableCard } from "@/components/editable-card";
import CardEditorModal, { CardData } from "@/components/card-editor-modal";
import { TaskForm } from "@/components/task-form";
import { EmptyState } from "@/components/empty-state";
import { StatsCard } from "@/components/stats-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, CheckSquare, ListTodo, Target } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import React from "react";
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  const tasksQuery = useQuery({ queryKey: ["/api/tasks"] });
  const tasks = (tasksQuery.data ?? []) as Task[];
  const tasksLoading = Boolean((tasksQuery as any).isLoading);

  const categoriesQuery = useQuery({ queryKey: ["/api/categories"] });
  const categories = (categoriesQuery.data ?? []) as Category[];

  const createTaskMutation = useMutation({
    mutationFn: async (task: InsertTask) => {
      const res = await apiRequest("POST", "/api/tasks", task);
      return (await res.json()) as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setShowForm(false);
      toast({
        title: "Success",
        description: "Task created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: number; completed: boolean }) => {
      const res = await apiRequest("PATCH", `/api/tasks/${id}`, { completed });
      return (await res.json()) as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    },
  });

  const filteredTasks = tasks.filter((task) => {
    if (filter === "active") return !task.completed;
    if (filter === "completed") return task.completed;
    return true;
  });

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const activeTasks = totalTasks - completedTasks;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const getCategoryForTask = (task: Task) => {
    return categories.find((c) => c.id === task.categoryId);
  };

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<any | undefined>(undefined);
  const [, setTick] = useState(0);
  const [myCreatedIds, setMyCreatedIds] = useState<string[]>([]);
  const { user, hasPermission } = useAuth();

  React.useEffect(() => {
    try {
      const arr = JSON.parse(localStorage.getItem('myCreatedCards') || '[]');
      if (Array.isArray(arr)) setMyCreatedIds(arr.map(String));
    } catch (e) {
      setMyCreatedIds([]);
    }
  }, []);

  const cardsQuery = useQuery({ queryKey: ["/api/cards"] });
  const cards = (cardsQuery.data ?? []) as CardType[];
  const cardsLoading = Boolean((cardsQuery as any).isLoading);

  const createCardMutation = useMutation({
    mutationFn: async (card: Partial<InsertCard>) => {
      const res = await apiRequest("POST", "/api/cards", card);
      return (await res.json()) as CardType;
    },
    onSuccess: (created: CardType) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      setEditorOpen(false);
      toast({ title: "Card criado" });
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
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertCard> }) => {
      const res = await apiRequest("PATCH", `/api/cards/${id}`, data);
      return (await res.json()) as CardType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      setEditorOpen(false);
      toast({ title: "Card atualizado" });
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/cards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({ title: "Card deletado" });
    },
  });

  function handleCreateCard() {
    setEditingCard(undefined);
    setEditorOpen(true);
  }

  function handleEditCard(id: string) {
    const card = cards.find((c) => String(c.id) === id);
    if (card) {
      // convert to CardData shape expected by modal
      setEditingCard({
        id: String(card.id),
        title: card.title,
        subtitle: card.subtitle || "",
        image: card.image || "",
        schedules: card.scheduleWeekdays ? JSON.parse(card.scheduleWeekdays) : undefined,
      });
      setEditorOpen(true);
    }
  }

  function handleDeleteCard(id: string) {
    const numId = parseInt(id);
    if (!Number.isNaN(numId)) deleteCardMutation.mutate(numId);
  }

  function handleSaveCard(data: any) {
    // data comes from modal with id as string for existing, otherwise generated id
    const hasRemoteId = data.id && !String(data.id).match(/^\d{13}/); // heuristic: local generated ids are timestamps
    // Build payload matching InsertCard
    const payload: Partial<InsertCard> = {
      title: data.title,
      subtitle: data.subtitle,
      image: data.image,
      // store schedules array in `scheduleWeekdays` (scheduler reads this field)
      scheduleWeekdays: data.schedules && data.schedules.length ? JSON.stringify(data.schedules) : undefined,
    };

    // If creating a new card: require an image when schedules are provided
    if (!editingCard) {
      if (payload.scheduleWeekdays && !payload.image) {
        toast({ title: 'Erro', description: 'Selecione uma imagem antes de criar um agendamento', variant: 'destructive' });
        return;
      }
      createCardMutation.mutate(payload as InsertCard);
      return;
    }

    // Editing an existing card
    if (editingCard && editingCard.id) {
      const id = parseInt(editingCard.id);

      // If the client didn't provide `image` (image unchanged) but is updating schedules,
      // use the separate schedules endpoint so we don't accidentally overwrite the main image.
      if ((data.schedules || payload.scheduleWeekdays) && data.image === undefined) {
        // call schedules-only endpoint
        (async () => {
          try {
            const body = { schedules: data.schedules ?? (payload.scheduleWeekdays ? JSON.parse(payload.scheduleWeekdays) : undefined) };
            const res = await apiRequest('PATCH', `/api/cards/${id}/schedules`, body);
            if (!res.ok) throw new Error('Failed to update schedules');
            const updated = await res.json();
            // Update react-query cache for this card's scheduleWeekdays
            queryClient.setQueryData(['/api/cards'], (old: any) => {
              if (!Array.isArray(old)) return old;
              return old.map((c: any) => (String(c.id) === String(id) ? updated : c));
            });
            setEditorOpen(false);
            toast({ title: 'Agendamento atualizado' });
          } catch (err) {
            toast({ title: 'Erro', description: 'Falha ao atualizar agendamento', variant: 'destructive' });
          }
        })();
        return;
      }

      updateCardMutation.mutate({ id, data: payload });
    }
  }

  // Listen to server-sent events for real-time updates and refresh cards
  React.useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/cards/stream');
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data || '{}');
          // lightweight heartbeat: trigger a re-render once per tick
          if (payload && payload.type === 'tick') {
            setTick((t) => t + 1);
            return;
          }
          // If the server sent the full card, use it to update cache
          if (payload.type === 'card:created' && payload.card) {
            queryClient.setQueryData(['/api/cards'], (old: any) => {
              const arr = Array.isArray(old) ? old.slice() : [];
              arr.unshift(payload.card);
              return arr;
            });
            return;
          }

          if (payload.type === 'card:deleted' && payload.id) {
            queryClient.setQueryData(['/api/cards'], (old: any) => {
              if (!Array.isArray(old)) return old;
              return old.filter((c: any) => String(c.id) !== String(payload.id));
            });
            return;
          }

          if (payload.type === 'card:updated') {
            // payload may include full 'card' or partial fields like cardId/image/scheduleWeekdays
            if (payload.card) {
              queryClient.setQueryData(['/api/cards'], (old: any) => {
                if (!Array.isArray(old)) return old;
                return old.map((c: any) => (String(c.id) === String(payload.card.id) ? payload.card : c));
              });
              return;
            }

            const cardId = payload.cardId ?? payload.id;
            if (!cardId) {
              // fallback: refetch everything
              queryClient.invalidateQueries({ queryKey: ['/api/cards'] });
              return;
            }

            queryClient.setQueryData(['/api/cards'], (old: any) => {
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

          // default: invalidate to be safe
          queryClient.invalidateQueries({ queryKey: ['/api/cards'] });
        } catch (err) {
          try { queryClient.invalidateQueries({ queryKey: ['/api/cards'] }); } catch (e) {}
        }
      };
      es.onerror = () => {
        try { es?.close(); } catch (e) {}
        es = null;
      };
    } catch (err) {}
    return () => {
      try { es?.close(); } catch (e) {}
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-lg text-muted-foreground">
            Manage your tasks efficiently with this monorepo demo application
          </p>
        </div>

        {hasPermission('dashboard:view') ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatsCard
              title="Total Tasks"
              value={totalTasks}
              icon={ListTodo}
              description="All created tasks"
            />
            <StatsCard
              title="Active Tasks"
              value={activeTasks}
              icon={Target}
              description="Tasks in progress"
            />
            <StatsCard
              title="Completed"
              value={completedTasks}
              icon={CheckSquare}
              description="Finished tasks"
            />
            <StatsCard
              title="Completion Rate"
              value={`${completionRate}%`}
              icon={CheckSquare}
              description="Overall progress"
            />
          </div>
        ) : null}

        <div className="mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-2xl font-semibold">Cards</CardTitle>
              {user ? (
                hasPermission('cards:create') ? (
                  <Button onClick={handleCreateCard}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Adicionar Card
                  </Button>
                ) : null
              ) : (
                <Button variant="ghost" onClick={() => window.location.href = '/login'}>
                  Entrar
                </Button>
              )}
              
            </CardHeader>
            <CardContent>
              {cards.length === 0 ? (
                <EmptyState onCreateClick={handleCreateCard} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cards.map((c) => {
                    let schedules: any[] | undefined = undefined;
                    try {
                      if (c.scheduleWeekdays) schedules = JSON.parse(c.scheduleWeekdays);
                    } catch (e) {
                      schedules = undefined;
                    }
                    const createdByMe = myCreatedIds.includes(String(c.id));

                    // determine if any schedule is active now
                    const isScheduleActive = (() => {
                      if (!Array.isArray(schedules)) return false;
                      const now = Date.now();
                      for (const s of schedules) {
                        try {
                          if (!s.startDate) continue;
                          const start = new Date(s.startDate).getTime();
                          const end = s.endDate ? new Date(s.endDate).getTime() : null;
                          if (isNaN(start)) continue;
                          if (now >= start && (!end || now <= end)) return true;
                        } catch (e) {
                          continue;
                        }
                      }
                      return false;
                    })();

                    // if card is scheduled but no schedule is active yet, only show it to the creator
                    const isScheduledButInactive = Array.isArray(schedules) && schedules.length > 0 && !isScheduleActive;
                    if (isScheduledButInactive && !createdByMe) return null;

                    return (
                      <EditableCard
                        key={c.id}
                        id={String(c.id)}
                        title={c.title}
                        subtitle={c.subtitle ?? undefined}
                        image={c.image ?? undefined}
                        nextScheduleStart={(() => {
                          if (!Array.isArray(schedules)) return undefined;
                          const now = new Date();
                          const upcoming = schedules
                            .map((s) => ({ ...s, startDate: s.startDate ? new Date(s.startDate) : null }))
                            .filter((s) => s.startDate && s.startDate > now)
                            .sort((a, b) => (a.startDate as Date).getTime() - (b.startDate as Date).getTime());
                          if (upcoming.length) return (upcoming[0].startDate as Date).toISOString();
                          return undefined;
                        })()}
                        schedules={schedules}
                        createdByMe={createdByMe}
                        {...(hasPermission('cards:edit') ? { onEdit: handleEditCard } : {})}
                        {...(hasPermission('cards:delete') ? { onDelete: handleDeleteCard } : {})}
                      />
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-2xl font-semibold">Tasks</CardTitle>
                  {user ? (
                    <Button
                      onClick={() => setShowForm(!showForm)}
                      data-testid="button-toggle-form"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      New Task
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={() => window.location.href = '/login'}>
                      Entrar
                    </Button>
                  )}
              </CardHeader>
              <CardContent>
                <Tabs value={filter} onValueChange={(v: string) => setFilter(v as any)} className="mb-6">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
                    <TabsTrigger value="active" data-testid="tab-active">Active</TabsTrigger>
                    <TabsTrigger value="completed" data-testid="tab-completed">Completed</TabsTrigger>
                  </TabsList>
                </Tabs>

                {tasksLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-32 w-full" />
                    ))}
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <EmptyState onCreateClick={() => setShowForm(true)} />
                ) : (
                  <div className="space-y-4">
                    {filteredTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        category={getCategoryForTask(task)}
                        onToggle={(id: number, completed: boolean) =>
                          toggleTaskMutation.mutate({ id, completed })
                        }
                        {...(user ? { onDelete: (id: number) => deleteTaskMutation.mutate(id) } : {})}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl font-semibold">
                  {showForm ? "Create Task" : "Quick Actions"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {showForm ? (
                  <TaskForm
                    categories={categories}
                    onSubmit={(data: InsertTask) => createTaskMutation.mutate(data)}
                    isPending={createTaskMutation.isLoading}
                  />
                ) : (
                  <div className="space-y-4">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setShowForm(true)}
                      data-testid="button-quick-create"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Create New Task
                    </Button>
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-semibold mb-3">Categories</h4>
                      {categories.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No categories yet</p>
                      ) : (
                        <div className="space-y-2">
                          {categories.map((category) => (
                            <div
                              key={category.id}
                              className="flex items-center gap-2"
                              data-testid={`category-${category.id}`}
                            >
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: category.color }}
                              />
                              <span className="text-sm">{category.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        <CardEditorModal
          open={editorOpen}
          initial={editingCard}
          onClose={() => setEditorOpen(false)}
          onSave={handleSaveCard}
        />
      </div>
    </div>
  );
}
