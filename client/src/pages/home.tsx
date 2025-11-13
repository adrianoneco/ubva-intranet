import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Task, Category, InsertTask } from "@shared/schema";
import { TaskCard } from "@/components/task-card";
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

export default function Home() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const createTaskMutation = useMutation<Task, Error, InsertTask>({
    mutationFn: async (task: InsertTask) => {
      return await apiRequest("POST", "/api/tasks", task) as Task;
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

  const toggleTaskMutation = useMutation<Task, Error, { id: number; completed: boolean }>({
    mutationFn: async ({ id, completed }) => {
      return await apiRequest("PATCH", `/api/tasks/${id}`, { completed }) as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const deleteTaskMutation = useMutation<void, Error, number>({
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-lg text-muted-foreground">
            Manage your tasks efficiently with this monorepo demo application
          </p>
        </div>

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-2xl font-semibold">Tasks</CardTitle>
                <Button
                  onClick={() => setShowForm(!showForm)}
                  data-testid="button-toggle-form"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  New Task
                </Button>
              </CardHeader>
              <CardContent>
                <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="mb-6">
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
                        onToggle={(id, completed) =>
                          toggleTaskMutation.mutate({ id, completed })
                        }
                        onDelete={(id) => deleteTaskMutation.mutate(id)}
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
                    onSubmit={(data) => createTaskMutation.mutate(data)}
                    isPending={createTaskMutation.isPending}
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
      </div>
    </div>
  );
}
