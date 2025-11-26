import React from "react";
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit3, Trash2 } from "lucide-react";

interface EditableCardProps {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  nextScheduleStart?: string | null;
  schedules?: any[];
  createdByMe?: boolean;
}

export function EditableCard({ id, title, subtitle, image, onEdit, onDelete, nextScheduleStart, schedules, createdByMe }: EditableCardProps) {
  const [countdown, setCountdown] = React.useState<string | null>(null);
  const [serverOffsetMs, setServerOffsetMs] = React.useState<number>(0);

  React.useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    function tick() {
      if (!nextScheduleStart) {
        setCountdown(null);
        return;
      }
      const target = new Date(nextScheduleStart).getTime();
      // use server-aligned now so client countdown matches server scheduler
      const now = Date.now() + (serverOffsetMs || 0);
      const diffMs = target - now;
      if (diffMs <= 0) {
        setCountdown("Ativo");
        return;
      }
      let diff = diffMs;
      const days = Math.floor(diff / (24 * 3600 * 1000));
      diff -= days * 24 * 3600 * 1000;
      const hours = Math.floor(diff / (3600 * 1000));
      diff -= hours * 3600 * 1000;
      const minutes = Math.floor(diff / (60 * 1000));
      diff -= minutes * 60 * 1000;
      const seconds = Math.floor(diff / 1000);
      const parts: string[] = [];
      if (days) parts.push(`${days}d`);
      parts.push(`${String(hours).padStart(2, '0')}h`);
      parts.push(`${String(minutes).padStart(2, '0')}m`);
      parts.push(`${String(seconds).padStart(2, '0')}s`);
      setCountdown(parts.join(' '));
    }

    tick();
    timer = setInterval(tick, 1000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [nextScheduleStart]);

  // fetch server time once to compute offset
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/server-time');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const serverNow = Number(data?.now) || new Date(data?.iso).getTime();
        const localNow = Date.now();
        setServerOffsetMs(serverNow - localNow);
      } catch (e) {
        // ignore — fall back to local clock
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // determine if schedule entries indicate an active schedule
  const isScheduledButInactive = React.useMemo(() => {
    if (!Array.isArray(schedules)) return false;
    if (!schedules.length) return false;
    const now = Date.now();
    // if any schedule is active now, return false (not inactive)
    for (const s of schedules) {
      try {
        if (!s.startDate) continue;
        const start = new Date(s.startDate).getTime();
        const end = s.endDate ? new Date(s.endDate).getTime() : null;
        if (isNaN(start)) continue;
        if (now >= start && (!end || now <= end)) {
          return false;
        }
      } catch (e) {
        continue;
      }
    }
    // none active, but schedules exist => scheduled but inactive
    return schedules.length > 0;
  }, [nextScheduleStart]);

  const muted = Boolean(createdByMe && isScheduledButInactive);

  const { user, hasPermission } = useAuth();

  return (
    <Card className={`hover-elevate ${muted ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start">
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground truncate">{title}</h3>
                {subtitle ? (
                  <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2 ml-4">
                {user && (hasPermission('cards:edit') || hasPermission('cards:delete')) ? (
                  <>
                    {hasPermission('cards:edit') && onEdit && (
                      <Button size="icon" variant="ghost" onClick={() => onEdit(id)} aria-label="Editar">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    )}
                    {hasPermission('cards:delete') && onDelete && (
                      <Button size="icon" variant="ghost" onClick={() => onDelete(id)} aria-label="Apagar">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                ) : null}
              </div>
            </div>
            {image ? (
              <div className="mt-2">
                <img src={image} alt={title} className="w-full h-auto rounded-md" />
              </div>
            ) : (
              <div className="mt-2 p-4 rounded-md border border-dashed border-border bg-muted/30 text-center text-sm text-muted-foreground">
                Nenhum conteúdo publicado
              </div>
            )}
            {muted && (
              <div className="mt-2 text-sm text-muted-foreground">Agendado — visível apenas para você até a data de liberação</div>
            )}
            {countdown && (
              <div className="mt-2 text-sm text-muted-foreground">Início em: {countdown}</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default EditableCard;
