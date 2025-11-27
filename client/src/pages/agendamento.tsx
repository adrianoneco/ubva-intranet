import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Trash2, Edit3, Search, SortAsc, SortDesc, Upload } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { getDate, getDateTime, getTime } from '@/utils/dateTime';

type Pickup = {
  id: string;
  date: string; // ISO date
  time?: string; // HH:MM
  status?: 'agendado' | 'confirmado' | 'entregue' | 'cancelado' | 'oe-gerada';
  clientId: string;
  clientName: string;
  orderId: string;
  oeNumber?: string; // Número da Ordem de Entrega
  cancelReason?: string; // Motivo do cancelamento
  userId?: number; // who created (user id)
  userDisplayName?: string; // display name of creator
    createdAt: string;
    scheduledAt?: string; // ISO datetime for the scheduled slot (date+time)
};

function storageKey() { return 'pickups.v1'; }

export default function AgendamentoPage() {
  const qc = useQueryClient();
  const pickupsQuery = useQuery({ queryKey: ['/api/pickups'] });
  const pickups = (pickupsQuery.data ?? []) as Pickup[];
  
  const createPickupMutation = useMutation({
    mutationFn: async (data: Pickup) => {
      const res = await apiRequest('POST', '/api/pickups', data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/pickups'] });
    },
  });

  const updatePickupMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Pickup> }) => {
      const res = await apiRequest('PATCH', `/api/pickups/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/pickups'] });
    },
  });

  const deletePickupMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/pickups/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/pickups'] });
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async (pickups: Pickup[]) => {
      const res = await apiRequest('POST', '/api/pickups/bulk', { pickups });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/pickups'] });
    },
  });
  const [date, setDate] = React.useState(() => isoDateLocal(new Date()));
  const [time, setTime] = React.useState('');
  const [selectedDate, setSelectedDate] = React.useState<string>(() => isoDateLocal(new Date()));
  const [clientId, setClientId] = React.useState('');
  const [clientName, setClientName] = React.useState('');
  const [orderId, setOrderId] = React.useState('');
  const { user } = useAuth();
  const { toast } = useToast();

  const [calendarMonth, setCalendarMonth] = React.useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });

  // When the visible month changes, ensure selectedDate is in that month.
  React.useEffect(() => {
    try {
      const sel = selectedDate || date;
      if (!sel) return;
      const parts = sel.split('-').map(Number);
      if (parts.length < 3) return;
      const selMonth = (parts[1] || 1) - 1;
      const selYear = parts[0];
      if (selYear !== calendarMonth.getFullYear() || selMonth !== calendarMonth.getMonth()) {
        // default to first day of visible month (so day numbers update and selection moves)
        const iso = isoDateLocal(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1));
        setSelectedDate(iso);
        setDate(iso);
      }
    } catch (e) {}
  }, [calendarMonth]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalClientId, setModalClientId] = React.useState('');
  const [modalClientName, setModalClientName] = React.useState('');
  const [modalOeNumber, setModalOeNumber] = React.useState('');
  const [modalOeTags, setModalOeTags] = React.useState<string[]>([]);
  const [modalOeInput, setModalOeInput] = React.useState('');
  const [modalOrderId, setModalOrderId] = React.useState('');
  const [modalOrderTags, setModalOrderTags] = React.useState<string[]>([]);
  const [modalOrderInput, setModalOrderInput] = React.useState('');
  const [modalStatus, setModalStatus] = React.useState<'agendado' | 'confirmado' | 'entregue' | 'cancelado' | 'oe-gerada'>('agendado');
  const [modalCancelReason, setModalCancelReason] = React.useState('');
  // tri-state: null = show both on small screens, true = show calendar only, false = show slots only
  const [showCalendarOnMobile, setShowCalendarOnMobile] = React.useState<boolean | null>(null);
  // Filter and sort states
  const [filterStatus, setFilterStatus] = React.useState<string>('todos');
  const [filterSearch, setFilterSearch] = React.useState<string>('');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [daySortOrder, setDaySortOrder] = React.useState<Record<string, 'asc' | 'desc'>>({});

  function resetForm() {
    setDate(''); setTime(''); setClientId(''); setClientName(''); setOrderId('');
    setModalClientId(''); setModalClientName(''); setModalOeNumber(''); setModalOrderId('');
    setModalOeTags([]); setModalOeInput('');
    setModalOrderTags([]); setModalOrderInput(''); setModalStatus('agendado');
    setModalCancelReason('');
  }

  function normalizeDate(d: string) { return d; }

  function loadScheduleSettings() {
    try {
      const raw = localStorage.getItem('schedule.settings.v1');
      if (!raw) return { interval: 15, startTime: '08:00', endTime: '17:00', workingDays: [1,2,3,4,5] };
      return JSON.parse(raw);
    } catch (e) {
      return { interval: 15, startTime: '08:00', endTime: '17:00', workingDays: [1,2,3,4,5] };
    }
  }

  function formatDateWithWeekday(iso: string) {
    const date = parseIsoToLocal(iso);
    const weekdays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    
    const dayOfWeek = weekdays[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    
    return `${dayOfWeek}, ${day} de ${month}`;
  }

  function toggleDaySort(dateKey: string) {
    setDaySortOrder(prev => ({
      ...prev,
      [dateKey]: prev[dateKey] === 'asc' ? 'desc' : 'asc'
    }));
  }

  function generateTimeSlots() {
    const settings = loadScheduleSettings();
    const slots: string[] = [];
    const [sh, sm] = (settings.startTime || '08:00').split(':').map(Number);
    const [eh, em] = (settings.endTime || '17:00').split(':').map(Number);
    const interval = Number(settings.interval) || 15;
    const startTotal = sh * 60 + (sm || 0);
    const endTotal = eh * 60 + (em || 0);
    for (let t = startTotal; t <= endTotal; t += interval) {
      const hh = Math.floor(t / 60);
      const mm = t % 60;
      // skip times beyond end if mm !== 0 and hh==eh and mm>em
      if (hh > eh || (hh === eh && mm > em)) break;
      const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      slots.push(timeStr);
    }
    return slots;
  }

  function withinAvailability(isoDate: string) {
    try {
      const settings = loadScheduleSettings();
      if (!settings) return true;
      const from = settings.availableFrom;
      const to = settings.availableTo;
      if (!from && !to) return true;
      if (from && isoDate < from) return false;
      if (to && isoDate > to) return false;
      return true;
    } catch (e) { return true; }
  }

  // Calendar helpers
  function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
  function getMonthMatrix(d: Date) {
    const start = startOfMonth(d);
    const end = endOfMonth(d);
    const matrix: Date[] = [];
    // start from Sunday of the week containing the 1st
    const s = new Date(start);
    s.setDate(start.getDate() - s.getDay());
    const e = new Date(end);
    e.setDate(end.getDate() + (6 - e.getDay()));
    for (let cur = new Date(s); cur <= e; cur.setDate(cur.getDate() + 1)) {
      matrix.push(new Date(cur));
    }
    return matrix;
  }

  function isoDateLocal(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  function formatDateTime(isoDate: string | undefined, timeStr: string | undefined) {
    if (!isoDate && !timeStr) return '—';
    try {
      const iso = isoDate || date;
      const parts = (iso || '').split('-').map(Number);
      if (parts.length < 3) return '—';
      const [y, m, d] = parts;
      const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
      const dd = String(d).padStart(2, '0');
      const mmth = String(m).padStart(2, '0');
      const yyyy = String(y);
      const H = String((hh || 0)).padStart(2, '0');
      const M = String((mm || 0)).padStart(2, '0');
      return `${dd}/${mmth}/${yyyy} ${H}:${M}`;
    } catch (e) {
      return '—';
    }
  }

  function openModalFor(slot: string) {
    setTime(slot);
    setModalClientId(''); setModalClientName(''); setModalOeNumber(''); setModalOrderId('');
    setModalStatus('agendado');
    setModalOeTags([]); setModalOeInput('');
    setModalOrderTags([]); setModalOrderInput('');
    setModalCancelReason('');
    setModalOpen(true);
  }

  const [editingId, setEditingId] = React.useState<string | null>(null);
  // range scheduler state
  const [rangeModalOpen, setRangeModalOpen] = React.useState(false);
  const [rangeStart, setRangeStart] = React.useState<string>(() => isoDateLocal(new Date()));
  const [rangeEnd, setRangeEnd] = React.useState<string>(() => isoDateLocal(new Date()));
  const [rangeTimeOption, setRangeTimeOption] = React.useState<'same' | 'first'>('first');
  const [rangeTime, setRangeTime] = React.useState<string>('');

  async function handleModalSave() {
    const useDate = selectedDate || date;
    if (!useDate || !time || !modalClientId || modalOeTags.length === 0 || modalOrderTags.length === 0) {
      toast({ title: 'Validação', description: 'Preencha data, horário, cliente, OE e pedido(s)' });
      return;
    }
    // when editing, ignore conflict with the item being edited
    if (editingId) {
      if (pickups.some(p => p.id !== editingId && p.date === useDate && p.time === time)) {
        toast({ title: 'Conflito', description: 'Horário já agendado. Escolha outro.' });
        setModalOpen(false);
        return;
      }
      const scheduledAt = new Date(`${useDate}T${time}:00`).toISOString();
      await updatePickupMutation.mutateAsync({
        id: editingId,
        data: {
          date: useDate,
          time,
          clientId: modalClientId,
          clientName: modalClientName,
          oeNumber: modalOeTags.join(','),
          orderId: modalOrderTags.join(','),
          status: modalStatus,
          cancelReason: modalStatus === 'cancelado' ? modalCancelReason : undefined,
          scheduledAt,
        }
      });
      toast({ title: 'Atualizado', description: 'Agendamento atualizado.' });
      setEditingId(null);
    } else {
      if (pickups.some(p => p.date === useDate && p.time === time)) {
        toast({ title: 'Conflito', description: 'Horário já agendado. Escolha outro.' });
        setModalOpen(false);
        return;
      }
      const p: Pickup = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        date: useDate,
        time: time,
        clientId: modalClientId,
        clientName: modalClientName,
        oeNumber: modalOeTags.join(','),
        status: modalStatus || 'agendado',
        orderId: modalOrderTags.join(','),
        cancelReason: modalStatus === 'cancelado' ? modalCancelReason : undefined,
        userId: user ? (user as any).id : undefined,
        userDisplayName: user ? ((user as any).displayName || (user as any).username || 'Usuário') : 'Anônimo',
        createdAt: new Date().toISOString(),
        scheduledAt: new Date(`${useDate}T${time}:00`).toISOString(),
      };
      await createPickupMutation.mutateAsync(p);
      toast({ title: 'Agendado', description: 'Retirada agendada com sucesso.' });
    }
    setModalOpen(false);
    resetForm();
  }

  function openEdit(it: Pickup) {
    setEditingId(it.id);
    setModalClientId(it.clientId);
    setModalClientName(it.clientName);
    setModalOeNumber(it.oeNumber || '');
    setModalOeInput('');
    setModalOeTags(it.oeNumber ? it.oeNumber.split(',').map(s=>s.trim()).filter(Boolean) : []);
    setModalOrderId(it.orderId);
    setModalOrderInput('');
    setModalOrderTags(it.orderId ? it.orderId.split(',').map(s=>s.trim()).filter(Boolean) : []);
    setSelectedDate(it.date);
    setTime(it.time || '');
    setModalStatus(it.status || 'agendado');
    setModalCancelReason(it.cancelReason || '');
    setModalOpen(true);
  }

  // when selectedDate (or date) changes, ensure the currently selected time is still valid
  React.useEffect(() => {
    const useDate = selectedDate || date;
    if (!useDate || !time) return;
    const occupied = pickups.some(p => p.id !== editingId && p.date === useDate && p.time === time);
    try {
      const [y, m, d] = (useDate||'').split('-').map(Number);
      const [hh, mm] = (time||'00:00').split(':').map(Number);
      const slotDt = new Date(y, (m||1)-1, d, hh, mm, 0);
      if (occupied || slotDt.getTime() < Date.now()) setTime('');
    } catch (e) {
      if (occupied) setTime('');
    }
  }, [selectedDate, date, pickups, time, editingId]);

  async function handleCreate() {
    const useDate = selectedDate || date;
    if (!useDate || !clientId || !modalOrderTags.length || !time) {
      toast({ title: 'Validação', description: 'Preencha data, horário, clientId e pedido(s)' });
      return;
    }
    // prevent double booking
    if (pickups.some(p => p.date === useDate && p.time === time)) {
      toast({ title: 'Conflito', description: 'Horário já agendado. Escolha outro.' });
      return;
    }
      const p: Pickup = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      date: useDate,
      time: time || undefined,
      clientId,
      clientName,
      status: 'agendado',
      orderId: modalOrderTags.join(','),
      userId: user ? (user as any).id : undefined,
      userDisplayName: user ? ((user as any).displayName || (user as any).username || 'Usuário') : 'Anônimo',
        createdAt: new Date().toISOString(),
        scheduledAt: time ? new Date(`${useDate}T${time}:00`).toISOString() : undefined,
    };
    await createPickupMutation.mutateAsync(p);
    toast({ title: 'Agendado', description: 'Retirada agendada com sucesso.' });
    resetForm();
  }

  async function handleDelete(id: string) {
    await deletePickupMutation.mutateAsync(id);
    toast({ title: 'Removido', description: 'Agendamento removido.' });
  }

  // Sync localStorage to database
  async function handleSyncLocalStorage() {
    try {
      const storageKey = 'pickups.v1';
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        toast({ title: 'Nenhum dado', description: 'Não há agendamentos no localStorage para sincronizar.' });
        return;
      }

      const localPickups = JSON.parse(raw) as Pickup[];
      if (localPickups.length === 0) {
        toast({ title: 'Nenhum dado', description: 'Não há agendamentos no localStorage para sincronizar.' });
        return;
      }

      await bulkCreateMutation.mutateAsync(localPickups);
      localStorage.removeItem(storageKey);
      toast({ 
        title: 'Sincronizado', 
        description: `${localPickups.length} agendamentos sincronizados e localStorage limpo.` 
      });
    } catch (e) {
      console.error('Sync error:', e);
      toast({ title: 'Erro', description: 'Falha ao sincronizar dados do localStorage.' });
    }
  }

  // Helpers for range scheduling
  function iterateDatesInclusive(startIso: string, endIso: string) {
    const partsS = startIso.split('-').map(Number);
    const partsE = endIso.split('-').map(Number);
    const s = new Date(partsS[0], (partsS[1]||1)-1, partsS[2]||1);
    const e = new Date(partsE[0], (partsE[1]||1)-1, partsE[2]||1);
    const out: string[] = [];
    for (let cur = new Date(s); cur <= e; cur.setDate(cur.getDate() + 1)) {
      out.push(isoDateLocal(new Date(cur)));
    }
    return out;
  }

  async function handleScheduleRange() {
    // validate
    if (!rangeStart || !rangeEnd) {
      toast({ title: 'Validação', description: 'Preencha data inicial e final' });
      return;
    }
    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      toast({ title: 'Validação', description: 'Intervalo inválido' });
      return;
    }
    const maxDays = 90;
    const days = Math.floor((end.getTime() - start.getTime()) / (1000*60*60*24)) + 1;
    if (days > maxDays) {
      toast({ title: 'Intervalo muito longo', description: `O intervalo não pode exceder ${maxDays} dias.` });
      return;
    }

    const dates = iterateDatesInclusive(rangeStart, rangeEnd);
    const results: { date: string; ok: boolean; reason?: string; id?: string; pickup?: Pickup }[] = [];
    const settings = loadScheduleSettings();
    const now = Date.now();

    for (const d of dates) {
      try {
        // skip past days or outside availability
        if (new Date(d).getTime() < new Date(isoDateLocal(new Date())).getTime()) {
          results.push({ date: d, ok: false, reason: 'Data passada' });
          continue;
        }
        const settings = loadScheduleSettings();
        if (settings.availableFrom && d < settings.availableFrom) { results.push({ date: d, ok: false, reason: 'Fora do período de disponibilidade' }); continue; }
        if (settings.availableTo && d > settings.availableTo) { results.push({ date: d, ok: false, reason: 'Fora do período de disponibilidade' }); continue; }

        const slots = generateTimeSlots();
        let chosen: string | null = null;

        if (rangeTimeOption === 'same' && rangeTime) {
          // check if desired time is valid for this date
          const occupied = pickups.some(p => p.date === d && p.time === rangeTime);
          const [y, m, dd] = (d||'').split('-').map(Number);
          const [hh, mm] = rangeTime.split(':').map(Number);
          const slotDt = new Date(y, (m||1)-1, dd, hh, mm, 0);
          if (!occupied && slotDt.getTime() >= now) chosen = rangeTime;
        }

        if (!chosen) {
          // pick first available slot
          for (const s of slots) {
            const [y, m, dd] = (d||'').split('-').map(Number);
            const [hh, mm] = s.split(':').map(Number);
            const slotDt = new Date(y, (m||1)-1, dd, hh, mm, 0);
            const occupied = pickups.some(p => p.date === d && p.time === s);
            if (!occupied && slotDt.getTime() >= now) { chosen = s; break; }
          }
        }

        if (!chosen) { results.push({ date: d, ok: false, reason: 'Sem slots disponíveis' }); continue; }

        // create pickup
        const p: Pickup = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
          date: d,
          time: chosen,
          clientId: modalClientId || clientId || '0',
          clientName: modalClientName || clientName || 'Cliente',
          status: 'agendado',
          orderId: modalOrderTags.join(',') || modalOrderId || orderId || '',
          userId: user ? (user as any).id : undefined,
          userDisplayName: user ? ((user as any).displayName || (user as any).username || 'Usuário') : 'Anônimo',
          createdAt: new Date().toISOString(),
          scheduledAt: new Date(`${d}T${chosen}:00`).toISOString(),
        };
        results.push({ date: d, ok: true, id: p.id, pickup: p });
      } catch (e:any) {
        results.push({ date: d, ok: false, reason: e?.message || 'erro' });
      }
    }

    // Bulk create all successful pickups
    const successfulPickups = results.filter(r => r.ok && r.pickup).map(r => r.pickup);
    if (successfulPickups.length > 0) {
      await bulkCreateMutation.mutateAsync(successfulPickups as Pickup[]);
    }

    const okCount = results.filter(r=>r.ok).length;
    const failCount = results.length - okCount;
    toast({ title: 'Processo finalizado', description: `${okCount} agendamentos criados, ${failCount} falharam.` });
    setRangeModalOpen(false);
  }

  // Filter and sort pickups
  const filteredAndSortedPickups = React.useMemo(() => {
    let filtered = [...pickups];
    
    // Apply status filter
    if (filterStatus !== 'todos') {
      filtered = filtered.filter(p => (p.status || 'agendado') === filterStatus);
    }
    
    // Apply search filter (searches in clientName, clientId, and orderId)
    if (filterSearch.trim()) {
      const search = filterSearch.toLowerCase();
      filtered = filtered.filter(p => 
        (p.clientName || '').toLowerCase().includes(search) ||
        (p.clientId || '').toLowerCase().includes(search) ||
        (p.orderId || '').toLowerCase().includes(search)
      );
    }
    
    // Sort by date and time
    filtered.sort((a, b) => {
      const dateA = a.scheduledAt || `${a.date}T${a.time || '00:00'}:00`;
      const dateB = b.scheduledAt || `${b.date}T${b.time || '00:00'}:00`;
      const comparison = new Date(dateA).getTime() - new Date(dateB).getTime();
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [pickups, filterStatus, filterSearch, sortOrder]);

  // Group filtered pickups by date
  const grouped = React.useMemo(() => {
    const map: Record<string, Pickup[]> = {};
    for (const p of filteredAndSortedPickups) {
      const k = p.date;
      map[k] = map[k] || [];
      map[k].push(p);
    }
    // dates are already sorted by filteredAndSortedPickups
    return Object.entries(map);
  }, [filteredAndSortedPickups]);

  const monthMatrix = getMonthMatrix(calendarMonth);

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
        <Card className="bg-white/5 dark:bg-white/5 backdrop-blur-sm border border-white/10 dark:border-white/20">
          <CardHeader>
              <div className="w-full flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-lg">Agendamento de Retirada de Pedidos</CardTitle>
                  <div className="text-sm text-muted-foreground mt-1">Selecione uma data e um horário para agendar retiradas.</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded bg-purple-600" />
                      <span className="text-xs text-muted-foreground">Agendado</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded bg-blue-600" />
                      <span className="text-xs text-muted-foreground">OE Gerada</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded bg-lime-600" />
                      <span className="text-xs text-muted-foreground">Separado</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded bg-emerald-600" />
                      <span className="text-xs text-muted-foreground">Entregue</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded bg-red-600" />
                      <span className="text-xs text-muted-foreground">Cancelado</span>
                    </div>
                  </div>
                </div>
              </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
              {/* Calendar column */}
              <div className="col-span-1 h-full flex flex-col">
                <div className="mb-2 lg:hidden">
                  <div className="flex gap-2">
                    <button onClick={() => setShowCalendarOnMobile(true)} className={`py-1 px-2 rounded ${(showCalendarOnMobile === null ? true : showCalendarOnMobile) ? 'bg-primary text-primary-foreground' : 'bg-muted/10'}`}>Calendário</button>
                    <button onClick={() => setShowCalendarOnMobile(false)} className={`py-1 px-2 rounded ${(showCalendarOnMobile === null ? true : !showCalendarOnMobile) ? 'bg-primary text-primary-foreground' : 'bg-muted/10'}`}>Horários</button>
                  </div>
                </div>

                {/** compute small-screen visibility: null -> show both */}
                {(() => {
                  const smallCalendarVisible = showCalendarOnMobile === null ? true : showCalendarOnMobile;
                  return (
                    <div className={`${smallCalendarVisible ? '' : 'hidden'} lg:block h-full flex flex-col`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{calendarMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCalendarMonth(prev => {
                        const d = new Date(prev);
                        return new Date(d.getFullYear(), d.getMonth() - 1, 1);
                      })}>Anterior</Button>
                      <Button variant="outline" size="sm" onClick={() => setCalendarMonth(prev => {
                        const d = new Date(prev);
                        return new Date(d.getFullYear(), d.getMonth() + 1, 1);
                      })}>Próximo</Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-md text-muted-foreground mb-1">
                    {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'].map(d => <div key={d}>{d}</div>)}
                  </div>

                  <div className="grid grid-cols-7 gap-2 flex-1 overflow-auto">
                    {monthMatrix.map(dt => {
                      const isCurrentMonth = dt.getMonth() === calendarMonth.getMonth();
                      const iso = isoDateLocal(dt);
                      const count = pickups.filter(p => p.date === iso).length;
                      const today = new Date();
                      const todayIso = isoDateLocal(today);
                      const isToday = iso === todayIso;
                      const isPastDay = iso < todayIso;
                      // de-emphasize non-working days
                      const settings = loadScheduleSettings();
                      const weekday = dt.getDay();
                      const isWorkingDay = Array.isArray(settings.workingDays) ? settings.workingDays.includes(weekday) : true;
                      const isWithinAvailability = withinAvailability(iso);
                      // determine if this date has any available slots (not occupied and not in the past)
                      const slotsForDay = generateTimeSlots();
                      let hasAvailableSlot = false;
                      try {
                        const now = Date.now();
                        for (const s of slotsForDay) {
                          const [sh, sm] = s.split(':').map(Number);
                          const sd = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), sh, sm, 0);
                          const occupiedSlot = pickups.some(p => p.date === iso && p.time === s);
                          if (!occupiedSlot && sd.getTime() >= now) { hasAvailableSlot = true; break; }
                        }
                      } catch (e) { hasAvailableSlot = false; }

                      // compute classes: selected gets primary bg, today gets border/ring
                      // allow enabling the day if it has at least one available slot even when not a configured working day
                      const baseDisabled = isPastDay || (!isWithinAvailability) || (!isWorkingDay && !hasAvailableSlot);
                      const monthBg = isCurrentMonth ? 'bg-white dark:bg-white/10' : 'bg-muted/30 dark:bg-muted/20 text-muted-foreground';
                      const selectedBg = selectedDate === iso ? 'bg-primary text-primary-foreground' : '';
                      const todayRing = isToday ? 'ring-2 ring-primary' : '';
                      const disabledCls = baseDisabled ? 'bg-muted/30 dark:bg-muted/20 text-muted-foreground cursor-not-allowed' : '';

                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => { if (!baseDisabled) { setSelectedDate(iso); setDate(iso); } }}
                          disabled={baseDisabled}
                          className={`p-1 h-12 text-center rounded border shadow-sm ${selectedBg || monthBg} ${disabledCls} ${todayRing} hover:scale-100`}
                        >
                          <div className="flex flex-col items-center justify-center h-full">
                            <div className="text-sm font-medium">{dt.getDate()}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                    </div>
                  );
                })()}
              </div>

              {/* Time slots + existing bookings */}
              {(() => {
                const smallSlotsVisible = showCalendarOnMobile === null ? true : !showCalendarOnMobile;
                return (
                  <div className={`${smallSlotsVisible ? '' : 'hidden lg:block'} col-span-2 h-full flex flex-col`}>
                    <div className="mb-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">Horários para {selectedDate ? parseIsoToLocal(selectedDate).toLocaleDateString('pt-BR') : (date ? parseIsoToLocal(date).toLocaleDateString('pt-BR') : '— selecione uma data —')}</div>
                        <div className="text-sm text-muted-foreground">Clique em um horário para agendar</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-1.5 border rounded text-sm flex-1 overflow-y-auto p-2 content-start">
                      {generateTimeSlots().filter(slot => {
                        const useDate = selectedDate || date;
                        if (!useDate) return false;
                        
                        let isPast = false;
                        try {
                          const [y, m, d] = (useDate || '').split('-').map(Number);
                          const [hh, mm] = slot.split(':').map(Number);
                          const slotDt = new Date(y, (m||1) - 1, d, hh, mm, 0);
                          const now = new Date();
                          if (slotDt.getTime() < now.getTime()) isPast = true;
                        } catch (e) { isPast = false; }
                        
                        return !isPast;
                      }).map(slot => {
                        const useDate = selectedDate || date;
                        const settings = loadScheduleSettings();
                        const day = useDate ? new Date(useDate).getDay() : null;
                        const isWithinAvailability = useDate ? withinAvailability(useDate) : true;
                        // check if the date has any available slot (allow slot selection even on non-working day)
                        let dateHasAvailable = false;
                        try {
                          if (useDate) {
                            const now = Date.now();
                            const slotsForDay = generateTimeSlots();
                            for (const s of slotsForDay) {
                              const [y, m, d] = (useDate||'').split('-').map(Number);
                              const [hh, mm] = s.split(':').map(Number);
                              const slotDt = new Date(y, (m||1) - 1, d, hh, mm, 0);
                              const occupiedCheck = pickups.some(p => p.date === useDate && p.time === s);
                              if (!occupiedCheck && slotDt.getTime() >= now) { dateHasAvailable = true; break; }
                            }
                          }
                        } catch (e) { dateHasAvailable = false; }

                        const dayAllowed = day === null ? true : (((Array.isArray(settings.workingDays) ? settings.workingDays.includes(day) : true) || dateHasAvailable) && isWithinAvailability);
                        const occupied = pickups.some(p => p.date === useDate && p.time === slot);
                        const booking = pickups.find(p => p.date === useDate && p.time === slot);
                        let isPast = false;
                        if (useDate) {
                          try {
                            const [y, m, d] = (useDate || '').split('-').map(Number);
                            const [hh, mm] = slot.split(':').map(Number);
                            const slotDt = new Date(y, (m||1) - 1, d, hh, mm, 0);
                            const now = new Date();
                            if (slotDt.getTime() < now.getTime()) isPast = true;
                          } catch (e) { isPast = false; }
                        }
                        const disabled = !useDate || !dayAllowed || isPast;

                        const statusColorText = (s?: string) => {
                          switch (s) {
                            case 'confirmado': return 'text-lime-600';
                            case 'entregue': return 'text-emerald-600';
                            case 'cancelado': return 'text-red-600';
                            default: return 'text-purple-600';
                          }
                        };

                        const statusBg = (s?: string) => {
                          switch (s) {
                            case 'confirmado': return 'bg-lime-600';
                            case 'entregue': return 'bg-emerald-600';
                            case 'cancelado': return 'bg-red-600';
                            case 'oe-gerada': return 'bg-blue-600';
                            default: return 'bg-purple-600';
                          }
                        };

                        // determine if the date is within configured availability
                        const slotBtn = (
                          <button 
                            key={slot} 
                            type="button" 
                            disabled={disabled || occupied} 
                            onClick={() => booking ? openEdit(booking) : openModalFor(slot)} 
                            className={`w-full h-14 text-sm rounded-lg border ${
                              occupied
                                ? `${statusBg(booking?.status)} text-white cursor-not-allowed border-transparent` 
                                : 'bg-muted/10 dark:bg-white/5 hover:bg-muted/20 dark:hover:bg-white/10 border-border dark:border-white/10'
                            }`}
                          >
                            <div className="flex flex-col items-center justify-center h-full py-1">
                              <div className="font-medium leading-tight">{slot}</div>
                              {occupied ? (
                                <div className="text-xs leading-tight font-semibold">Agendado</div>
                              ) : (
                                isWithinAvailability && <div className="text-xs text-muted-foreground leading-tight">Disponível</div>
                              )}
                            </div>
                          </button>
                        );

                        if (booking) {
                          return (
                            <Tooltip key={slot}>
                              <TooltipTrigger asChild>
                                {slotBtn}
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-sm font-medium">{booking.clientName} <span className="text-xs text-muted-foreground">(#{booking.clientId})</span></div>
                                <div className="text-xs">Pedido: {booking.orderId}</div>
                                <div className="text-xs">Status: {booking.status || 'agendado'}</div>
                                <div className="text-xs text-muted-foreground">Criado por: {booking.userDisplayName || booking.userId || 'Desconhecido'}</div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        }

                        return slotBtn;
                      })}
                    </div>

                {/* Bookings list moved to separate card below */}
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

        {/* Separate card for existing bookings */}
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 mt-4">
          <Card className="bg-white/5 dark:bg-white/5 backdrop-blur-sm border border-white/10 dark:border-white/20">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <CardTitle>Agendamentos existentes</CardTitle>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                  {/* Search filter */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar cliente, pedido..."
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  
                  {/* Status filter */}
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="agendado">Agendado</SelectItem>
                      <SelectItem value="confirmado">Confirmado</SelectItem>
                      <SelectItem value="entregue">Entregue</SelectItem>
                      <SelectItem value="oe-gerada">OE Gerada</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Sort order */}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    title={sortOrder === 'asc' ? 'Mais antigos primeiro' : 'Mais recentes primeiro'}
                  >
                    {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {grouped.length === 0 ? (<div className="text-sm text-muted-foreground">Nenhum agendamento</div>) : null}
                {grouped.map(([d, items]) => {
                  const daySort = daySortOrder[d] || 'asc';
                  const sortedItems = [...items].sort((a, b) => {
                    const comparison = (a.time || '').localeCompare(b.time || '');
                    return daySort === 'asc' ? comparison : -comparison;
                  });
                  
                  return (
                    <div key={d} className="border rounded p-3 text-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-base">{formatDateWithWeekday(d)}</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleDaySort(d)}
                          className="h-8 px-2"
                          title={daySort === 'asc' ? 'Ordenar por horário: tarde → manhã' : 'Ordenar por horário: manhã → tarde'}
                        >
                          {daySort === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                          <span className="ml-1 text-xs">Horário</span>
                        </Button>
                      </div>
                      <div className="space-y-1">
                        {sortedItems.map(it => {
                          const now = Date.now();
                          let bookingIsExpired = false;
                          try {
                            if (it.scheduledAt) {
                              bookingIsExpired = new Date(it.scheduledAt).getTime() < now;
                            } else if (it.date && it.time) {
                              const [yy, mm, dd] = (it.date||'').split('-').map(Number);
                              const [hh, mi] = (it.time||'00:00').split(':').map(Number);
                              bookingIsExpired = new Date(yy, (mm||1)-1, dd, hh, mi, 0).getTime() < now;
                            }
                          } catch (e) {
                            bookingIsExpired = false;
                          }

                          // Admin can edit expired bookings
                          const isAdmin = user && (user as any).role === 'admin';
                          const canEdit = isAdmin || !bookingIsExpired;

                          return (
                            <div key={it.id} className={`group relative flex items-start justify-between bg-muted dark:bg-white/5 p-3 pl-6 pr-3 rounded text-sm border border-transparent dark:border-white/5 ${bookingIsExpired ? 'opacity-60' : ''}`}>
                              {/* left status indicator */}
                              {(() => {
                                const s = it.status || 'agendado';
                                const cls = s === 'confirmado' ? 'bg-lime-600' : s === 'entregue' ? 'bg-emerald-600' : s === 'cancelado' ? 'bg-red-600' : s === 'oe-gerada' ? 'bg-blue-600' : 'bg-purple-600';
                                return <div className={`absolute left-2 top-3 bottom-3 w-1.5 rounded ${cls}`} />;
                              })()}

                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="text-sm font-medium">{it.clientName} <span className="text-xs text-muted-foreground">(#{it.clientId})</span></div>
                                <div className="text-xs">Pedido(s): { (it.orderId || '').split(',').map(s=>s.trim()).filter(Boolean).join(', ') }</div>
                                <div className="text-xs text-muted-foreground">Criado por: {it.userDisplayName || it.userId || 'Desconhecido'} em {getDate(it.createdAt as any)} às {getTime(it.createdAt as any)}</div>
                              </div>

                              {/* right side - time, status badge below, actions on side */}
                              <div className="flex items-start gap-3">
                                {/* action buttons on the side */}
                                <div className="flex items-center gap-1 mt-1">
                                  <Button variant="ghost" size="icon" onClick={() => openEdit(it)} aria-label="Editar" disabled={!canEdit} className={!canEdit ? 'cursor-not-allowed' : ''}>
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDelete(it.id)} aria-label="Remover" disabled={!canEdit} className={!canEdit ? 'cursor-not-allowed' : ''}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>

                                <div className="flex flex-col items-end gap-1">
                                  {/* time display */}
                                  <div className="text-2xl font-bold text-foreground/80">
                                    {it.time || '-'}
                                  </div>
                                  {/* status badge below time */}
                                  <div className={`px-2 py-1 rounded text-white text-xs whitespace-nowrap ${it.status === 'confirmado' ? 'bg-lime-600' : it.status === 'entregue' ? 'bg-emerald-600' : it.status === 'cancelado' ? 'bg-red-600' : it.status === 'oe-gerada' ? 'bg-blue-600' : 'bg-purple-600'}`}>{it.status === 'oe-gerada' ? 'OE Gerada' : it.status || 'agendado'}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

      {/* Modal to schedule an interval of dates */}
      <Dialog open={rangeModalOpen} onOpenChange={setRangeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar Intervalo</DialogTitle>
            <DialogDescription>Escolha o intervalo de datas e a regra de horário. O sistema respeita dias não úteis se houver slots disponíveis.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Data inicial</Label>
                <Input type="date" value={rangeStart} min={isoDateLocal(new Date())} onChange={(e:any)=>setRangeStart(e.target.value)} />
              </div>
              <div>
                <Label>Data final</Label>
                <Input type="date" value={rangeEnd} min={isoDateLocal(new Date())} onChange={(e:any)=>setRangeEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Regra de horário</Label>
              <div className="flex items-center gap-2 mt-1">
                <label className="flex items-center gap-2"><input type="radio" name="rangeTimeOpt" checked={rangeTimeOption==='first'} onChange={()=>setRangeTimeOption('first')} /> Primeiro disponível</label>
                <label className="flex items-center gap-2"><input type="radio" name="rangeTimeOpt" checked={rangeTimeOption==='same'} onChange={()=>setRangeTimeOption('same')} /> Mesmo horário</label>
              </div>
            </div>
            {rangeTimeOption === 'same' ? (
              <div>
                <Label>Horário desejado</Label>
                <select value={rangeTime} onChange={(e:any)=>setRangeTime(e.target.value)} className="mt-1 block w-48 rounded border p-2">
                  <option value="">— selecione —</option>
                  {generateTimeSlots().map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            ) : null}
            <div className="text-sm text-muted-foreground">Limite máximo de 90 dias por operação. Serão criados apenas agendamentos em slots disponíveis.</div>
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <Button onClick={handleScheduleRange}>Iniciar Agendamento</Button>
              <Button variant="ghost" onClick={()=>setRangeModalOpen(false)}>Fechar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal for entering details when a slot is selected */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar Retirada</DialogTitle>
              <DialogDescription>{formatDateTime(selectedDate || date, time)}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-center">Data</Label>
                  <Input
                    type="date"
                    value={selectedDate || date}
                    min={isoDateLocal(new Date())}
                    onChange={(e:any)=>{
                      const v = e.target.value;
                      setSelectedDate(v);
                      // if current time becomes invalid for new date, clear it
                      if (time) {
                        const occupiedNow = pickups.some(p => p.id !== editingId && p.date === v && p.time === time);
                        const [y, m, d] = (v||'').split('-').map(Number);
                        const [hh, mm] = (time||'00:00').split(':').map(Number);
                        const slotDt = new Date(y, (m||1)-1, d, hh, mm, 0);
                        if (occupiedNow || slotDt.getTime() <= Date.now()) setTime('');
                      }
                    }}
                    className="[color-scheme:dark]"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <Label className="text-center">Horário</Label>
                  <Select value={time} onValueChange={setTime}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="— selecione —" />
                    </SelectTrigger>
                    <SelectContent>
                      {generateTimeSlots().filter(s => {
                        const useDate = selectedDate || date;
                        const occupied = useDate ? pickups.some(p => p.id !== editingId && p.date === useDate && p.time === s) : false;
                        let isPast = false;
                        if (useDate) {
                          try {
                            const [y, m, d] = (useDate||'').split('-').map(Number);
                            const [hh, mm] = s.split(':').map(Number);
                            const slotDt = new Date(y, (m||1)-1, d, hh, mm, 0);
                            if (slotDt.getTime() < Date.now()) isPast = true;
                          } catch (e) { isPast = false; }
                        }
                        return !occupied && !isPast;
                      }).map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-center">Cliente</Label>
                  <Input placeholder="ex. 123" value={modalClientId} onChange={(e:any)=>setModalClientId(e.target.value)} />
                </div>
                <div>
                  <Label className="text-center">Nome do Cliente <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                  <Input placeholder="ex. João Silva (opcional)" value={modalClientName} onChange={(e:any)=>setModalClientName(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-center">Número(s) OE</Label>
                <div className="mt-1 flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    {modalOeTags.map((t, idx) => (
                      <span key={idx} className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                        <span className="font-medium">{t}</span>
                        <button type="button" onClick={() => setModalOeTags(modalOeTags.filter((_,i)=>i!==idx))} className="text-xs text-white/80 hover:text-white">✕</button>
                      </span>
                    ))}
                  </div>
                  <Input
                    className="w-full"
                    placeholder="Digite o número da OE e pressione Enter"
                    value={modalOeInput}
                    onChange={(e:any)=>{
                      const v = e.target.value;
                      if (v.includes(',')) {
                        const parts = v.split(',').map((s:string)=>s.trim()).filter(Boolean);
                        const next = [...modalOeTags];
                        for (const p of parts) if (!next.includes(p)) next.push(p);
                        setModalOeTags(next);
                        setModalOeInput('');
                        return;
                      }
                      setModalOeInput(v);
                    }}
                    onKeyDown={(e:any)=>{
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const v = (modalOeInput||'').trim().replace(/,$/, '');
                        if (!v) return;
                        if (!modalOeTags.includes(v)) setModalOeTags([...modalOeTags, v]);
                        setModalOeInput('');
                      } else if (e.key === ',') {
                        e.preventDefault();
                        const v = (modalOeInput||'').trim();
                        if (!v) return;
                        if (!modalOeTags.includes(v)) setModalOeTags([...modalOeTags, v]);
                        setModalOeInput('');
                      }
                    }}
                    onBlur={() => {
                      const v = (modalOeInput||'').trim().replace(/,$/, '');
                      if (v && !modalOeTags.includes(v)) {
                        setModalOeTags([...modalOeTags, v]);
                        setModalOeInput('');
                      }
                    }}
                  />
                </div>
              </div>
              <div>
                <Label className="text-center">Pedido(s)</Label>
                <div className="mt-1 flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    {modalOrderTags.map((t, idx) => (
                      <span key={idx} className="inline-flex items-center gap-2 rounded-full bg-muted px-2 py-0.5 text-xs">
                        <span className="font-medium">{t}</span>
                        <button type="button" onClick={() => setModalOrderTags(modalOrderTags.filter((_,i)=>i!==idx))} className="text-xs text-muted-foreground">✕</button>
                      </span>
                    ))}
                  </div>
                  <Input
                    className="w-full"
                    placeholder="Digite o número do pedido e pressione Enter"
                    value={modalOrderInput}
                    onChange={(e:any)=>{
                      const v = e.target.value;
                      if (v.includes(',')) {
                        const parts = v.split(',').map((s:string)=>s.trim()).filter(Boolean);
                        const next = [...modalOrderTags];
                        for (const p of parts) if (!next.includes(p)) next.push(p);
                        setModalOrderTags(next);
                        setModalOrderInput('');
                        return;
                      }
                      setModalOrderInput(v);
                    }}
                    onKeyDown={(e:any)=>{
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const v = (modalOrderInput||'').trim().replace(/,$/, '');
                        if (!v) return;
                        if (!modalOrderTags.includes(v)) setModalOrderTags([...modalOrderTags, v]);
                        setModalOrderInput('');
                      } else if (e.key === ',') {
                        e.preventDefault();
                        const v = (modalOrderInput||'').trim();
                        if (!v) return;
                        if (!modalOrderTags.includes(v)) setModalOrderTags([...modalOrderTags, v]);
                        setModalOrderInput('');
                      }
                    }}
                    onBlur={() => {
                      const v = (modalOrderInput||'').trim().replace(/,$/, '');
                      if (v && !modalOrderTags.includes(v)) {
                        setModalOrderTags([...modalOrderTags, v]);
                        setModalOrderInput('');
                      }
                    }}
                  />
                </div>
              </div>
              <div>
                <Label className="text-center">Status</Label>
                <Select value={modalStatus} onValueChange={(v: any) => setModalStatus(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agendado">Agendado</SelectItem>
                    <SelectItem value="oe-gerada">OE Gerada</SelectItem>
                    <SelectItem value="confirmado">Separado</SelectItem>
                    <SelectItem value="entregue">Entregue</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {modalStatus === 'cancelado' && (
                <div>
                  <Label className="text-center">Motivo do Cancelamento <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                  <Textarea 
                    placeholder="Explique o motivo do cancelamento..."
                    value={modalCancelReason}
                    onChange={(e) => setModalCancelReason(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
              )}
            </div>
          <DialogFooter>
            <div className="flex gap-2">
              <Button onClick={handleModalSave}>Salvar</Button>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
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
