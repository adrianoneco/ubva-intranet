"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Edit3, Trash2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type ScheduleEntry = {
  startDate?: string;
  endDate?: string;
  image?: string;
};

export type CardData = {
  id?: string;
  title: string;
  subtitle?: string;
  image?: string | null;
  schedules?: ScheduleEntry[];
};

interface Props {
  open: boolean;
  initial?: Partial<CardData>;
  onClose: () => void;
  onSave: (data: CardData) => void;
}

export function CardEditorModal({ open, initial, onClose, onSave }: Props) {
  const [tab, setTab] = useState("general");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [image, setImage] = useState("");
  const [imageChanged, setImageChanged] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [createPublishAt, setCreatePublishAt] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingScheduleIndex, setEditingScheduleIndex] = useState<number | null>(null);
  const [formStart, setFormStart] = useState<string>("");
  const [formEnd, setFormEnd] = useState<string>("");
  const [formImage, setFormImage] = useState<string>("");
  const { toast } = useToast();

  function formatDateUTC3(iso?: string) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      // show date and time in São Paulo timezone
      return d.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return iso;
    }
  }

  function isoToLocalDatetimeInput(iso?: string) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
  }

  function localDatetimeInputToISO(value: string) {
    if (!value) return undefined;
    const d = new Date(value);
    if (isNaN(d.getTime())) return undefined;
    return d.toISOString();
  }

  // countdown 'now' state updated while modal is open
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    if (!open) return;
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [open]);

  function formatDuration(ms: number) {
    if (ms <= 0) return "0s";
    const sec = Math.floor(ms / 1000) % 60;
    const min = Math.floor(ms / (1000 * 60)) % 60;
    const hr = Math.floor(ms / (1000 * 60 * 60)) % 24;
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const parts = [] as string[];
    if (days) parts.push(`${days}d`);
    if (hr) parts.push(`${hr}h`);
    if (min) parts.push(`${min}m`);
    parts.push(`${sec}s`);
    return parts.join(" ");
  }

  function scheduleCountdownText(s?: ScheduleEntry) {
    if (!s || !s.startDate) return "";
    const start = new Date(s.startDate).getTime();
    const end = s.endDate ? new Date(s.endDate).getTime() : null;
    if (isNaN(start)) return "";
    const nowMs = now.getTime();
    if (nowMs < start) {
      return `Começa em ${formatDuration(start - nowMs)}`;
    }
    if (end && nowMs <= end) {
      return `Termina em ${formatDuration(end - nowMs)}`;
    }
    if (!end && nowMs >= start) {
      return `Ativo`;
    }
    return "";
  }

  useEffect(() => {
    setTitle(initial?.title || "");
    setSubtitle(initial?.subtitle || "");
    setImage(initial?.image || "");
    setImageChanged(false);
    setSchedules(initial?.schedules ? initial.schedules : []);
    setCreatePublishAt("");
    // reset active tab to 'general' when modal opens
    setTab("general");
    // reset schedule form
    setShowScheduleForm(false);
    setEditingScheduleIndex(null);
    setFormStart("");
    setFormEnd("");
    setFormImage("");
  }, [initial, open]);

  function addSchedule() {
    setSchedules((s) => [...s, { startDate: undefined, endDate: undefined, image: undefined }]);
  }

  function updateSchedule(index: number, patch: Partial<ScheduleEntry>) {
    setSchedules((s) => s.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeSchedule(index: number) {
    // If editing an existing card, persist removal immediately
    if (initial && initial.id) {
      const id = initial.id;
      const newSchedules = schedules.filter((_, i) => i !== index);
      (async () => {
        try {
          const res = await fetch(`/api/cards/${id}/schedules`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ schedules: newSchedules }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'failed' }));
            throw new Error(err.error || 'Failed to update schedules');
          }
          // success: update local state
          setSchedules(newSchedules);
          toast({ title: 'Agendamento removido', description: 'Agendamento removido com sucesso.' });
        } catch (err: any) {
          console.error('Failed to remove schedule', err);
          toast({ title: 'Erro', description: err?.message || 'Não foi possível remover o agendamento', variant: 'destructive' });
        }
      })();
      return;
    }

    setSchedules((s) => s.filter((_, i) => i !== index));
  }

  function openNewScheduleForm() {
    setEditingScheduleIndex(null);
    setFormStart("");
    setFormEnd("");
    setFormImage("");
    setShowScheduleForm(true);
  }

  function openEditScheduleForm(index: number) {
    const s = schedules[index];
    setEditingScheduleIndex(index);
    setFormStart(isoToLocalDatetimeInput(s.startDate ?? ""));
    setFormEnd(isoToLocalDatetimeInput(s.endDate ?? ""));
    setFormImage(s.image ?? "");
    setShowScheduleForm(true);
  }

  function cancelScheduleForm() {
    setShowScheduleForm(false);
    setEditingScheduleIndex(null);
    setFormStart("");
    setFormEnd("");
    setFormImage("");
  }

  function submitScheduleForm() {
    // Require an image for schedule entries
    if (!formImage) {
      toast({ title: 'Imagem obrigatória', description: 'O agendamento requer uma imagem. Faça upload antes de salvar.', variant: 'destructive' });
      return;
    }

    const entry: ScheduleEntry = {
      startDate: localDatetimeInputToISO(formStart),
      endDate: localDatetimeInputToISO(formEnd),
      image: formImage,
    };
    // If editing an existing card, persist schedules immediately via schedules endpoint
    if (initial && initial.id) {
      const id = initial.id;
      const newSchedules = editingScheduleIndex === null ? [...schedules, entry] : schedules.map((it, i) => (i === editingScheduleIndex ? entry : it));
      (async () => {
        try {
          const res = await fetch(`/api/cards/${id}/schedules`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ schedules: newSchedules }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'failed' }));
            throw new Error(err.error || 'Failed to update schedules');
          }
          // update local state with persisted schedules
          setSchedules(newSchedules);
          toast({ title: editingScheduleIndex === null ? 'Agendamento adicionado' : 'Agendamento salvo', description: 'Alterações salvas com sucesso.' });
          cancelScheduleForm();
        } catch (err: any) {
          console.error('Failed to save schedule', err);
          toast({ title: 'Erro', description: err?.message || 'Não foi possível salvar o agendamento', variant: 'destructive' });
        }
      })();
      return;
    }

    if (editingScheduleIndex === null) {
      setSchedules((s) => [...s, entry]);
    } else {
      setSchedules((s) => s.map((it, i) => (i === editingScheduleIndex ? entry : it)));
    }
    cancelScheduleForm();
  }

  function handleSave() {
    let finalSchedules: ScheduleEntry[] | undefined = schedules.length ? schedules : undefined;
    if (!initial && createPublishAt) {
      const iso = localDatetimeInputToISO(createPublishAt);
      if (iso) {
        // Creating a publish schedule requires an image
        if (!image) {
          toast({ title: 'Imagem obrigatória', description: 'Para agendar a publicação é necessário selecionar uma imagem.', variant: 'destructive' });
          return;
        }
        finalSchedules = [{ startDate: iso, endDate: undefined, image }];
      }
    }

    const data: CardData = {
      // keep id only if editing an existing card
      ...(initial?.id ? { id: initial.id } : {}),
      title,
      subtitle,
      // include image for new cards; for edits include only when changed
      ...(!initial ? { image: image ? image : undefined } : (imageChanged ? { image: image ? image : undefined } : {})),
      schedules: finalSchedules,
    };
    onSave(data);
  }

  return (
    <Dialog open={open} onOpenChange={(o: any) => !o && onClose()}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar Card" : "Criar Card"}</DialogTitle>
          <DialogDescription>
            Configure o conteúdo do card e agende quando ele deve entrar em vigor.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v: React.SetStateAction<string>) => setTab(v)}>
          <TabsList className="mb-4">
              <TabsTrigger value="general">Geral</TabsTrigger>
              {initial && initial.id ? <TabsTrigger value="schedule">Agendamentos</TabsTrigger> : null}
            </TabsList>

          <TabsContent value="general">
            <div className="space-y-3">
              <div>
                <Label> Título </Label>
                <Input value={title} onChange={(e: { target: { value: React.SetStateAction<string>; }; }) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label> Subtítulo </Label>
                <Input value={subtitle} onChange={(e: { target: { value: React.SetStateAction<string>; }; }) => setSubtitle(e.target.value)} />
              </div>
              <div>
                <Label> Upload de imagem </Label>
                <div
                  className="p-4 border border-dashed rounded-md text-center cursor-pointer"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const file = e.dataTransfer?.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const form = new FormData();
                      form.append("file", file);
                      // If editing an existing card, attach image directly to that card
                      const uploadUrl = initial && initial.id ? `/api/cards/${initial.id}/upload-image` : "/api/uploads";
                      const res = await fetch(uploadUrl, { method: "POST", body: form, credentials: 'include' });
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({ error: 'upload failed' }));
                        throw new Error(err?.error || 'Upload failed');
                      }
                      const data = await res.json();
                      setImage(data.url);
                      setImageChanged(true);
                      toast({ title: 'Upload concluído', description: 'Imagem enviada com sucesso.' });
                    } catch (err: any) {
                      console.error(err);
                      toast({ title: 'Erro no upload', description: err?.message || 'Não foi possível enviar a imagem', variant: 'destructive' });
                    } finally {
                      setUploading(false);
                    }
                  }}
                  onClick={() => {
                    // open file picker fallback
                    const inp = document.createElement('input');
                    inp.type = 'file';
                    inp.accept = 'image/*';
                    inp.onchange = async () => {
                      const file = (inp.files && inp.files[0]) as File | undefined;
                      if (!file) return;
                      setUploading(true);
                      try {
                        const form = new FormData();
                        form.append("file", file);
                        const uploadUrl = initial && initial.id ? `/api/cards/${initial.id}/upload-image` : "/api/uploads";
                        const res = await fetch(uploadUrl, { method: "POST", body: form, credentials: 'include' });
                        if (!res.ok) {
                          const err = await res.json().catch(() => ({ error: 'upload failed' }));
                          throw new Error(err?.error || 'Upload failed');
                        }
                        const data = await res.json();
                        setImage(data.url);
                        setImageChanged(true);
                        toast({ title: 'Upload concluído', description: 'Imagem enviada com sucesso.' });
                      } catch (err: any) {
                        console.error(err);
                        toast({ title: 'Erro no upload', description: err?.message || 'Não foi possível enviar a imagem', variant: 'destructive' });
                      } finally {
                        setUploading(false);
                      }
                    };
                    inp.click();
                  }}
                >
                  <div className="text-sm text-muted-foreground">Arraste a imagem aqui ou clique para selecionar</div>
                </div>
                {uploading && <p className="text-sm text-muted-foreground mt-2">Enviando...</p>}
                  {/* preview da imagem atual e opção de remover */}
                  {image && (
                    <div className="mt-3 flex items-center gap-3">
                      <img src={image} alt="preview" className="w-24 h-24 object-cover rounded-md" />
                      <div>
                        <div className="text-sm text-muted-foreground">Imagem atual</div>
                        <div className="mt-2">
                          {imageChanged ? (
                            <Button size="sm" variant="destructive" onClick={() => { setImage(""); /* keep imageChanged as true if it was set by upload */ }}>{"Remover imagem"}</Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">(upload uma nova imagem para habilitar remoção)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* when creating a new card, allow scheduling a single publish datetime here */}
                  {!initial && (
                    <div className="mt-4">
                      <Label> Agendar publicação </Label>
                      <Input type="datetime-local" value={createPublishAt} onChange={(e:any) => setCreatePublishAt(e.target.value)} />
                      <p className="text-xs text-muted-foreground mt-1">Se preenchido, o card será publicado no horário selecionado. É necessário selecionar uma imagem.</p>
                    </div>
                  )}
              </div>
            </div>
          </TabsContent>

          {initial && initial.id ? (
          <TabsContent value="schedule">
            <div className="space-y-3">
              <div>
                <Button onClick={openNewScheduleForm}>Adicionar agendamento</Button>
              </div>
              <div className="space-y-2 max-h-56 overflow-auto pr-2">
                {schedules.map((s, idx) => (
                  <div key={idx} className="p-2 border rounded flex items-start gap-3">
                    <div className="w-16 h-16 flex-shrink-0">
                      {s.image ? (
                        <img src={s.image} alt={`schedule-${idx}`} className="w-full h-full object-cover rounded-md" />
                      ) : (
                        <div className="w-full h-full bg-muted rounded-md" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium truncate">{formatDateUTC3(s.startDate)} → {formatDateUTC3(s.endDate)}</div>
                            <div className="text-xs text-muted-foreground mt-1">{scheduleCountdownText(s)}</div>
                          </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" size="icon" variant="destructive" onClick={() => openEditScheduleForm(idx)} aria-label="Editar agendamento">
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button type="button" size="icon" variant="destructive" onClick={() => removeSchedule(idx)} aria-label="Remover agendamento">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {showScheduleForm && (
                <div className="mt-4 p-4 border rounded">
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div>
                      <Label>Data e hora de início</Label>
                      <Input type="datetime-local" value={formStart} onChange={(e:any) => setFormStart(e.target.value)} />
                      <p className="text-xs text-muted-foreground mt-1">Horário local (exibido como UTC-3 para São Paulo)</p>
                    </div>
                    <div>
                      <Label>Data e hora de término</Label>
                      <Input type="datetime-local" value={formEnd} onChange={(e:any) => setFormEnd(e.target.value)} />
                      <p className="text-xs text-muted-foreground mt-1">Horário local (opcional)</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Label>Upload de imagem</Label>
                    <div
                      className="p-3 border border-dashed rounded-md text-center cursor-pointer"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={async (e) => {
                        e.preventDefault();
                        const file = e.dataTransfer?.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        try {
                          const form = new FormData();
                          form.append("file", file);
                          const res = await fetch("/api/cards/schedule-upload", { method: "POST", body: form, credentials: 'include' });
                          if (!res.ok) {
                            const err = await res.json().catch(() => ({ error: 'upload failed' }));
                            throw new Error(err?.error || 'Upload failed');
                          }
                          const data = await res.json();
                          // For schedule images we want to use the dedicated schedule upload endpoint
                          // If the response contains 'url' use it; otherwise fallback
                          setFormImage(data.url || data.url);
                          toast({ title: 'Upload concluído', description: 'Imagem enviada com sucesso.' });
                        } catch (err: any) {
                          console.error(err);
                          toast({ title: 'Erro no upload', description: err?.message || 'Não foi possível enviar a imagem', variant: 'destructive' });
                        } finally {
                          setUploading(false);
                        }
                      }}
                      onClick={() => {
                        const inp = document.createElement('input');
                        inp.type = 'file';
                        inp.accept = 'image/*';
                        inp.onchange = async () => {
                          const file = (inp.files && inp.files[0]) as File | undefined;
                          if (!file) return;
                          setUploading(true);
                          try {
                            const form = new FormData();
                            form.append("file", file);
                            // For schedule images use the schedule-specific upload endpoint
                            const res = await fetch('/api/cards/schedule-upload', { method: 'POST', body: form, credentials: 'include' });
                            if (!res.ok) {
                              const err = await res.json().catch(() => ({ error: 'upload failed' }));
                              throw new Error(err?.error || 'Upload failed');
                            }
                            const data = await res.json();
                            setFormImage(data.url);
                            toast({ title: 'Upload concluído', description: 'Imagem enviada com sucesso.' });
                          } catch (err: any) {
                            console.error(err);
                            toast({ title: 'Erro no upload', description: err?.message || 'Não foi possível enviar a imagem', variant: 'destructive' });
                          } finally {
                            setUploading(false);
                          }
                        };
                        inp.click();
                      }}
                    >
                      <div className="text-sm text-muted-foreground">Arraste a imagem aqui ou clique para selecionar</div>
                    </div>
                      {/* pré-visualização da imagem do agendamento */}
                      {formImage && (
                        <div className="mt-3 flex items-center gap-3">
                          <img src={formImage} alt="preview-schedule" className="w-20 h-20 object-cover rounded-md" />
                          <div>
                            <div className="text-sm text-muted-foreground">Imagem do agendamento</div>
                            <div className="mt-2">
                              <Button size="sm" variant="destructive" onClick={() => setFormImage("")}>Remover</Button>
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="ghost" onClick={cancelScheduleForm}>Cancelar</Button>
                    {editingScheduleIndex !== null && (
                      <Button type="button" size="icon" variant="destructive" onClick={() => { if (editingScheduleIndex !== null) { removeSchedule(editingScheduleIndex); } cancelScheduleForm(); }} aria-label="Remover agendamento">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button onClick={submitScheduleForm}>{editingScheduleIndex === null ? 'Adicionar' : 'Salvar'}</Button>
                  </div>
                </div>
              )}
            </div>
            </TabsContent>
            ) : null}
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose()} className="mr-2">
            Cancelar
          </Button>
          <Button onClick={handleSave}>{initial ? "Salvar" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CardEditorModal;
