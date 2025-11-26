import { Task, Category } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
// Badge component not used here; keep file minimal
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";

interface TaskCardProps {
  task: Task;
  category?: Category;
  onToggle: (taskId: number, completed: boolean) => void;
  onDelete?: (taskId: number) => void;
}

export function TaskCard({ task, category, onToggle, onDelete }: TaskCardProps) {
  return (
    <Card className="hover-elevate" data-testid={`card-task-${task.id}`}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Checkbox
            checked={task.completed}
            onCheckedChange={(checked) => onToggle(task.id, Boolean(checked))}
            className="mt-1"
            data-testid={`checkbox-task-${task.id}`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h3
                className={`text-lg font-semibold ${
                  task.completed ? "line-through text-muted-foreground" : "text-foreground"
                }`}
                data-testid={`text-task-title-${task.id}`}
              >
                {task.title}
              </h3>
              <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete && onDelete(task.id)}
                    className="shrink-0"
                    data-testid={`button-delete-task-${task.id}`}
                  >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {task.description && (
              <p className="text-sm text-muted-foreground mb-3" data-testid={`text-task-description-${task.id}`}>
                {task.description}
              </p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              {category && (
                <span
                  className="px-2 py-0.5 rounded text-white text-xs font-semibold"
                  style={{ backgroundColor: category.color }}
                  data-testid={`badge-category-${task.id}`}
                >
                  {category.name}
                </span>
              )}
              <span className="text-xs text-muted-foreground" data-testid={`text-date-${task.id}`}>
                {format(new Date(task.createdAt), "MMM dd, yyyy")}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default TaskCard;
