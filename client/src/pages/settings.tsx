import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, Edit3 } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

type ScheduleSettings = {
  interval: number; // minutes
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  workingDays: number[]; // 0=Sun..6=Sat
  availableFrom?: string; // ISO date yyyy-mm-dd
  availableTo?: string; // ISO date yyyy-mm-dd
};

const STORAGE_KEY = 'schedule.settings.v1';

function defaultSettings(): ScheduleSettings {
  return {
    interval: 15,
    startTime: '08:00',
    endTime: '17:00',
    workingDays: [1,2,3,4,5],
    availableFrom: undefined,
    availableTo: undefined,
  };
}

function loadSettings(): ScheduleSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw);
    return { ...defaultSettings(), ...parsed } as ScheduleSettings;
  } catch (e) {
    return defaultSettings();
  }
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = React.useState<ScheduleSettings>(() => loadSettings());
  // pickups state (local-only)
  const [pickups, setPickups] = React.useState<Pickup[]>(() => {
    try { const raw = localStorage.getItem('pickups.v1'); return raw ? JSON.parse(raw) as Pickup[] : []; } catch (e) { return []; }
  });
  React.useEffect(() => { try { localStorage.setItem('pickups.v1', JSON.stringify(pickups)); } catch (e) {} }, [pickups]);

  const [calendarMonth, setCalendarMonth] = React.useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDate, setSelectedDate] = React.useState('');
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [modalClientId, setModalClientId] = React.useState('');
  const [modalClientName, setModalClientName] = React.useState('');
  const [modalOrderId, setModalOrderId] = React.useState('');
  const [modalTime, setModalTime] = React.useState('');
  const [modalStatus, setModalStatus] = React.useState<'agendado'|'confirmado'|'entregue'|'cancelado'>('agendado');
  const [activeSection, setActiveSection] = React.useState<'agendamentos'|'usuarios'>('agendamentos');

  // Users state for the new Usuarios tab
  type User = { id: string; name: string; email: string; role: string; permissions: string[] };
  const [users, setUsers] = React.useState<User[]>([]);
  // load users from server
  React.useEffect(() => {
    let mounted = true;
    fetch('/api/admin/users', { credentials: 'include' }).then(r => r.json()).then((data) => {
      if (!mounted) return;
      if (Array.isArray(data)) setUsers(data.map((u: any) => ({ id: u.id, name: u.displayName || u.username, email: u.email || '', role: u.role || 'viewer', permissions: u.permissions || [] })));
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  const [usersModalOpen, setUsersModalOpen] = React.useState(false);
  const [editingUserId, setEditingUserId] = React.useState<string | null>(null);
  const [editingUserName, setEditingUserName] = React.useState('');
  const [editingUserEmail, setEditingUserEmail] = React.useState('');
  const [editingUserPassword, setEditingUserPassword] = React.useState('');
  const [editingUserRole, setEditingUserRole] = React.useState('viewer');
  const [editingUserPerms, setEditingUserPerms] = React.useState<string[]>([]);
  const [editingUserTab, setEditingUserTab] = React.useState<'geral'|'permissoes'>('geral');
  // Groups (roles) with permissions
  type Group = { id: string; name: string; permissions: string[] };
  const [groups, setGroups] = React.useState<Group[]>([]);
  React.useEffect(() => {
    let mounted = true;
    fetch('/api/admin/groups', { credentials: 'include' }).then(r => r.json()).then((data) => {
      if (!mounted) return;
      if (Array.isArray(data)) setGroups(data.map((g: any) => ({ id: g.id, name: g.name, permissions: g.permissions || [] })));
      // fallback to defaults if empty
      if (mounted && Array.isArray(data) && data.length === 0) {
        setGroups([
          { id: 'admin', name: 'Admin', permissions: ['agendamento:create','agendamento:edit','agendamento:delete','users:manage','calendar:view','calendar:create','calendar:edit','calendar:delete'] },
          { id: 'editor', name: 'Editor', permissions: ['agendamento:create','agendamento:edit','calendar:view','calendar:create','calendar:edit'] },
          { id: 'viewer', name: 'Viewer', permissions: [] },
        ]);
      }
    }).catch(() => {
      setGroups([
        { id: 'admin', name: 'Admin', permissions: ['agendamento:create','agendamento:edit','agendamento:delete','users:manage','calendar:view','calendar:create','calendar:edit','calendar:delete'] },
        { id: 'editor', name: 'Editor', permissions: ['agendamento:create','agendamento:edit','calendar:view','calendar:create','calendar:edit'] },
        { id: 'viewer', name: 'Viewer', permissions: [] },
      ]);
    });
    return () => { mounted = false; };
  }, []);
  const [groupsModalOpen, setGroupsModalOpen] = React.useState(false);
  const [editingGroupId, setEditingGroupId] = React.useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = React.useState('');
  const [editingGroupPerms, setEditingGroupPerms] = React.useState<string[]>([]);

  function openGroupsModal() {
    setEditingGroupId(null); setEditingGroupName(''); setEditingGroupPerms([]);
    setGroupsModalOpen(true);
  }

  function openEditGroup(g: Group) {
    setEditingGroupId(g.id); setEditingGroupName(g.name); setEditingGroupPerms(g.permissions || []); setGroupsModalOpen(true);
  }

  function handleSaveGroup() {
    if (!editingGroupName) { toast({ title: 'Validação', description: 'Nome do grupo é obrigatório' }); return; }
    (async () => {
      try {
        if (editingGroupId) {
          const res = await fetch(`/api/admin/groups/${editingGroupId}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editingGroupName, permissions: editingGroupPerms }) });
          if (!res.ok) throw new Error('failed');
          const data = await res.json();
          setGroups(prev => prev.map(x => x.id === editingGroupId ? ({ ...x, name: data.group.name, permissions: data.group.permissions }) : x));
          toast({ title: 'Grupo atualizado' });
        } else {
          const res = await fetch('/api/admin/groups', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editingGroupName, permissions: editingGroupPerms }) });
          if (!res.ok) throw new Error('failed');
          const data = await res.json();
          setGroups(prev => [{ id: data.group.id, name: data.group.name, permissions: data.group.permissions }, ...prev]);
          toast({ title: 'Grupo criado' });
        }
      } catch (e) {
        toast({ title: 'Erro', description: 'Não foi possível salvar o grupo' });
      } finally {
        setGroupsModalOpen(false);
      }
    })();
  }

  function handleDeleteGroup(id: string) {
    (async () => {
      try {
        const res = await fetch(`/api/admin/groups/${id}`, { method: 'DELETE', credentials: 'include' });
        if (!res.ok) throw new Error('failed');
        setGroups(prev => prev.filter(g => g.id !== id));
        // refresh users from server to get role resets
        const ru = await fetch('/api/admin/users', { credentials: 'include' });
        if (ru.ok) {
          const usersData = await ru.json();
          setUsers(usersData.map((u: any) => ({ id: u.id, name: u.displayName || u.username, email: u.email || '', role: u.role || 'viewer', permissions: u.permissions || [] })));
        }
        toast({ title: 'Grupo removido' });
      } catch (e) {
        toast({ title: 'Erro', description: 'Não foi possível remover o grupo' });
      }
    })();
  }

  function toggleEditingGroupPerm(perm: string) {
    setEditingGroupPerms(p => p.includes(perm) ? p.filter(x => x !== perm) : [...p, perm]);
  }

  type Pickup = {
    id: string; date: string; time?: string; clientId: string; clientName: string; orderId: string; userId?: string; createdAt: string; status?: 'agendado'|'confirmado'|'entregue'|'cancelado';
  };

  function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
  function getMonthMatrix(d: Date) {
    const start = startOfMonth(d);
    const end = endOfMonth(d);
    const matrix: Date[] = [];
    const s = new Date(start); s.setDate(start.getDate() - s.getDay());
    const e = new Date(end); e.setDate(end.getDate() + (6 - e.getDay()));
    for (let cur = new Date(s); cur <= e; cur.setDate(cur.getDate() + 1)) matrix.push(new Date(cur));
    return matrix;
  }

  function isoDateLocal(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  function parseIsoToLocal(iso: string) {
    const parts = (iso || '').split('-').map(Number);
    if (parts.length < 3 || parts.some(isNaN)) return new Date(iso);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatDateTime(isoDate: string | undefined | null, timeStr: string | undefined | null) {
    if (!isoDate && !timeStr) return '—';
    try {
      const iso = isoDate || '';
      const parts = (iso || '').split('-').map(Number);
      if (parts.length < 3 || parts.some(isNaN)) return '—';
      const [y, m, d] = parts;
      const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
      const dd = String(d).padStart(2, '0');
      const mmth = String(m).padStart(2, '0');
      const yyyy = String(y);
      const H = String((hh || 0)).padStart(2, '0');
      const M = String((mm || 0)).padStart(2, '0');
      return `${dd}/${mmth}/${yyyy} ${H}:${M}`;
    } catch (e) { return '—'; }
  }

  function isPastDateTime(isoDate: string, time: string) {
    if (!isoDate || !time) return false;
    const d = parseIsoToLocal(isoDate);
    const [hh, mm] = (time || '00:00').split(':').map(Number);
    d.setHours(hh, mm, 0, 0);
    return d.getTime() < Date.now();
  }

  function generateTimeSlotsForSettings() {
    const [sh, sm] = (settings.startTime || '08:00').split(':').map(Number);
    const [eh, em] = (settings.endTime || '17:00').split(':').map(Number);
    const interval = Number(settings.interval) || 15;
    const slots: string[] = [];
    const startTotal = sh * 60 + (sm || 0);
    const endTotal = eh * 60 + (em || 0);
    for (let t = startTotal; t <= endTotal; t += interval) {
      const hh = Math.floor(t/60); const mm = t%60;
      if (hh > eh || (hh === eh && mm > em)) break;
      slots.push(`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`);
    }
    return slots;
  }

  const monthMatrix = getMonthMatrix(calendarMonth);

  function openEdit(it: Pickup) {
    setEditingId(it.id);
    setModalClientId(it.clientId);
    setModalClientName(it.clientName);
    setModalOrderId(it.orderId);
    setModalTime(it.time || '');
    setSelectedDate(it.date);
    setModalStatus(it.status || 'agendado');
    setModalOpen(true);
  }

  React.useEffect(() => {
    if (!selectedDate || !modalTime) return;
    const occupied = pickups.some(p => p.id !== editingId && p.date === selectedDate && p.time === modalTime);
    try {
      const [y, m, d] = (selectedDate||'').split('-').map(Number);
      const [hh, mm] = (modalTime||'00:00').split(':').map(Number);
      const slotDt = new Date(y, (m||1)-1, d, hh, mm, 0);
      if (occupied || slotDt.getTime() < Date.now()) setModalTime('');
    } catch (e) {
      if (occupied) setModalTime('');
    }
  }, [selectedDate, pickups, modalTime, editingId]);

  function handleDelete(id: string) { setPickups(prev => prev.filter(p => p.id !== id)); toast({ title: 'Removido' }); }

  function handleSaveEdit() {
    if (!selectedDate || !modalTime || !modalClientId || !modalClientName || !modalOrderId) { toast({ title: 'Validação', description: 'Preencha todos os campos' }); return; }
    // block past date/time
    if (isPastDateTime(selectedDate, modalTime)) { toast({ title: 'Inválido', description: 'Não é possível agendar no passado' }); return; }
    if (editingId) {
      // check conflict excluding editingId
      if (pickups.some(p => p.id !== editingId && p.date === selectedDate && p.time === modalTime)) {
        toast({ title: 'Conflito', description: 'Horário já ocupado' }); return;
      }
      setPickups(prev => prev.map(p => p.id === editingId ? ({ ...p, date: selectedDate, time: modalTime, clientId: modalClientId, clientName: modalClientName, orderId: modalOrderId, status: modalStatus }) : p));
      setEditingId(null);
      setModalOpen(false);
      toast({ title: 'Atualizado' });
    }
  }

  // Users helpers
  function openNewUser() {
    setEditingUserId(null);
    setEditingUserName(''); setEditingUserEmail(''); setEditingUserRole('viewer'); setEditingUserPerms([]);
    setEditingUserPassword('');
    setUsersModalOpen(true);
  }

  function handleSaveUser() {
    if (!editingUserName || !editingUserEmail) { toast({ title: 'Validação', description: 'Preencha nome e email do usuário' }); return; }
    (async () => {
      try {
        if (editingUserId) {
          const payload: any = { displayName: editingUserName, email: editingUserEmail, role: editingUserRole, permissions: editingUserPerms };
          if (editingUserPassword) payload.password = editingUserPassword;
          const res = await fetch(`/api/admin/users/${editingUserId}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!res.ok) throw new Error('failed');
          const data = await res.json();
          setUsers(u => u.map(x => x.id === editingUserId ? ({ ...x, name: data.user.displayName || data.user.username, email: data.user.email || '', role: data.user.role, permissions: data.user.permissions || [] }) : x));
          toast({ title: 'Atualizado' });
        } else {
          const payload: any = { displayName: editingUserName, email: editingUserEmail, role: editingUserRole, permissions: editingUserPerms };
          if (editingUserPassword) payload.password = editingUserPassword;
          const res = await fetch('/api/admin/users', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!res.ok) throw new Error('failed');
          const data = await res.json();
          setUsers(u => [{ id: data.user.id, name: data.user.displayName || data.user.username, email: data.user.email || '', role: data.user.role, permissions: data.user.permissions || [] }, ...u]);
          // if server returned a generated password, show it in a toast so admin can copy it
          if (data.password) {
            toast({ title: 'Criado', description: `Senha gerada: ${data.password}` });
          } else {
            toast({ title: 'Criado' });
          }
        }
      } catch (e) {
        toast({ title: 'Erro', description: 'Não foi possível salvar o usuário' });
      } finally {
        setUsersModalOpen(false);
      }
    })();
  }

  function toggleEditingUserPerm(perm: string) {
    setEditingUserPerms(p => p.includes(perm) ? p.filter(x => x !== perm) : [...p, perm]);
  }

  function toggleDay(day: number) {
    setSettings(s => {
      const exists = s.workingDays.includes(day);
      return {
        ...s,
        workingDays: exists ? s.workingDays.filter(d => d !== day) : [...s.workingDays, day],
      };
    });
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      toast({ title: 'Salvo', description: 'Configurações de calendário salvas.' });
    } catch (e) {
      toast({ title: 'Erro', description: 'Não foi possível salvar as configurações.' });
    }
  }

  function resetDefaults() {
    const d = defaultSettings();
    setSettings(d);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    toast({ title: 'Redefinido', description: 'Configurações restauradas para o padrão.' });
  }

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="max-w-5xl mx-auto px-2 sm:px-4 lg:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <aside className="md:col-span-1">
            <Card className="bg-white/3 backdrop-blur-sm border border-white/6">
              <CardContent>
                <div className="space-y-2">
                  <button className={`w-full text-center p-2 rounded ${activeSection === 'agendamentos' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/20'}`} onClick={() => setActiveSection('agendamentos')}>Configurações</button>
                  <button className={`w-full text-center p-2 rounded ${activeSection === 'usuarios' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/20'}`} onClick={() => setActiveSection('usuarios')}>Usuarios</button>
                </div>
              </CardContent>
            </Card>
          </aside>

          <main className="md:col-span-3">
            {activeSection === 'agendamentos' ? (
              <div className="space-y-4">
                {/* Calendar settings card (previously 'Configurações do Calendário') */}
                <Card className="bg-white/5 backdrop-blur-sm border border-white/10">
                  <CardHeader>
                    <CardTitle>Agendamentos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label>Intervalo (min)</Label>
                        <select value={String(settings.interval)} onChange={(e)=>setSettings(s=>({ ...s, interval: Number(e.target.value)}))} className="mt-1 block w-32 rounded border p-2">
                          {[5,10,15,30,60].map(n=> <option key={n} value={n}>{n} minutos</option>)}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Início do expediente</Label>
                          <Input type="time" value={settings.startTime} onChange={(e:any)=>setSettings(s=>({ ...s, startTime: e.target.value }))} />
                        </div>
                        <div>
                          <Label>Fim do expediente</Label>
                          <Input type="time" value={settings.endTime} onChange={(e:any)=>setSettings(s=>({ ...s, endTime: e.target.value }))} />
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div>
                          <Label>Disponibilidade - Início</Label>
                          <Input type="date" value={settings.availableFrom || ''} onChange={(e:any)=>setSettings(s=>({ ...s, availableFrom: e.target.value || undefined }))} />
                        </div>
                        <div>
                          <Label>Disponibilidade - Fim</Label>
                          <Input type="date" value={settings.availableTo || ''} onChange={(e:any)=>setSettings(s=>({ ...s, availableTo: e.target.value || undefined }))} />
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">Se preenchido, o calendário só permitirá agendamentos dentro deste intervalo.</div>

                      <div>
                        <Label>Dias da semana</Label>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'].map((d, i) => (
                            <label key={d} className="inline-flex items-center gap-2">
                              <input type="checkbox" checked={settings.workingDays.includes(i)} onChange={() => toggleDay(i)} />
                              <span className="text-sm ml-1">{d}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={save}>Salvar</Button>
                        <Button variant="ghost" onClick={resetDefaults}>Redefinir</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {activeSection === 'usuarios' ? (
              <div>
                <Card className="bg-white/5 backdrop-blur-sm border border-white/10">
                  <CardHeader>
                    <div className="w-full flex items-center justify-between">
                      <CardTitle>Usuarios</CardTitle>
                      <div className="flex items-center gap-2">
                        <Button onClick={openNewUser} size="sm">Novo usuário</Button>
                        <Button onClick={openGroupsModal} size="sm" variant="outline">Gerenciar Grupos</Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {users.length === 0 ? <div className="text-sm text-muted-foreground">Nenhum usuario</div> : (
                        users.map(u => (
                          <div key={u.id} className="flex items-center justify-between p-2 rounded bg-white/5">
                            <div>
                              <div className="font-medium">{u.name} <span className="text-xs text-muted-foreground">{u.email}</span></div>
                              <div className="text-xs text-muted-foreground">{u.role}</div>
                            </div>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => {
                                setEditingUserId(u.id); setEditingUserName(u.name); setEditingUserEmail(u.email); setEditingUserRole(u.role); setEditingUserPerms(u.permissions || []); setEditingUserPassword(''); setUsersModalOpen(true);
                              }} aria-label="Editar"><Edit3 className="h-4 w-4"/></Button>
                              
                              <Button size="icon" variant="ghost" onClick={async () => {
                                try {
                                                          const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE', credentials: 'include' });
                                  if (!res.ok) throw new Error('failed');
                                  setUsers(prev => prev.filter(x=>x.id!==u.id));
                                  toast({ title: 'Removido' });
                                } catch (e) {
                                  toast({ title: 'Erro', description: 'Não foi possível remover o usuário' });
                                }
                              }} aria-label="Remover"><Trash2 className="h-4 w-4"/></Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </main>
        </div>
        {/* Edit modal for agendamentos */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar Retirada</DialogTitle>
            </DialogHeader>
            <div className="mb-2 text-sm text-muted-foreground">{formatDateTime(selectedDate || null, modalTime || null)}</div>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <div>
                <Label className="text-center">Data</Label>
                <Input type="date" value={selectedDate} min={isoDateLocal(new Date())} onChange={(e:any)=>{
                  const v = e.target.value;
                  setSelectedDate(v);
                  // if selected time becomes invalid for new date, clear it
                  if (modalTime) {
                    const occupiedNow = pickups.some(p => p.id !== editingId && p.date === v && p.time === modalTime);
                    if (occupiedNow || isPastDateTime(v, modalTime)) setModalTime('');
                  }
                }} />
              </div>
              <div>
                <Label className="text-center">Horário</Label>
                <select value={modalTime} onChange={(e:any)=>setModalTime(e.target.value)} className="mt-1 block w-48 rounded border p-2">
                  <option value="">— selecione —</option>
                  {generateTimeSlotsForSettings().map(s => {
                    const occupied = selectedDate ? pickups.some(p => p.id !== editingId && p.date === selectedDate && p.time === s) : false;
                    const isPast = selectedDate ? isPastDateTime(selectedDate, s) : false;
                    return (<option key={s} value={s} disabled={occupied || isPast}>{s}{occupied ? ' — ocupado' : isPast ? ' — passado' : ''}</option>);
                  })}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <Label className="text-center">Cliente</Label>
                <Input value={modalClientId} onChange={(e:any)=>setModalClientId(e.target.value)} />
              </div>
              <div>
                <Label className="text-center">Nome do Cliente</Label>
                <Input value={modalClientName} onChange={(e:any)=>setModalClientName(e.target.value)} />
              </div>
              <div>
                <Label className="text-center">Pedido</Label>
                <Input value={modalOrderId} onChange={(e:any)=>setModalOrderId(e.target.value)} />
              </div>
              <div>
                <Label className="text-center">Status</Label>
                <select value={modalStatus} onChange={(e:any)=>setModalStatus(e.target.value)} className="mt-1 block w-full rounded border p-2">
                  <option value="agendado">Agendado</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="entregue">Entregue</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <div className="flex gap-2">
                <Button onClick={handleSaveEdit}>Salvar</Button>
                <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Groups modal */}
        <Dialog open={groupsModalOpen} onOpenChange={setGroupsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerenciar Grupos</DialogTitle>
            </DialogHeader>
            <div className="mb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Grupos configuráveis e suas permissões</div>
                <div>
                  <Button size="sm" onClick={()=>{ setEditingGroupId(null); setEditingGroupName(''); setEditingGroupPerms([]); setGroupsModalOpen(true); }}>Novo Grupo</Button>
                </div>
              </div>

              <div className="space-y-2">
                {groups.map(g => (
                  <div key={g.id} className="flex items-center justify-between p-2 rounded bg-white/5">
                    <div>
                      <div className="font-medium">{g.name}</div>
                      <div className="text-xs text-muted-foreground">{g.permissions.join(', ') || '— nenhuma —'}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => openEditGroup(g)}>Editar</Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteGroup(g.id)}>Remover</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Group edit area inside the same dialog for simplicity */}
            <div className="mt-4">
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <Label>Nome do Grupo</Label>
                  <Input value={editingGroupName} onChange={(e:any)=>setEditingGroupName(e.target.value)} />
                </div>
                <div>
                  <Label>Permissões</Label>
                  <div className="grid grid-cols-1 gap-1">
                    {['agendamento:create','agendamento:edit','agendamento:delete','users:manage','calendar:view','calendar:create','calendar:edit','calendar:delete'].map(p => (
                      <label key={p} className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={editingGroupPerms.includes(p)} onChange={()=>toggleEditingGroupPerm(p)} />
                        <span className="text-sm">{p}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <div className="flex gap-2">
                <Button onClick={handleSaveGroup}>Salvar</Button>
                <Button variant="ghost" onClick={() => setGroupsModalOpen(false)}>Fechar</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Users edit modal */}
        <Dialog open={usersModalOpen} onOpenChange={setUsersModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuario</DialogTitle>
            </DialogHeader>
            <div className="mb-2">
              <div className="flex gap-2">
                <button onClick={()=>setEditingUserTab('geral')} className={`px-2 py-1 rounded ${editingUserTab==='geral' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/10'}`}>Geral</button>
                <button onClick={()=>setEditingUserTab('permissoes')} className={`px-2 py-1 rounded ${editingUserTab==='permissoes' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/10'}`}>Permissões</button>
              </div>
            </div>
            {editingUserTab === 'geral' ? (
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <Label>Nome</Label>
                  <Input value={editingUserName} onChange={(e:any)=>setEditingUserName(e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={editingUserEmail} onChange={(e:any)=>setEditingUserEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Senha (opcional)</Label>
                  <Input placeholder="Deixe em branco para não alterar" type="password" value={editingUserPassword} onChange={(e:any)=>setEditingUserPassword(e.target.value)} />
                </div>
                <div>
                  <Label>Role (Grupo)</Label>
                  <select value={editingUserRole} onChange={(e:any)=>{
                    const val = e.target.value; setEditingUserRole(val);
                    // apply group permissions when selecting a known group
                    const g = groups.find(x => x.id === val);
                    if (g) setEditingUserPerms(g.permissions || []);
                  }} className="mt-1 block w-full rounded border p-2">
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                <div className="text-sm text-muted-foreground">Selecione permissões:</div>
                {['agendamento:create','agendamento:edit','agendamento:delete','users:manage','calendar:view','calendar:create','calendar:edit','calendar:delete'].map(p => (
                  <label key={p} className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={editingUserPerms.includes(p)} onChange={()=>toggleEditingUserPerm(p)} />
                    <span className="text-sm">{p}</span>
                  </label>
                ))}
                <div className="mt-2 text-sm text-muted-foreground">Permissões do grupo associado:</div>
                <div className="space-y-1">
                  {groups.map(g => (
                    <div key={g.id} className="p-2 rounded border bg-white/3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{g.name}</div>
                        <div className="text-xs text-muted-foreground">{g.permissions.length} permissões</div>
                      </div>
                      <div className="text-xs mt-1 text-muted-foreground">{g.permissions.join(', ') || '— nenhuma —'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <div className="flex gap-2">
                <Button onClick={handleSaveUser}>Salvar</Button>
                <Button variant="ghost" onClick={() => setUsersModalOpen(false)}>Cancelar</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
