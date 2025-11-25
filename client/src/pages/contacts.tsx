import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Users, Phone, Building, Layers, Briefcase } from 'lucide-react';
import { FaRocketchat, FaWhatsapp } from 'react-icons/fa';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useSidebar } from '@/components/ui/sidebar';
import { useToast } from '@/hooks/use-toast';

type SectionKey = 'ramais' | 'departments' | 'companies' | 'setor' | 'cargos';

function storageKey(k: SectionKey) { return `contacts.${k}`; }

function useStoredList<T>(key: SectionKey, defaultValue: T[] = []) {
  const [items, setItems] = React.useState<T[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey(key)); 
      return raw ? JSON.parse(raw) : defaultValue;
    } catch (e) { return defaultValue; }
  });
  React.useEffect(() => {
    try { localStorage.setItem(storageKey(key), JSON.stringify(items)); } catch (e) {}
  }, [items, key]);
  return [items, setItems] as const;
}

export default function ContactsPage() {
  const sections: { key: SectionKey; title: string; icon: any }[] = [
    { key: 'ramais', title: 'Ramais de Telefone', icon: Phone },
    { key: 'departments', title: 'Departamentos', icon: Users },
    { key: 'companies', title: 'Empresas', icon: Building },
    { key: 'setor', title: 'Setor', icon: Layers },
    { key: 'cargos', title: 'Cargos', icon: Briefcase },
  ];

  const [active, setActive] = React.useState<SectionKey>('ramais');

  // hooks for each (use any to allow optional `image` field)
  const [ramais, setRamais] = useStoredList<any>('ramais', []);
  const [departments, setDepartments] = useStoredList<any>('departments', []);
  const [companies, setCompanies] = useStoredList<any>('companies', []);
  const [setor, setSetor] = useStoredList<any>('setor', []);
  const [cargos, setCargos] = useStoredList<any>('cargos', []);

  // Always try to load persisted contacts from the server on mount
  // This ensures the page shows the DB contents even if localStorage keys exist.
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/contacts');
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data) return;
        if (Array.isArray(data.ramais)) setRamais(data.ramais);
        if (Array.isArray(data.departments)) setDepartments(data.departments);
        if (Array.isArray(data.companies)) setCompanies(data.companies);
        if (Array.isArray(data.setor)) setSetor(data.setor);
        if (Array.isArray(data.cargos)) setCargos(data.cargos);
      } catch (e) {
        // ignore network errors; keep any local state
      }
    })();

    // Also try to load normalized lookup tables if available
    (async () => {
      try {
        const [depR, setR, compR] = await Promise.all([
          fetch('/api/departments'),
          fetch('/api/setores'),
          fetch('/api/companies'),
        ]);
        if (depR.ok) {
          const deps = await depR.json().catch(() => []);
          if (Array.isArray(deps) && deps.length > 0) setDepartments(deps.map((d:any) => ({ name: d.name, id: d.id })));
        }
        if (setR.ok) {
          const sets = await setR.json().catch(() => []);
          if (Array.isArray(sets) && sets.length > 0) setSetor(sets.map((s:any) => ({ name: s.name, id: s.id })));
        }
        if (compR.ok) {
          const comps = await compR.json().catch(() => []);
          if (Array.isArray(comps) && comps.length > 0) setCompanies(comps.map((c:any) => ({ name: c.name, id: c.id })));
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // Pagination removed: render full lists

  // detect global sidebar state to adjust grid columns
  const { isMobile, open: sidebarOpen } = useSidebar();
  const hasSidebar = !isMobile && !!sidebarOpen;

  const { user } = useAuth();
  React.useEffect(() => {
    if (!user) setActive('ramais');
  }, [user]);
  const { toast } = useToast();
  const DEFAULT_COUNTRY = '+55';
  const csvInputRef = React.useRef<HTMLInputElement | null>(null);

  // Format and dial phone numbers. If number looks local (8-11 digits), prepend default country code '+55'.
  function sanitizeNumber(n: any) {
    if (!n) return '';
    return String(n).replace(/\D/g, '');
  }

  function formatDialNumber(raw: any) {
    const digits = sanitizeNumber(raw);
    if (!digits) return '';
    // If already starts with country code (leading 2-3 digits and total >11) or starts with '00' or '+', prefer as is
    // Simple heuristic: if digits length > 11 assume includes country code
    if (digits.startsWith('+')) return digits;
    if (digits.startsWith('00')) return `+${digits.slice(2)}`;
    if (digits.length > 11) return `+${digits}`;
    if (digits.length >= 11 && digits.startsWith('55')) return `+${digits}`;
    // Otherwise prepend default country code from Vite env
    const code = DEFAULT_COUNTRY || '+55';
    const cleanedCode = String(code).replace(/\D/g, '');
    return `+${cleanedCode}${digits}`;
  }

  // helper to extract the ramal (extension) — last up to 6 digits
  function getRamal(raw: any) {
    const digits = sanitizeNumber(raw);
    if (!digits) return '';
    // return last 4 digits if available, otherwise last up to 6
    if (digits.length >= 4) return digits.slice(-4);
    return digits;
  }

  function formatDisplayNumber(raw: any) {
    if (!raw) return '';
    const digits = String(raw).replace(/\D/g,'');
    if (digits.length === 0) return '';
    // if includes country code 55 at start, remove for display
    const maybe = digits.startsWith('55') ? digits.slice(2) : digits;
    if (maybe.length <= 4) return maybe;
    if (maybe.length <= 7) {
      // prefix + ramal
      const pref = maybe.slice(0, maybe.length - 4);
      const ram = maybe.slice(-4);
      return `${pref} - ${ram}`;
    }
    if (maybe.length >= 8) {
      const ddd = maybe.slice(0,2);
      const rest = maybe.slice(2);
      if (rest.length <= 4) return `(${ddd}) ${rest}`;
      const pref = rest.slice(0, rest.length - 4);
      const ram = rest.slice(-4);
      return `(${ddd}) ${pref} - ${ram}`;
    }
    return raw;
  }

  // Request a call: dial only the ramal (extension) portion
  function onRequestCall(raw: any) {
    try {
      const ramal = getRamal(raw);
      if (!ramal) return;
      // strip leading zero from ramal (e.g. 0610 -> 610)
      const cleaned = String(ramal).replace(/^0+/, '');
      const final = cleaned.length > 0 ? cleaned : ramal;
      // use tel: with only the extension as requested
      window.location.href = `tel:${final}`;
    } catch (e) {
      console.error('onRequestCall error', e);
    }
  }

  // No pagination; nothing to reset on section change

  // Contacts sync endpoint removed; persistence happens explicitly via other flows.

  // form state
  const [name, setName] = React.useState('');
  const [number, setNumber] = React.useState('');
  const [selectedDepartment, setSelectedDepartment] = React.useState<string>('');
  const [selectedSetor, setSelectedSetor] = React.useState<string>('');
  const [selectedCompany, setSelectedCompany] = React.useState<string>('');
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  // filters
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterCompany, setFilterCompany] = React.useState('');
  const [filterDepartment, setFilterDepartment] = React.useState('');
  const [filterSetor, setFilterSetor] = React.useState('');

  // modal phone: single formatted phone field (e.g. (00) 0000-0000)
  const [modalPhone, setModalPhone] = React.useState('');

  // modal state for create/edit with image
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalName, setModalName] = React.useState('');
  const [modalDepartment, setModalDepartment] = React.useState('');
  const [modalSetor, setModalSetor] = React.useState('');
  const [modalRocketUser, setModalRocketUser] = React.useState('');
  const [modalWhatsapp, setModalWhatsapp] = React.useState('');
  const [modalEmail, setModalEmail] = React.useState('');
  const [modalImage, setModalImage] = React.useState<string | null>(null);
  const [modalEditingIndex, setModalEditingIndex] = React.useState<number | null>(null);
  const [modalCompany, setModalCompany] = React.useState('');
  const [modalEmailError, setModalEmailError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  React.useEffect(()=>{
    if (!isModalOpen) {
      setModalName(''); setModalPhone(''); setModalDepartment(''); setModalSetor(''); setModalRocketUser(''); setModalWhatsapp(''); setModalEmail(''); setModalImage(null); setModalEditingIndex(null); setModalCompany('');
    }
  }, [isModalOpen]);

  

  function openNewModal() {
    if (!user) { window.location.href = '/login'; return; }
    setModalEditingIndex(null);
    setModalName(''); setModalPhone(''); setModalDepartment(''); setModalSetor(''); setModalRocketUser(''); setModalWhatsapp(''); setModalEmail(''); setModalImage(null); setModalCompany('');
    setIsModalOpen(true);
  }

  function openCsvPicker() {
    if (!user) { window.location.href = '/login'; return; }
    csvInputRef.current?.click();
  }

  function splitSemicolonRow(line: string) {
    const res: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ';' && !inQuotes) {
        res.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    res.push(cur);
    return res.map(s => s.trim());
  }

  function formatPhoneForInput(raw: any) {
    const digits = sanitizeNumber(raw);
    if (!digits) return '';
    // Expecting 10 digits: 2 (DDD) + 8
    const d = digits.slice(0,2);
    const rest = digits.slice(2);
    if (rest.length <= 4) return `(${d}) ${rest}`;
    const part1 = rest.slice(0, rest.length - 4);
    const part2 = rest.slice(-4);
    return `(${d}) ${part1}-${part2}`;
  }

  function formatPhoneInputValue(value: string) {
    const digits = (value || '').replace(/\D/g, '').slice(0,10);
    if (digits.length === 0) return '';
    if (digits.length <= 2) return `(${digits}`;
    const d = digits.slice(0,2);
    const rest = digits.slice(2);
    if (rest.length <= 4) return `(${d}) ${rest}`;
    const part1 = rest.slice(0, rest.length - 4);
    const part2 = rest.slice(-4);
    return `(${d}) ${part1}-${part2}`;
  }

  async function handleCsvFile(file?: File) {
    if (!file) return;
    try {
      const txt = await file.text();
      // send to server for preview/validation
      const resp = await fetch('/api/contacts/preview', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: txt }),
      });
      if (!resp.ok) {
        const txtErr = await resp.text().catch(()=>'');
        toast({ title: 'CSV', description: `Falha na validação: ${txtErr || resp.statusText}` });
        return;
      }
      const json = await resp.json().catch(() => null);
      if (!json) { toast({ title: 'CSV', description: 'Resposta inválida do servidor.' }); return; }
      const rows = json.rows || [];
      const validRows = rows.filter((r:any)=>r.ok);
      const invalidCount = (json.summary && json.summary.invalid) || rows.filter((r:any)=>!r.ok).length;
      if (validRows.length === 0) {
        toast({ title: 'CSV', description: `Nenhum contato válido encontrado. Linhas inválidas: ${invalidCount}` });
        return;
      }
      const newItems = validRows.map((r:any) => ({ name: r.name || '', number: (r.number||'').replace(/\s+/g,''), email: r.email || undefined }));
      // Persist to server (authenticated). The server will insert rows without deleting existing.
      try {
        const importResp = await fetch('/api/contacts/import', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'ramais', rows: newItems }),
        });
        if (!importResp.ok) {
          const txtErr = await importResp.text().catch(()=>'');
          toast({ title: 'CSV', description: `Falha ao persistir no servidor: ${txtErr || importResp.statusText}` });
        } else {
          const jsonImp = await importResp.json().catch(() => null);
          const inserted = (jsonImp && jsonImp.inserted) || newItems.length;
          toast({ title: 'Importado', description: `Importados ${inserted} contatos no servidor. Linhas inválidas: ${invalidCount}` });
          // refresh server-side list
          try {
            const res2 = await fetch('/api/contacts');
            if (res2.ok) {
              const data = await res2.json().catch(() => null);
              if (data && Array.isArray(data.ramais)) setRamais(data.ramais);
            }
          } catch (e) {}
        }
      } catch (e:any) {
        console.error('CSV import persist error', e);
        toast({ title: 'CSV', description: 'Import validado mas falha ao persistir no servidor.' });
      }
    } catch (e:any) {
      console.error('CSV import error', e);
      toast({ title: 'Erro', description: 'Falha ao ler o arquivo CSV.' });
    }
  }

  function openEditModal(idx:number) {
    if (!user) { window.location.href = '/login'; return; }
    setModalEditingIndex(idx);
    if (active === 'ramais') {
      const it = ramais[idx];
      setModalName(it.name || ''); setModalDepartment(it.department || ''); setModalSetor(it.setor || ''); setModalImage(it.image || null);
      // try to parse existing numeric number into ddd/prefix/ramal
      // format existing number into single phone input
      try {
        setModalPhone(formatPhoneForInput(it.number || ''));
      } catch (e) {}
      setModalRocketUser(it.rocketUser || '');
      setModalWhatsapp(it.whatsapp || it.whatsApp || '');
      setModalEmail(it.email || '');
      setModalCompany(it.company || '');
    } else {
      const list = active === 'departments' ? departments : active === 'companies' ? companies : active === 'setor' ? setor : cargos;
      const it = list[idx];
      setModalName(it.name || ''); setModalImage(it.image || null);
    }
    setIsModalOpen(true);
  }

  function handleModalImage(file?: File) {
    if (!file) { setModalImage(null); return; }
    const reader = new FileReader();
    reader.onload = () => setModalImage(reader.result as string);
    reader.readAsDataURL(file);
  }
  function validateEmail(value: string) {
    const v = (value || '').trim();
    if (!v) return true;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(v);
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleModalImage(f); };
  function openFilePicker() { fileInputRef.current?.click(); }

  async function saveModal() {
    // If there's an embedded data URL image and we're authenticated, upload it first
    async function uploadDataUrlIfNeeded(): Promise<string | undefined> {
      try {
        if (!modalImage || typeof modalImage !== 'string') return undefined;
        if (!modalImage.startsWith('data:')) return undefined;
        if (!user) return undefined;
        // convert data URL to blob
        const matches = modalImage.match(/^data:(image\/[^;]+);base64,(.*)$/);
        if (!matches) return undefined;
        const mime = matches[1];
        const b64 = matches[2];
        const byteChars = atob(b64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mime });
        const file = new File([blob], `upload-${Date.now()}.png`, { type: mime });
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/uploads', { method: 'POST', credentials: 'include', body: fd });
        if (!res.ok) {
          console.error('Upload failed', await res.text().catch(()=>''));
          return undefined;
        }
        const json = await res.json().catch(()=>({}));
        return json?.url || undefined;
      } catch (e) {
        console.error('uploadDataUrlIfNeeded error', e);
        return undefined;
      }
    }

    if (active === 'ramais') {
    // require name, phone and company only; department is optional on edit
    const phoneDigits = sanitizeNumber(modalPhone || '');
    if (!modalName || !phoneDigits || !modalCompany) return;
      // validate email if present
      if (modalEmail && !validateEmail(modalEmail)) {
        setModalEmailError('Email inválido');
        return;
      }
      setModalEmailError(null);
      // if modalImage is a data URL, try to upload it and replace with returned URL
      let imageToUse: string | undefined = modalImage || undefined;
      if (modalImage && typeof modalImage === 'string' && modalImage.startsWith('data:') && user) {
        const uploadedUrl = await uploadDataUrlIfNeeded();
        if (uploadedUrl) imageToUse = uploadedUrl;
      }
      // assemble number from single formatted phone input (store digits only)
      const assembledNumber = (() => {
        const digits = sanitizeNumber(modalPhone || '');
        return digits || '';
      })();

      const item = { name: modalName, number: assembledNumber, department: modalDepartment || undefined, setor: modalSetor || undefined, company: modalCompany || undefined, email: modalEmail || undefined, image: imageToUse || undefined, rocketUser: modalRocketUser || undefined, whatsapp: modalWhatsapp || undefined };

      if (modalEditingIndex !== null) {
        const existing = ramais[modalEditingIndex] as any;
        // If contact is stored in DB (has id) and user is authenticated, update via API
        if (user && existing && existing.id) {
          try {
            const res = await fetch(`/api/contacts/${existing.id}`, {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item),
            });
            if (!res.ok) {
              const json = await res.json().catch(() => ({ error: 'Erro' }));
              setModalEmailError(json?.error || 'Falha ao atualizar contato');
              return;
            }
            const json = await res.json().catch(() => ({}));
            const updated = json?.contact || null;
            const newRamais = ramais.map((r: any, i: number) => i === modalEditingIndex ? (updated || { ...existing, ...item }) : r);
            setRamais(newRamais);
            toast({ title: 'Salvo', description: 'Contato atualizado.' });
            // refresh server-side list to ensure consistency
            try {
              const res2 = await fetch('/api/contacts');
              if (res2.ok) {
                const data = await res2.json().catch(() => null);
                if (data && Array.isArray(data.ramais)) setRamais(data.ramais);
              }
            } catch (e) {}
          } catch (e) {
            setModalEmailError('Falha na requisição');
            return;
          }
        } else {
          // Local edit (not a DB-backed row)
          const newRamais = ramais.map((r: any, i: number) => i === modalEditingIndex ? item : r);
          setRamais(newRamais);
          toast({ title: 'Salvo', description: 'Contato atualizado.' });
        }
      } else {
        if (user) {
          try {
            const res = await fetch('/api/contacts', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ kind: 'ramais', ...item }),
            });
            if (!res.ok) {
              const txtErr = await res.text().catch(()=>'');
              toast({ title: 'Erro', description: `Falha ao criar no servidor: ${txtErr || res.statusText}` });
            } else {
              const json = await res.json().catch(() => null);
              const created = json?.contact || null;
              if (created) {
                // refresh from server
                try {
                  const res2 = await fetch('/api/contacts');
                  if (res2.ok) {
                    const data = await res2.json().catch(() => null);
                    if (data && Array.isArray(data.ramais)) setRamais(data.ramais);
                  }
                } catch (e) {}
                toast({ title: 'Criado', description: 'Ramal criado com sucesso.' });
              }
            }
          } catch (e) {
            console.error('Create contact error', e);
            toast({ title: 'Erro', description: 'Falha ao criar contato no servidor.' });
          }
        } else {
          const newRamais = [...ramais, item];
          setRamais(newRamais);
          toast({ title: 'Criado', description: 'Ramal criado com sucesso.' });
        }
      }
    } else if (active === 'departments') {
      if (!modalName) return;
      if (modalEditingIndex !== null) setDepartments(departments.map((d:any,i:number)=> i===modalEditingIndex ? { name: modalName, image: modalImage || undefined } : d));
      else setDepartments([...departments, { name: modalName, image: modalImage || undefined }]);
    } else if (active === 'companies') {
      if (!modalName) return;
      if (modalEditingIndex !== null) setCompanies(companies.map((c:any,i:number)=> i===modalEditingIndex ? { name: modalName, image: modalImage || undefined } : c));
      else setCompanies([...companies, { name: modalName, image: modalImage || undefined }]);
    } else if (active === 'setor') {
      if (!modalName) return;
      if (modalEditingIndex !== null) setSetor(setor.map((s:any,i:number)=> i===modalEditingIndex ? { name: modalName, image: modalImage || undefined } : s));
      else setSetor([...setor, { name: modalName, image: modalImage || undefined }]);
    } else if (active === 'cargos') {
      if (!modalName) return;
      if (modalEditingIndex !== null) setCargos(cargos.map((c:any,i:number)=> i===modalEditingIndex ? { name: modalName, image: modalImage || undefined } : c));
      else setCargos([...cargos, { name: modalName, image: modalImage || undefined }]);
    }
    setIsModalOpen(false);
  }

  const modalCanSave = React.useMemo(() => {
    // Allow saving a ramal if either required fields are present OR an image is attached.
    if (active === 'ramais') {
      const digits = (modalPhone || '').replace(/\D/g,'').length;
      const hasNumberParts = digits === 10; // (DD) + 8 digits format
      return !!(modalImage || (modalName && hasNumberParts && modalCompany));
    }
    return !!modalName;
  }, [active, modalName, modalDepartment, modalCompany, modalImage, modalPhone]);

  React.useEffect(() => {
    setName(''); setNumber(''); setSelectedDepartment(''); setSelectedSetor(''); setSelectedCompany(''); setEditingIndex(null); 
    setSearchQuery(''); setFilterCompany(''); setFilterDepartment(''); setFilterSetor('');
  }, [active]);

  function addItem() {
    if (active === 'ramais') {
      if (!name || !number || !selectedCompany) return;
      const item = { name, number, department: selectedDepartment || undefined, setor: selectedSetor || undefined, company: selectedCompany || undefined };
      if (editingIndex !== null) {
        setRamais(ramais.map((r, i) => i === editingIndex ? item : r));
        setEditingIndex(null);
      } else {
        setRamais([...ramais, item]);
      }
    } else if (active === 'departments') {
      if (!name) return;
      const item = { name } as any;
      if (editingIndex !== null) {
        const existing = departments[editingIndex] as any;
        if (user && existing && existing.id) {
          (async () => {
            try {
              const res = await fetch(`/api/contacts/${existing.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
              if (res.ok) {
                const json = await res.json().catch(() => null);
                if (json && json.contact) {
                  setDepartments(departments.map((d:any,i:number)=> i===editingIndex ? json.contact : d));
                } else {
                  setDepartments(departments.map((d:any,i:number)=> i===editingIndex ? item : d));
                }
              } else {
                setDepartments(departments.map((d:any,i:number)=> i===editingIndex ? item : d));
              }
            } catch (e) {
              setDepartments(departments.map((d:any,i:number)=> i===editingIndex ? item : d));
            }
          })();
        } else {
          setDepartments(departments.map((d:any,i:number)=> i===editingIndex ? { name } : d));
        }
        setEditingIndex(null);
      } else {
        if (user) {
          (async () => {
            try {
              const res = await fetch('/api/contacts', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'departments', name: item.name }) });
              if (!res.ok) throw new Error('Failed');
              const json = await res.json().catch(() => null);
              if (json && json.contact) setDepartments([...departments, json.contact]);
              else setDepartments([...departments, item]);
            } catch (e) {
              setDepartments([...departments, item]);
            }
          })();
        } else {
          setDepartments([...departments, { name }]);
        }
      }
    } else if (active === 'companies') {
      if (!name) return;
      const item = { name } as any;
      if (editingIndex !== null) {
        const existing = companies[editingIndex] as any;
        if (user && existing && existing.id) {
          (async () => {
            try {
              const res = await fetch(`/api/contacts/${existing.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
              if (res.ok) {
                const json = await res.json().catch(() => null);
                if (json && json.contact) setCompanies(companies.map((c:any,i:number)=> i===editingIndex ? json.contact : c));
                else setCompanies(companies.map((c:any,i:number)=> i===editingIndex ? item : c));
              } else setCompanies(companies.map((c:any,i:number)=> i===editingIndex ? item : c));
            } catch (e) { setCompanies(companies.map((c:any,i:number)=> i===editingIndex ? item : c)); }
          })();
        } else {
          setCompanies(companies.map((c:any,i:number)=> i===editingIndex ? { name } : c));
        }
        setEditingIndex(null);
      } else {
        if (user) {
          (async () => {
            try {
              const res = await fetch('/api/contacts', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'companies', name: item.name }) });
              if (!res.ok) throw new Error('Failed');
              const json = await res.json().catch(() => null);
              if (json && json.contact) setCompanies([...companies, json.contact]); else setCompanies([...companies, item]);
            } catch (e) { setCompanies([...companies, item]); }
          })();
        } else {
          setCompanies([...companies, { name }]);
        }
      }
    } else if (active === 'setor') {
      if (!name) return;
      const item = { name } as any;
      if (editingIndex !== null) {
        const existing = setor[editingIndex] as any;
        if (user && existing && existing.id) {
          (async () => {
            try {
              const res = await fetch(`/api/contacts/${existing.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
              if (res.ok) {
                const json = await res.json().catch(() => null);
                if (json && json.contact) setSetor(setor.map((s:any,i:number)=> i===editingIndex ? json.contact : s)); else setSetor(setor.map((s:any,i:number)=> i===editingIndex ? item : s));
              } else setSetor(setor.map((s:any,i:number)=> i===editingIndex ? item : s));
            } catch (e) { setSetor(setor.map((s:any,i:number)=> i===editingIndex ? item : s)); }
          })();
        } else {
          setSetor(setor.map((s:any,i:number)=> i===editingIndex ? { name } : s));
        }
        setEditingIndex(null);
      } else {
        if (user) {
          (async () => {
            try {
              const res = await fetch('/api/contacts', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'setor', name: item.name }) });
              if (!res.ok) throw new Error('Failed');
              const json = await res.json().catch(() => null);
              if (json && json.contact) setSetor([...setor, json.contact]); else setSetor([...setor, item]);
            } catch (e) { setSetor([...setor, item]); }
          })();
        } else {
          setSetor([...setor, { name }]);
        }
      }
    } else if (active === 'cargos') {
      if (!name) return;
      const item = { name } as any;
      if (editingIndex !== null) {
        const existing = cargos[editingIndex] as any;
        if (user && existing && existing.id) {
          (async () => {
            try {
              const res = await fetch(`/api/contacts/${existing.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
              if (res.ok) {
                const json = await res.json().catch(() => null);
                if (json && json.contact) setCargos(cargos.map((c:any,i:number)=> i===editingIndex ? json.contact : c)); else setCargos(cargos.map((c:any,i:number)=> i===editingIndex ? item : c));
              } else setCargos(cargos.map((c:any,i:number)=> i===editingIndex ? item : c));
            } catch (e) { setCargos(cargos.map((c:any,i:number)=> i===editingIndex ? item : c)); }
          })();
        } else {
          setCargos(cargos.map((c:any,i:number)=> i===editingIndex ? { name } : c));
        }
        setEditingIndex(null);
      } else {
        if (user) {
          (async () => {
            try {
              const res = await fetch('/api/contacts', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'cargos', name: item.name }) });
              if (!res.ok) throw new Error('Failed');
              const json = await res.json().catch(() => null);
              if (json && json.contact) setCargos([...cargos, json.contact]); else setCargos([...cargos, item]);
            } catch (e) { setCargos([...cargos, item]); }
          })();
        } else {
          setCargos([...cargos, { name }]);
        }
      }
    }
    setName(''); setNumber('');
  }

  async function removeItem(idx: number) {
    if (!user) {
      // when unauthenticated, allow local removals only
      if (active === 'ramais') {
        const it = ramais[idx];
        if (it && it.id) {
          // cannot delete remote without auth
        }
        setRamais(ramais.filter((_, i) => i !== idx));
        return;
      }
      if (active === 'departments') setDepartments(departments.filter((_, i) => i !== idx));
      if (active === 'companies') setCompanies(companies.filter((_, i) => i !== idx));
      if (active === 'setor') setSetor(setor.filter((_, i) => i !== idx));
      if (active === 'cargos') setCargos(cargos.filter((_, i) => i !== idx));
      return;
    }
    if (active === 'ramais') {
      const it = ramais[idx];
      if (it && it.id) {
        try {
          const res = await fetch(`/api/contacts/${it.id}`, { method: 'DELETE', credentials: 'include' });
          if (res.ok) {
            // refresh from server
            try {
              const r = await fetch('/api/contacts');
              if (r.ok) {
                const data = await r.json().catch(() => null);
                if (data && Array.isArray(data.ramais)) setRamais(data.ramais);
              }
            } catch (e) {}
          } else {
            // fallback to local removal
            setRamais(ramais.filter((_, i) => i !== idx));
          }
        } catch (e) {
          setRamais(ramais.filter((_, i) => i !== idx));
        }
      } else {
        setRamais(ramais.filter((_, i) => i !== idx));
      }
      return;
    }
    // handle other kinds: if item is DB-backed (has id) delete via API, otherwise local
    if (active === 'departments') {
      const it = departments[idx] as any;
      if (it && it.id) {
        try {
          const res = await fetch(`/api/contacts/${it.id}`, { method: 'DELETE', credentials: 'include' });
          if (res.ok) {
            const r = await fetch('/api/contacts');
            if (r.ok) {
              const data = await r.json().catch(() => null);
              if (data && Array.isArray(data.departments)) setDepartments(data.departments);
            }
          } else setDepartments(departments.filter((_, i) => i !== idx));
        } catch (e) { setDepartments(departments.filter((_, i) => i !== idx)); }
      } else setDepartments(departments.filter((_, i) => i !== idx));
    }
    if (active === 'companies') {
      const it = companies[idx] as any;
      if (it && it.id) {
        try {
          const res = await fetch(`/api/contacts/${it.id}`, { method: 'DELETE', credentials: 'include' });
          if (res.ok) {
            const r = await fetch('/api/contacts');
            if (r.ok) {
              const data = await r.json().catch(() => null);
              if (data && Array.isArray(data.companies)) setCompanies(data.companies);
            }
          } else setCompanies(companies.filter((_, i) => i !== idx));
        } catch (e) { setCompanies(companies.filter((_, i) => i !== idx)); }
      } else setCompanies(companies.filter((_, i) => i !== idx));
    }
    if (active === 'setor') {
      const it = setor[idx] as any;
      if (it && it.id) {
        try {
          const res = await fetch(`/api/contacts/${it.id}`, { method: 'DELETE', credentials: 'include' });
          if (res.ok) {
            const r = await fetch('/api/contacts');
            if (r.ok) {
              const data = await r.json().catch(() => null);
              if (data && Array.isArray(data.setor)) setSetor(data.setor);
            }
          } else setSetor(setor.filter((_, i) => i !== idx));
        } catch (e) { setSetor(setor.filter((_, i) => i !== idx)); }
      } else setSetor(setor.filter((_, i) => i !== idx));
    }
    if (active === 'cargos') {
      const it = cargos[idx] as any;
      if (it && it.id) {
        try {
          const res = await fetch(`/api/contacts/${it.id}`, { method: 'DELETE', credentials: 'include' });
          if (res.ok) {
            const r = await fetch('/api/contacts');
            if (r.ok) {
              const data = await r.json().catch(() => null);
              if (data && Array.isArray(data.cargos)) setCargos(data.cargos);
            }
          } else setCargos(cargos.filter((_, i) => i !== idx));
        } catch (e) { setCargos(cargos.filter((_, i) => i !== idx)); }
      } else setCargos(cargos.filter((_, i) => i !== idx));
    }
  }

  function editItem(idx: number) {
    if (active === 'ramais') {
      const it = ramais[idx];
      setName(it.name);
      setNumber(it.number);
      setSelectedDepartment(it.department || '');
      setSelectedSetor(it.setor || '');
      setSelectedCompany(it.company || '');
      setEditingIndex(idx);
      return;
    }
    const list = active === 'departments' ? departments : active === 'companies' ? companies : active === 'setor' ? setor : cargos;
    const it = list[idx];
    setName(it.name);
    setEditingIndex(idx);
  }

  function renderList() {
    if (active === 'ramais') {
      return (
      <>
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${hasSidebar ? 'md:grid-cols-2 lg:grid-cols-2' : 'md:grid-cols-3 lg:grid-cols-3'} gap-3`}>
          {ramais
            .filter((r:any) => {
              // search filter
              const q = (searchQuery || '').trim().toLowerCase();
              if (q) {
                const hay = `${r.name || ''} ${r.number || ''} ${r.email || ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
              }
              if (filterCompany && r.company !== filterCompany) return false;
              if (filterDepartment && r.department !== filterDepartment) return false;
              if (filterSetor && r.setor !== filterSetor) return false;
              return true;
            })
            .map((r, i) => (
            <Card key={r?.id ?? i} className="p-3 group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3 items-stretch">
                  <Avatar className="h-full w-20">
                    {r.image ? <AvatarImage src={r.image} alt={r.name} /> : <AvatarFallback>{r.name ? r.name[0] : '?'}</AvatarFallback>}
                  </Avatar>
                  <div>
                      <div className="font-medium text-lg">{r.name}</div>
                      <div className="text-sm text-muted-foreground">Ramal: {formatDisplayNumber(r.number)}</div>
                      <div className="text-sm text-muted-foreground">Departamento: {r.department || '-'}</div>
                      <div className="text-sm text-muted-foreground">Email: {r.email || '-'}</div>
                    {r.setor && <div className="text-sm text-muted-foreground">Setor: {r.setor}</div>}
                    {r.rocketUser && (
                      <div className="mt-1 inline-block">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a className="inline-flex items-center" href={`rocketchat://open?host=${encodeURIComponent('http://192.168.3.79:8065')}&path=direct/${encodeURIComponent(r.rocketUser)}`}>
                              <FaRocketchat className="h-6 w-6 text-rose-600" />
                            </a>
                          </TooltipTrigger>
                                <TooltipContent>
                                  <div>falar com <b>{r.name}</b> no <b>RocketChat</b></div>
                                </TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                    {/* Phone deeplink */}
                    {r.number && (
                      <div className="mt-1 inline-block ml-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                                    <button type="button" className="inline-flex items-center text-sky-600" onClick={() => onRequestCall(r.number)} aria-label={`Ligar para ${r.name || r.number}`}>
                              <Phone className="h-6 w-6" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div>Ligar para <b>{r.name || r.number}</b></div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                    {r.whatsapp && (
                      <div className="mt-1 inline-block ml-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a className="inline-flex items-center text-emerald-600" target="_blank" rel="noreferrer" href={`https://wa.me/${(r.whatsapp || '').replace(/\D/g,'')}`}>
                              <FaWhatsapp className="h-6 w-6" />
                            </a>
                          </TooltipTrigger>
                                <TooltipContent>
                                  <div>falar com <b>{r.name}</b> no <b>WhatsApp</b></div>
                                </TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {user ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => openEditModal(i)}>Editar</Button>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(i)} aria-label="Remover ramal">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
      </div>
      </>
      );
    }
    const list = active === 'departments' ? departments : active === 'companies' ? companies : active === 'setor' ? setor : cargos;
    const filteredList = list.filter((it:any) => {
      const q = (searchQuery || '').trim().toLowerCase();
      if (!q) return true;
      return (it.name || '').toLowerCase().includes(q);
    });
    return (
      <>
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${hasSidebar ? 'md:grid-cols-2 lg:grid-cols-2' : 'md:grid-cols-3 lg:grid-cols-3'} gap-3`}>
        {filteredList.map((it:any, i:number) => (
          <Card key={it?.id ?? i} className="p-3 flex items-center justify-between">
            <div className="font-medium truncate">{it.name}</div>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => openEditModal(i)}>Editar</Button>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(i)} aria-label="Remover">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
      </>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-background py-6">
      <div className="max-w-6xl mx-auto px-2 sm:px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Contatos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                {user ? (
                  <div className="flex gap-2 flex-wrap">
                    {sections.map(s => (
                      <button
                        key={s.key}
                        onClick={() => setActive(s.key)}
                        className={`px-3 py-2 rounded-md text-sm flex items-center gap-2 ${active===s.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                      >
                        <s.icon className="h-4 w-4" />
                        <span>{s.title}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                  <div>
                  {user ? (
                    <div className="flex items-center gap-2">
                      <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e:any)=> handleCsvFile(e.target.files?.[0])} />
                      <Button variant="outline" size="sm" onClick={openCsvPicker}>Importar CSV</Button>
                      <Button onClick={openNewModal} className="ml-2">
                        <Plus className="h-4 w-4 mr-2" /> Novo
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" onClick={() => window.location.href = '/login'} className="ml-2">Entrar</Button>
                  )}
                </div>
              </div>

              <div className="mb-2">
                <div className="text-sm text-muted-foreground">Seção: <strong>{sections.find(s=>s.key===active)?.title}</strong> — use os cartões abaixo para editar ou remover.</div>
              </div>

              {/* Filters */}
              <div className="flex flex-col md:flex-row md:items-center md:gap-3 gap-2">
                <Input placeholder="Pesquisar por nome, número ou email" value={searchQuery} onChange={(e:any)=>setSearchQuery(e.target.value)} />
                {active === 'ramais' && (
                  <>
                    <select className="rounded border p-2 bg-transparent" value={filterCompany} onChange={(e:any)=>setFilterCompany(e.target.value)}>
                      <option value="">Todas as empresas</option>
                      {companies.map((c:any,i:number)=> <option key={i} value={c.name}>{c.name}</option>)}
                    </select>
                    <select className="rounded border p-2 bg-transparent" value={filterDepartment} onChange={(e:any)=>setFilterDepartment(e.target.value)}>
                      <option value="">Todos os departamentos</option>
                      {departments.map((d:any,i:number)=> <option key={i} value={d.name}>{d.name}</option>)}
                    </select>
                    <select className="rounded border p-2 bg-transparent" value={filterSetor} onChange={(e:any)=>setFilterSetor(e.target.value)}>
                      <option value="">Todos os setores</option>
                      {setor.map((s:any,i:number)=> <option key={i} value={s.name}>{s.name}</option>)}
                    </select>
                  </>
                )}
              </div>

              {renderList()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    {/* Modal for create / edit */}
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogContent className="max-w-4xl w-[920px]">
        <DialogHeader>
          <DialogTitle>{modalEditingIndex !== null ? 'Editar' : 'Novo'} {active === 'ramais' ? 'Ramal' : active === 'departments' ? 'Departamento' : active === 'companies' ? 'Empresa' : active === 'setor' ? 'Setor' : 'Cargo'}</DialogTitle>
          <DialogDescription>Preencha os dados e adicione uma imagem opcional.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label>Nome</Label>
            <Input value={modalName} onChange={(e:any)=>setModalName(e.target.value)} />
          </div>
          {active === 'ramais' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Departamento</Label>
                  <select className="w-full rounded border p-2 bg-transparent" value={modalDepartment} onChange={(e:any)=>setModalDepartment(e.target.value)}>
                    <option value="">— selecione —</option>
                    {departments.map((d:any,i:number)=> <option key={i} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Setor</Label>
                  <select className="w-full rounded border p-2 bg-transparent" value={modalSetor} onChange={(e:any)=>setModalSetor(e.target.value)}>
                    <option value="">— selecione —</option>
                    {setor.map((s:any,i:number)=> <option key={i} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Empresa</Label>
                  <select className="w-full rounded border p-2 bg-transparent" value={modalCompany} onChange={(e:any)=>setModalCompany(e.target.value)}>
                    <option value="">— selecione —</option>
                    {companies.map((c:any,i:number)=> <option key={i} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <Label>RocketChat <small>usuário (ex: john.doe)</small></Label>
                  <Input value={modalRocketUser} onChange={(e:any)=>setModalRocketUser(e.target.value)} placeholder="john.doe" />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={modalPhone} onChange={(e:any)=> setModalPhone(formatPhoneInputValue(e.target.value))} placeholder="(00) 0000-0000" />
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <Label>WhatsApp</Label>
                  <Input value={modalWhatsapp} onChange={(e:any)=>setModalWhatsapp(e.target.value)} placeholder="5511999999999" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={modalEmail} onChange={(e:any)=>{ setModalEmail(e.target.value); setModalEmailError(null); }} placeholder="usuario@empresa.com (opcional)" />
                  {modalEmailError ? <div className="text-sm text-red-600 mt-1">{modalEmailError}</div> : null}
                </div>
              </div>
            </>
          )}

              <div>
                <Label>Imagem (opcional)</Label>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e:any)=> handleModalImage(e.target.files?.[0])} />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={openFilePicker}
                  onKeyDown={(e:any)=> { if (e.key === 'Enter') openFilePicker(); }}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`mt-2 cursor-pointer rounded border-dashed border-2 p-6 flex items-center justify-center text-center min-h-[160px] transition-transform transition-colors duration-150 ${isDragging ? 'border-primary bg-primary/5 scale-105 shadow-lg' : 'border-border hover:scale-[1.02]'}`}
                >
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="text-sm">Arraste a imagem aqui ou clique para selecionar</div>
                    {modalImage && <img src={modalImage} className="mx-auto h-32 w-auto object-cover rounded" alt="preview" />}
                  </div>
                </div>
              </div>
        </div>

            <DialogFooter>
              <div className="flex gap-2">
                <Button onClick={saveModal} disabled={!modalCanSave}>{modalEditingIndex !== null ? 'Salvar' : 'Criar'}</Button>
                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              </div>
            </DialogFooter>
      </DialogContent>
    </Dialog>
    {/* Confirm dialog removed: dialing goes directly to ramal */}
    </>
  );
}
