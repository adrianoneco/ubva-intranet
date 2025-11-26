import express, { type Express } from "express";
import passport from "passport";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import path from "path";
import fs from "fs/promises";
import multer from "multer";
import { broadcast, registerSSE } from "./sse";
import { insertTaskSchema, insertCategorySchema, insertCardSchema, insertPickupSchema } from "@shared/schema";
import { getCache, setCache, clearCachePattern } from "./redis";
import { db } from "./db";
import { users, groups, permissions, groupPermissions, pickups } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import crypto from 'crypto';

export async function registerRoutes(app: Express): Promise<Server> {
  // File upload middleware (memory storage)
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  // Serve `public` directory so static assets are available
  app.use(express.static(path.resolve(process.cwd(), "public")));

  // Local storage directory for uploaded files. If APP_DATA_DIR is set, use it;
  // otherwise default to `public/uploads` so uploaded files are web-accessible.
  const APP_DATA_DIR = process.env.APP_DATA_DIR ? path.resolve(String(process.env.APP_DATA_DIR)) : path.resolve(process.cwd(), 'public', 'uploads');

  // Helper to build folder path under APP_DATA_DIR
  function ensureFolder(folderName: string) {
    return path.join(APP_DATA_DIR, folderName);
  }

  // Register SSE endpoint for real-time card updates
  registerSSE(app);

  // Helper: normalize stored image URLs (presigned MinIO) to our proxy `/api/files/:fileName`
  function extractFileNameFromUrl(u?: string) {
    try {
      if (!u) return null;
      const parsed = new URL(u);
      // pathname like /<bucket>/<object>
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length === 0) return null;
      return parts[parts.length - 1];
    } catch (e) {
      return null;
    }
  }

  function normalizeImageUrl(u?: string) {
    if (!u || typeof u !== 'string') return u;
    // If already proxied or local, leave as-is
    if (u.startsWith('/uploads/') || u.startsWith('/api/files/') || u.startsWith('/')) return u;
    // If looks like a presigned URL (contains X-Amz-Signature or X-Amz-Expires), attempt to extract object name
    if (u.includes('X-Amz-Signature') || u.includes('X-Amz-Expires')) {
      const fn = extractFileNameFromUrl(u);
      if (fn) return `/api/files/${encodeURIComponent(fn)}`;
    }
    return u;
  }

  function normalizeCardObject(card: any) {
    if (!card || typeof card !== 'object') return card;
    const copy = { ...card };
    if (copy.image && typeof copy.image === 'string') copy.image = normalizeImageUrl(copy.image);
    // scheduleWeekdays may be stored as JSON string
    try {
      if (copy.scheduleWeekdays && typeof copy.scheduleWeekdays === 'string') {
        const parsed = JSON.parse(copy.scheduleWeekdays);
        if (Array.isArray(parsed)) {
          const mapped = parsed.map((s: any) => ({ ...s, image: typeof s.image === 'string' ? normalizeImageUrl(s.image) : s.image }));
          copy.scheduleWeekdays = JSON.stringify(mapped);
        }
      }
    } catch (e) {
      // ignore
    }
    return copy;
  }

  // Contacts API: return persisted contacts from DB
  app.get('/api/contacts', async (_req, res) => {
    try {
      const sections = ['ramais','departments','companies','setor','cargos'];
      const out: Record<string, any[]> = {};
      for (const s of sections) {
        out[s] = await storage.getContactsByKind(s);
      }
      return res.json(out);
    } catch (e) {
      console.error('Failed to fetch contacts', e);
      return res.status(500).json({ error: 'Failed to fetch contacts' });
    }
  });

  // Expose normalized lookup tables if available
  app.get('/api/departments', async (_req, res) => {
    try {
      const items = await storage.getDepartments();
      return res.json(items || []);
    } catch (e) {
      console.error('Failed to fetch departments', e);
      return res.status(500).json({ error: 'Failed to fetch departments' });
    }
  });

  app.get('/api/setores', async (_req, res) => {
    try {
      const items = await storage.getSetores();
      return res.json(items || []);
    } catch (e) {
      console.error('Failed to fetch setores', e);
      return res.status(500).json({ error: 'Failed to fetch setores' });
    }
  });

  app.get('/api/companies', async (_req, res) => {
    try {
      const items = await storage.getCompanies();
      return res.json(items || []);
    } catch (e) {
      console.error('Failed to fetch companies', e);
      return res.status(500).json({ error: 'Failed to fetch companies' });
    }
  });

  // CSV preview/validation endpoint: accepts JSON { csv: string }
  app.post('/api/contacts/preview', express.json({ limit: '1mb' }), requireAuth, async (req, res) => {
    try {
      const csv = (req.body && req.body.csv) || '';
      if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'Missing csv body' });

      const splitSemicolonRow = (line: string) => {
        const res: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQuotes = !inQuotes; continue; }
          if (ch === ';' && !inQuotes) { res.push(cur); cur = ''; continue; }
          cur += ch;
        }
        res.push(cur);
        return res.map(s => s.trim());
      };

      const isEmail = (v: string) => {
        if (!v) return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
      };

      const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return res.json({ headersDetected: false, rows: [], summary: { valid: 0, invalid: 0 } });

      // detect header
      const firstTokens = splitSemicolonRow(lines[0]).map(t => t.toLowerCase());
      const headerLike = firstTokens.some(t => ['ramal','nome','name','telefone','tel','phone','email','e-mail'].includes(t));
      const mapping: Record<number,string> = {};
      let startIndex = 0;
      if (headerLike) {
        // map columns by header name
        for (let i = 0; i < firstTokens.length; i++) {
          const t = firstTokens[i];
          if (!t) continue;
          if (['ramal','extension','ext'].includes(t)) mapping[i] = 'ramal';
          else if (['telefone','tel','phone','telefone_completo','phone_number'].includes(t)) mapping[i] = 'telefone';
          else if (['nome','name','full_name'].includes(t)) mapping[i] = 'nome';
          else if (['email','e-mail','mail'].includes(t)) mapping[i] = 'email';
        }
        startIndex = 1;
      }

      const rows: any[] = [];
      let valid = 0, invalid = 0;
      for (let i = startIndex; i < lines.length; i++) {
        const cols = splitSemicolonRow(lines[i]);
        // if no header mapping, attempt default order: ramal;nome;email;telefone
        let name = '';
        let ramal = '';
        let email = '';
        let telefone = '';
        if (Object.keys(mapping).length > 0) {
          for (let j = 0; j < cols.length; j++) {
            const key = mapping[j];
            if (!key) continue;
            const v = cols[j] || '';
            if (key === 'nome') name = v;
            if (key === 'ramal') ramal = v;
            if (key === 'telefone') telefone = v;
            if (key === 'email') email = v;
          }
        } else {
          // guess by position
          name = cols[1] || cols[0] || '';
          ramal = cols[0] || '';
          email = cols[2] || '';
          telefone = cols[3] || cols[2] || '';
        }

        const errs: string[] = [];
        if (!name || name.trim().length === 0) errs.push('Missing name');
        // prefer telefone if present, otherwise ramal
        const numberToUse = (telefone && String(telefone).trim()) ? String(telefone).trim() : String(ramal).trim();
        if (!numberToUse) errs.push('Missing number');
        if (email && !isEmail(email)) errs.push('Invalid email');

        const ok = errs.length === 0;
        if (ok) valid++; else invalid++;
        rows.push({ row: i+1, original: lines[i], name: name.trim() || null, number: numberToUse || null, email: (email || null), ok, errors: errs });
      }

      return res.json({ headersDetected: headerLike, mapping, rows, summary: { valid, invalid, total: rows.length } });
    } catch (e) {
      console.error('CSV preview error', e);
      return res.status(500).json({ error: 'Failed to preview CSV' });
    }
  });

  // Persist imported contacts (authenticated)
  app.post('/api/contacts/import', requireAuth, express.json({ limit: '1mb' }), async (req, res) => {
    try {
      const body = req.body || {};
      const kind = String(body.kind || 'ramais');
      const rows = Array.isArray(body.rows) ? body.rows : [];
      if (rows.length === 0) return res.status(400).json({ error: 'No rows provided' });

      // Basic normalization of rows
      const normalized = rows.map((r: any) => ({
        name: (r.name || r.nome || '').trim(),
        number: (r.number || r.telefone || r.ramal || '') || null,
        email: (r.email || null) || null,
        department: r.department || r.departamento || null,
        setor: r.setor || null,
        company: r.company || null,
        image: r.image || null,
        rocketUser: r.rocketUser || r.rocket_user || null,
        whatsapp: r.whatsapp || null,
      })).filter((r: any) => r.name && (r.number || r.email));

      if (normalized.length === 0) return res.status(400).json({ error: 'No valid rows to import' });

      const inserted = await storage.insertContacts(kind, normalized);
      await clearCachePattern('contacts:*');
      return res.json({ ok: true, inserted: inserted.length, rows: inserted });
    } catch (e) {
      console.error('Failed to import contacts', e);
      return res.status(500).json({ error: 'Failed to import contacts' });
    }
  });

  // Create a single contact (authenticated)
  app.post('/api/contacts', requireAuth, express.json(), async (req, res) => {
    try {
      const body = req.body || {};
      const kind = String(body.kind || 'ramais');
      const item = {
        kind,
        name: String(body.name || '').trim(),
        number: body.number || null,
        email: body.email || null,
        department: body.department || null,
        setor: body.setor || null,
        company: body.company || null,
        image: body.image || null,
        rocketUser: body.rocketUser || body.rocket_user || null,
        whatsapp: body.whatsapp || null,
      };
      if (!item.name) return res.status(400).json({ error: 'Missing name' });
      if (!item.number && !item.email) return res.status(400).json({ error: 'Missing number or email' });
      const created = await storage.createContact(item as any);
      await clearCachePattern('contacts:*');
      return res.status(201).json({ ok: true, contact: created });
    } catch (e) {
      console.error('Failed to create contact', e);
      return res.status(500).json({ error: 'Failed to create contact' });
    }
  });

  // Update a contact by id (authenticated)
  app.patch('/api/contacts/:id', requireAuth, express.json(), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const payload = req.body || {};
      const updated = await storage.updateContact(id, payload as any);
      if (!updated) return res.status(404).json({ error: 'Contact not found or nothing to update' });
      await clearCachePattern('contacts:*');
      return res.json({ ok: true, contact: updated });
    } catch (e) {
      console.error('Failed to update contact', e);
      return res.status(500).json({ error: 'Failed to update contact' });
    }
  });

  // Delete a contact by id (authenticated)
  app.delete('/api/contacts/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      await storage.deleteContact(id);
      await clearCachePattern('contacts:*');
      return res.status(204).send();
    } catch (e) {
      console.error('Failed to delete contact', e);
      return res.status(500).json({ error: 'Failed to delete contact' });
    }
  });

  // Server time endpoint for clock sync (returns ms since epoch and ISO)
  app.get('/api/server-time', async (_req, res) => {
    try {
      const now = new Date();
      return res.json({ now: now.getTime(), iso: now.toISOString() });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to get server time' });
    }
  });

  // Pickups (Agendamentos) endpoints
  app.get('/api/pickups', async (_req, res) => {
    try {
      const allPickups = await db.select().from(pickups).orderBy(desc(pickups.scheduledAt));
      return res.json(allPickups);
    } catch (e) {
      console.error('Failed to fetch pickups', e);
      return res.status(500).json({ error: 'Failed to fetch pickups' });
    }
  });

  app.post('/api/pickups', requireAuth, express.json(), async (req, res) => {
    try {
      const data = insertPickupSchema.parse(req.body);
      const user = req.user as any;
      const id = data.id || `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      
      const newPickup = {
        id,
        date: data.date,
        time: data.time || null,
        status: data.status || 'agendado',
        clientId: data.clientId,
        clientName: data.clientName || null,
        orderId: data.orderId || null,
        userId: user?.id || null,
        userDisplayName: data.userDisplayName || user?.displayName || user?.username || null,
        scheduledAt: data.scheduledAt || (data.date && data.time ? new Date(`${data.date}T${data.time}:00`) : null),
      };

      await db.insert(pickups).values(newPickup);
      return res.status(201).json(newPickup);
    } catch (e) {
      console.error('Failed to create pickup', e);
      return res.status(400).json({ error: 'Failed to create pickup' });
    }
  });

  app.post('/api/pickups/bulk', requireAuth, express.json(), async (req, res) => {
    try {
      const items = req.body.pickups;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Expected array of pickups' });
      }

      const user = req.user as any;
      const results = [];

      for (const item of items) {
        try {
          const data = insertPickupSchema.parse(item);
          const id = data.id || `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
          
          const newPickup = {
            id,
            date: data.date,
            time: data.time || null,
            status: data.status || 'agendado',
            clientId: data.clientId,
            clientName: data.clientName || null,
            orderId: data.orderId || null,
            userId: user?.id || null,
            userDisplayName: data.userDisplayName || user?.displayName || user?.username || null,
            scheduledAt: data.scheduledAt || (data.date && data.time ? new Date(`${data.date}T${data.time}:00`) : null),
          };

          await db.insert(pickups).values(newPickup);
          results.push({ id, success: true });
        } catch (e) {
          results.push({ id: item.id, success: false, error: String(e) });
        }
      }

      return res.json({ results });
    } catch (e) {
      console.error('Failed to bulk create pickups', e);
      return res.status(500).json({ error: 'Failed to bulk create pickups' });
    }
  });

  app.patch('/api/pickups/:id', requireAuth, express.json(), async (req, res) => {
    try {
      const id = req.params.id;
      const data = insertPickupSchema.partial().parse(req.body);
      
      const updateData: any = {};
      if (data.date !== undefined) updateData.date = data.date;
      if (data.time !== undefined) updateData.time = data.time;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.clientId !== undefined) updateData.clientId = data.clientId;
      if (data.clientName !== undefined) updateData.clientName = data.clientName;
      if (data.orderId !== undefined) updateData.orderId = data.orderId;
      if (data.scheduledAt !== undefined) updateData.scheduledAt = data.scheduledAt;

      await db.update(pickups).set(updateData).where(eq(pickups.id, id));
      
      const updated = await db.select().from(pickups).where(eq(pickups.id, id));
      return res.json(updated[0]);
    } catch (e) {
      console.error('Failed to update pickup', e);
      return res.status(400).json({ error: 'Failed to update pickup' });
    }
  });

  app.delete('/api/pickups/:id', requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      await db.delete(pickups).where(eq(pickups.id, id));
      return res.status(204).send();
    } catch (e) {
      console.error('Failed to delete pickup', e);
      return res.status(500).json({ error: 'Failed to delete pickup' });
    }
  });

  // Simple auth endpoints (login/logout) using passport-local + session
  app.post('/api/login', express.json(), (req, res, next) => {
    // passport authenticate with callback to control response
    (req as any).logIn && (req as any).logIn;
    const passportAuth = (passport as any).authenticate('local', (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      req.logIn(user, (err2: any) => {
        if (err2) return next(err2);
        // return full user info with permissions
        return res.json({ ok: true, user: { 
          username: user.username, 
          displayName: user.displayName,
          email: user.email,
          role: user.role,
          permissions: user.permissions || []
        } });
      });
    });
    return passportAuth(req, res, next);
  });

  app.post('/api/logout', (req, res) => {
    try {
      // Passport >=0.6 may require callback for logout
      const doDestroy = () => {
        try {
          if (req.session && typeof req.session.destroy === 'function') {
            req.session.destroy(() => {
              try { res.clearCookie('connect.sid'); } catch (e) {}
              return res.json({ ok: true });
            });
            return;
          }
        } catch (e) {}
        try { res.clearCookie('connect.sid'); } catch (e) {}
        return res.json({ ok: true });
      };

      if (typeof (req as any).logout === 'function') {
        // logout may accept a callback
        try {
          (req as any).logout((err: any) => {
            // ignore error, proceed to destroy session
            doDestroy();
          });
          return;
        } catch (e) {
          try { (req as any).logout(); } catch (e) {}
          doDestroy();
          return;
        }
      }

      doDestroy();
    } catch (e) {
      try { res.clearCookie('connect.sid'); } catch (err) {}
      return res.json({ ok: true });
    }
  });

  // return current logged-in user (if any)
  app.get('/api/me', (req, res) => {
    try {
      if ((req as any).isAuthenticated && (req as any).isAuthenticated()) {
        const user = (req as any).user || null;
        return res.json({ user });
      }
      return res.json({ user: null });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to get session' });
    }
  });

  // Admin: list users (include displayName, email, role, permissions parsed)
  app.get('/api/admin/users', requireAuth, async (_req, res) => {
    try {
      const rows: any[] = await db.select().from(users);
      const out: any[] = [];
      for (const r of rows) {
        let perms: string[] = [];
        try {
          if (r.role) {
            if (r.role === 'admin') {
              const all = await db.select().from(permissions).orderBy(permissions.id);
              perms = Array.isArray(all) ? all.map((p: any) => p.key) : [];
            } else {
              const gpRows: any[] = await db.select({ key: permissions.key }).from(permissions).innerJoin(groupPermissions, eq(groupPermissions.permissionId, permissions.id)).where(eq(groupPermissions.groupId, r.role));
              perms = Array.isArray(gpRows) ? gpRows.map((p: any) => p.key) : [];
            }
          }
        } catch (e) { perms = []; }
        out.push({ id: r.id, username: r.username, displayName: r.displayName || r.display_name || null, email: r.email || null, role: r.role, permissions: perms });
      }
      return res.json(out);
    } catch (e) {
      console.error('Failed to fetch users', e);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Admin: create user (generates a random password and stores hash)
  app.post('/api/admin/users', requireAuth, express.json(), async (req, res) => {
    try {
      const body = req.body || {};
      const displayName = String(body.displayName || body.display_name || '').trim();
      const email = body.email ? String(body.email).trim() : null;
      const role = String(body.role || 'viewer');
      // Users are linked to groups (role). Ignore per-user permissions; keep empty.

      // generate a username from email or displayName
      let base = email ? email.split('@')[0] : (displayName ? displayName.toLowerCase().replace(/[^a-z0-9]+/g,'-') : `user${Date.now()}`);
      let username = base;
      // ensure uniqueness
      let suffix = 1;
      while (true) {
        const [exist] = await db.select().from(users).where(eq(users.username, username));
        if (!exist) break;
        username = `${base}${suffix++}`;
      }

      // create password (use provided one if present, otherwise generate)
      const providedPassword = body.password ? String(body.password) : '';
      const pw = providedPassword && providedPassword.length > 0 ? providedPassword : crypto.randomBytes(6).toString('hex');
      const salt = crypto.randomBytes(16).toString('hex');
      const iterations = 100000;
      const passwordHash = crypto.pbkdf2Sync(pw, salt, iterations, 64, 'sha512').toString('hex');

      const insertRes = await db.insert(users).values({ username, passwordHash, salt, iterations, role, displayName, email } as any);
      // fetch created
      const [created] = await db.select().from(users).where(eq(users.username, username));
      // If the server generated the password (not provided), return it so admin can copy it; otherwise don't return password in response
      // derive permissions from the user's role/group
      let derivedPermissions: string[] = [];
      try {
        if (created.role) {
          if (created.role === 'admin') {
            const permsRows: any[] = await db.select({ key: permissions.key }).from(permissions).orderBy(permissions.id);
            derivedPermissions = Array.isArray(permsRows) ? permsRows.map((p: any) => p.key) : [];
          } else {
            const gpRows: any[] = await db.select({ key: permissions.key }).from(permissions).innerJoin(groupPermissions, eq(groupPermissions.permissionId, permissions.id)).where(eq(groupPermissions.groupId, created.role));
            derivedPermissions = Array.isArray(gpRows) ? gpRows.map((p: any) => p.key) : [];
          }
        }
      } catch (e) { derivedPermissions = []; }
      const resp: any = { ok: true, user: { id: created.id, username: created.username, displayName: created.displayName, email: created.email, role: created.role, permissions: derivedPermissions } };
      if (!providedPassword) resp.password = pw;
      return res.status(201).json(resp);
    } catch (e) {
      console.error('Failed to create user', e);
      return res.status(500).json({ error: 'Failed to create user' });
    }
  });

  // Admin: update user fields
  app.patch('/api/admin/users/:id', requireAuth, express.json(), async (req, res) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const body = req.body || {};
      const patch: any = {};
      if (body.displayName !== undefined) patch.displayName = body.displayName;
      if (body.email !== undefined) patch.email = body.email;
      if (body.role !== undefined) patch.role = body.role;
      // Do not allow setting per-user permissions here. Permissions are derived from groups (role).
      // allow password change
      if (body.password !== undefined) {
        const newPw = String(body.password || '').trim();
        if (newPw && newPw.length > 0) {
          const newSalt = crypto.randomBytes(16).toString('hex');
          const iterations = 100000;
          const newHash = crypto.pbkdf2Sync(newPw, newSalt, iterations, 64, 'sha512').toString('hex');
          patch.passwordHash = newHash;
          patch.salt = newSalt;
          patch.iterations = iterations;
          console.log(`[USER UPDATE] Updating password for user ID ${id}`);
        } else {
          // if empty string provided, ignore (do not clear password)
        }
      }
      if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nothing to update' });
      console.log(`[USER UPDATE] Patch object:`, Object.keys(patch));
      await db.update(users).set(patch).where(eq(users.id, id));
      const [row] = await db.select().from(users).where(eq(users.id, id));
      console.log(`[USER UPDATE] Updated user ${row.username}, has passwordHash: ${!!row.passwordHash}`);
      // derive permissions from role/group using normalized mappings
      let updatedPerms: string[] = [];
      try {
        if (row.role) {
          if (row.role === 'admin') {
            const permsRows: any[] = await db.select({ key: permissions.key }).from(permissions).orderBy(permissions.id);
            updatedPerms = Array.isArray(permsRows) ? permsRows.map((p: any) => p.key) : [];
          } else {
            const gpRows: any[] = await db.select({ key: permissions.key }).from(permissions).innerJoin(groupPermissions, eq(groupPermissions.permissionId, permissions.id)).where(eq(groupPermissions.groupId, row.role));
            updatedPerms = Array.isArray(gpRows) ? gpRows.map((p: any) => p.key) : [];
          }
        }
      } catch (e) { updatedPerms = []; }
      return res.json({ ok: true, user: { id: row.id, username: row.username, displayName: row.displayName || row.displayName, email: row.email, role: row.role, permissions: updatedPerms } });
    } catch (e) {
      console.error('Failed to update user', e);
      return res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // Admin: delete user
  app.delete('/api/admin/users/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      await db.delete(users).where(eq(users.id, id));
      return res.json({ ok: true });
    } catch (e) {
      console.error('Failed to delete user', e);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  // Admin: groups endpoints
  app.get('/api/admin/groups', requireAuth, async (_req, res) => {
    try {
      const rows: any[] = await db.select().from(groups);
      const out: any[] = [];
      for (const g of rows) {
        try {
          const gpRows: any[] = await db.select({ key: permissions.key }).from(permissions).innerJoin(groupPermissions, eq(groupPermissions.permissionId, permissions.id)).where(eq(groupPermissions.groupId, g.id));
          const perms = Array.isArray(gpRows) ? gpRows.map((p: any) => p.key) : [];
          out.push({ id: g.id, name: g.name, permissions: perms });
        } catch (e) {
          out.push({ id: g.id, name: g.name, permissions: [] });
        }
      }
      return res.json(out);
    } catch (e) {
      console.error('Failed to fetch groups', e);
      return res.status(500).json({ error: 'Failed to fetch groups' });
    }
  });

  app.post('/api/admin/groups', requireAuth, express.json(), async (req, res) => {
    try {
      const body = req.body || {};
      const name = String(body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Missing name' });
      const id = (body.id || name.toLowerCase().replace(/[^a-z0-9]+/g,'-'));
      const permissionsBody = Array.isArray(body.permissions) ? body.permissions : [];
      await db.insert(groups).values({ id, name } as any);
      // ensure permission keys exist and create mappings
      for (const key of permissionsBody) {
        // insert permission if not exists
        await db.insert(permissions).values({ key }).onConflictDoNothing();
        // fetch permission id
        const [p] = await db.select().from(permissions).where(eq(permissions.key, key));
        if (p) {
          await db.insert(groupPermissions).values({ groupId: id, permissionId: p.id }).onConflictDoNothing();
        }
      }
      const [row] = await db.select().from(groups).where(eq(groups.id, id));
      // return created group with derived permissions
      const gpRows: any[] = await db.select({ key: permissions.key }).from(permissions).innerJoin(groupPermissions, eq(groupPermissions.permissionId, permissions.id)).where(eq(groupPermissions.groupId, id));
      const perms = Array.isArray(gpRows) ? gpRows.map((p: any) => p.key) : [];
      return res.status(201).json({ ok: true, group: { id: row.id, name: row.name, permissions: perms } });
    } catch (e) {
      console.error('Failed to create group', e);
      return res.status(500).json({ error: 'Failed to create group' });
    }
  });

  app.patch('/api/admin/groups/:id', requireAuth, express.json(), async (req, res) => {
    try {
      const id = String(req.params.id || '');
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const body = req.body || {};
      const patch: any = {};
      if (body.name !== undefined) patch.name = body.name;
      if (Object.keys(patch).length === 0 && body.permissions === undefined) return res.status(400).json({ error: 'Nothing to update' });
      if (Object.keys(patch).length > 0) await db.update(groups).set(patch).where(eq(groups.id, id));

      if (body.permissions !== undefined) {
        const newPerms: string[] = Array.isArray(body.permissions) ? body.permissions : [];
        // replace mappings: delete existing and insert new
        await db.delete(groupPermissions).where(eq(groupPermissions.groupId, id));
        for (const key of newPerms) {
          await db.insert(permissions).values({ key }).onConflictDoNothing();
          const [p] = await db.select().from(permissions).where(eq(permissions.key, key));
          if (p) await db.insert(groupPermissions).values({ groupId: id, permissionId: p.id }).onConflictDoNothing();
        }
      }

      const [row] = await db.select().from(groups).where(eq(groups.id, id));
      const gpRows: any[] = await db.select({ key: permissions.key }).from(permissions).innerJoin(groupPermissions, eq(groupPermissions.permissionId, permissions.id)).where(eq(groupPermissions.groupId, id));
      const perms = Array.isArray(gpRows) ? gpRows.map((p: any) => p.key) : [];
      return res.json({ ok: true, group: { id: row.id, name: row.name, permissions: perms } });
    } catch (e) {
      console.error('Failed to update group', e);
      return res.status(500).json({ error: 'Failed to update group' });
    }
  });

  app.delete('/api/admin/groups/:id', requireAuth, async (req, res) => {
    try {
      const id = String(req.params.id || '');
      if (!id) return res.status(400).json({ error: 'Missing id' });
      await db.delete(groups).where(eq(groups.id, id));
      // reset users with this role to viewer (clear role only)
      await db.update(users).set({ role: 'viewer' } as any).where(eq(users.role, id));
      return res.json({ ok: true });
    } catch (e) {
      console.error('Failed to delete group', e);
      return res.status(500).json({ error: 'Failed to delete group' });
    }
  });

  // middleware to require authentication for write operations
  async function requireAuth(req: any, res: any, next: any) {
    // 1) allow existing passport session
    try {
      if (req.isAuthenticated && req.isAuthenticated()) return next();
    } catch (e) {}

    // 2) allow HTTP Basic Auth by validating credentials against `users` table
    const auth = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
    if (typeof auth === 'string' && auth.startsWith('Basic ')) {
      try {
        const b64 = auth.slice(6).trim();
        const decoded = Buffer.from(b64, 'base64').toString('utf8');
        const idx = decoded.indexOf(':');
        if (idx > 0) {
          const username = decoded.slice(0, idx);
          const password = decoded.slice(idx + 1);
          // find user in DB
          try {
              let row: any = undefined;
              const rows1 = await db.select().from(users).where(eq(users.username, username));
              if (Array.isArray(rows1) && rows1.length) row = rows1[0];
              if (!row) {
                const rows2 = await db.select().from(users).where(eq(users.email, username));
                if (Array.isArray(rows2) && rows2.length) row = rows2[0];
              }
            if (row) {
              const iterations = row.iterations || 100000;
              const hash = crypto.pbkdf2Sync(password, row.salt, iterations, 64, 'sha512').toString('hex');
              if (hash === row.passwordHash) {
                req.user = { id: row.id, username: row.username, role: row.role };
                return next();
              }
            }
          } catch (inner) {
            // fall through to unauthorized
          }
        }
      } catch (e) {
        // fall through to unauthorized
      }
    }

    // If the request looks like a browser navigation (Accept includes text/html), respond with WWW-Authenticate
    const accept = (req.headers && req.headers.accept) || '';
    if (typeof accept === 'string' && accept.includes('text/html')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Intranet"');
      return res.status(401).send('Unauthorized');
    }

    return res.status(401).json({ error: 'Unauthorized' });
  }

  // middleware to require a specific permission
  function requirePermission(permission: string) {
    return async (req: any, res: any, next: any) => {
      try {
        // If the user is in the admin role, grant all permissions immediately
        try {
          if (req.user && req.user.role === 'admin') return next();
        } catch (e) {}

        // try permissions on req.user first
        let perms: string[] | undefined = undefined;
        if (req.user && Array.isArray(req.user.permissions)) perms = req.user.permissions;

          // if not present, derive permissions from the user's group/role using normalized tables
          if ((!perms || perms.length === 0) && req.user) {
            try {
              // try to resolve role from session user object or DB (prefer session)
              let role: string | undefined = undefined;
              if (req.user.role) role = req.user.role;
              else if (req.user.id) {
                const [uRow] = await db.select({ role: users.role }).from(users).where(eq(users.id, req.user.id));
                if (uRow) role = uRow.role;
              } else if (req.user.username) {
                const [uRow] = await db.select({ role: users.role }).from(users).where(eq(users.username, req.user.username));
                if (uRow) role = uRow.role;
              }

              if (role) {
                if (role === 'admin') {
                  const permsRows: any[] = await db.select({ key: permissions.key }).from(permissions).orderBy(permissions.id);
                  perms = permsRows.map((p: any) => p.key);
                } else {
                  const gpRows: any[] = await db.select({ key: permissions.key }).from(permissions).innerJoin(groupPermissions, eq(groupPermissions.permissionId, permissions.id)).where(eq(groupPermissions.groupId, role));
                  perms = Array.isArray(gpRows) ? gpRows.map((p: any) => p.key) : [];
                }
              }
            } catch (e) {
              // ignore DB error and fall through to forbidden
            }
          }

        if (Array.isArray(perms) && perms.includes(permission)) return next();
        return res.status(403).json({ error: 'Forbidden' });
      } catch (e) {
        return res.status(500).json({ error: 'Permission check failed' });
      }
    };
  }

  // Protect certain client-side pages (SPA routes) by requiring login.
  // If user has a session or valid Basic auth, allow; otherwise redirect to /login.
  async function spaProtect(req: any, res: any, next: any) {
    try {
      if (req.isAuthenticated && req.isAuthenticated()) return next();

      // Try Basic auth as a fallback
      const auth = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
      if (typeof auth === 'string' && auth.startsWith('Basic ')) {
        try {
          const b64 = auth.slice(6).trim();
          const decoded = Buffer.from(b64, 'base64').toString('utf8');
          const idx = decoded.indexOf(':');
          if (idx > 0) {
            const username = decoded.slice(0, idx);
            const password = decoded.slice(idx + 1);
            let row: any = undefined;
            const rows1 = await db.select().from(users).where(eq(users.username, username));
            if (Array.isArray(rows1) && rows1.length) row = rows1[0];
            if (!row) {
              const rows2 = await db.select().from(users).where(eq(users.email, username));
              if (Array.isArray(rows2) && rows2.length) row = rows2[0];
            }
            if (row) {
              const iterations = row.iterations || 100000;
              const hash = crypto.pbkdf2Sync(password, row.salt, iterations, 64, 'sha512').toString('hex');
              if (hash === row.passwordHash) {
                req.user = { id: row.id, username: row.username, role: row.role };
                return next();
              }
            }
          }
        } catch (e) {
          // fall through to redirect
        }
      }

      // Not authenticated: redirect to login page (SPA will handle)
      return res.redirect('/login');
    } catch (err) {
      return next(err);
    }
  }

  app.use('/settings', spaProtect);
  app.use('/agendamento', spaProtect);

  // Upload endpoint (save files to local storage under APP_DATA_DIR/uploads)
  app.post("/api/uploads", requireAuth, (upload.single("file") as any), async (req, res) => {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ error: "No file provided" });

      const ext = path.extname(file.originalname) || "";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const folder = 'uploads';
      const dir = ensureFolder(folder);

      try {
        await fs.mkdir(dir, { recursive: true });
        const outPath = path.join(dir, fileName);
        await fs.writeFile(outPath, file.buffer);
        const url = `/api/files/${folder}/${encodeURIComponent(fileName)}`;
        return res.json({ url, fileName });
      } catch (err) {
        console.error('Local upload error:', err);
        return res.status(500).json({ error: 'Failed to save file locally' });
      }
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Card image upload and attach to card (for editing existing cards)
  app.post('/api/cards/:id/upload-image', requireAuth, requirePermission('cards:edit'), (upload.single('file') as any), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid card id' });
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ error: 'No file provided' });

      const ext = path.extname(file.originalname) || '';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
      const folder = 'cards';
      const dir = ensureFolder(folder);
      await fs.mkdir(dir, { recursive: true });
      const outPath = path.join(dir, fileName);
      await fs.writeFile(outPath, file.buffer);
      const url = `/api/files/${folder}/${encodeURIComponent(fileName)}`;

      // update card image in DB
      const updated = await storage.updateCard(id, { image: url } as any);
      await clearCachePattern('cards:*');
      try { broadcast({ type: 'card:updated', card: updated }); } catch (e) {}
      return res.json({ url, fileName, card: updated });
    } catch (err) {
      console.error('Failed to upload and attach card image', err);
      return res.status(500).json({ error: 'Failed to upload image' });
    }
  });

  // Schedule image upload (does not modify card) - used for images attached to schedule entries
  app.post('/api/cards/schedule-upload', requireAuth, requirePermission('cards:edit'), (upload.single('file') as any), async (req, res) => {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ error: 'No file provided' });
      const ext = path.extname(file.originalname) || '';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
      const folder = 'schedules';
      const dir = ensureFolder(folder);
      await fs.mkdir(dir, { recursive: true });
      const outPath = path.join(dir, fileName);
      await fs.writeFile(outPath, file.buffer);
      const url = `/api/files/${folder}/${encodeURIComponent(fileName)}`;
      return res.json({ url, fileName });
    } catch (err) {
      console.error('Failed to upload schedule image', err);
      return res.status(500).json({ error: 'Failed to upload image' });
    }
  });

  // Files endpoint: serve files saved under APP_DATA_DIR. Accepts paths like /api/files/<folder>/<fileName>
  app.get(/^\/api\/files\/(.*)$/, async (req, res) => {
    try {
      const rel = String((req.params as any)[0] || '').replace(/\.\./g, ''); // avoid path traversal
      if (!rel) return res.status(400).send('Missing file path');

      const filePath = path.join(APP_DATA_DIR, rel);
      // set Content-Type based on extension when possible
      const ext = path.extname(filePath || '').toLowerCase();
      const extType: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
      const contentType = extType[ext] || undefined;
      if (contentType) res.setHeader('Content-Type', contentType);

      return res.sendFile(filePath, (err) => {
        if (err) {
          console.error('Failed to send file', err, filePath);
          try { res.status(404).send('Not found'); } catch (e) {}
        }
      });
    } catch (e) {
      console.error('Files endpoint error', e);
      return res.status(500).send('Error');
    }
  });

  // Task routes
  app.get("/api/tasks", async (_req, res) => {
    try {
      // Try to get from cache first
      const cacheKey = "tasks:all";
      const cachedTasks = await getCache(cacheKey);
      
      if (cachedTasks) {
        return res.json(cachedTasks);
      }

      // If not in cache, get from database
      const tasks = await storage.getAllTasks();
      
      // Store in cache for 5 minutes
      await setCache(cacheKey, tasks, 300);
      
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  app.post("/api/tasks", requireAuth, async (req, res) => {
    try {
      const result = insertTaskSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid task data", details: result.error.errors });
      }
      const task = await storage.createTask(result.data);
      
      // Invalidate tasks cache
      await clearCachePattern("tasks:*");
      
      res.status(201).json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateSchema = insertTaskSchema.partial();
      const result = updateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid update data", details: result.error.errors });
      }
      const task = await storage.updateTask(id, result.data);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      // Invalidate tasks cache
      await clearCachePattern("tasks:*");
      
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTask(id);
      
      // Invalidate tasks cache
      await clearCachePattern("tasks:*");
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Category routes
  app.get("/api/categories", async (_req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.get("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getCategory(id);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch category" });
    }
  });

  app.post("/api/categories", requireAuth, async (req, res) => {
    try {
      const result = insertCategorySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid category data", details: result.error.errors });
      }
      const category = await storage.createCategory(result.data);
      res.status(201).json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  // Card routes
  app.get("/api/cards", async (_req, res) => {
    try {
      const cacheKey = "cards:all";
      const cached = await getCache(cacheKey);
      if (cached) return res.json(cached);
      const cards = await storage.getAllCards();
      // normalize image URLs
      const normalized = Array.isArray(cards) ? cards.map(normalizeCardObject) : cards;
      await setCache(cacheKey, normalized, 300);
      res.json(normalized);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cards" });
    }
  });

  app.post("/api/cards", requireAuth, requirePermission('cards:create'), async (req, res) => {
    try {
      const result = insertCardSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid card data", details: result.error.errors });
      }
      const card = await storage.createCard(result.data);
      await clearCachePattern("cards:*");
      // normalize image before broadcasting/returning
      const norm = normalizeCardObject(card);
      try { broadcast({ type: 'card:created', card: norm }); } catch (e) {}
      res.status(201).json(norm);
    } catch (error) {
      res.status(500).json({ error: "Failed to create card" });
    }
  });

  // Separate schedule-only update endpoint: updates only scheduleWeekdays
  app.patch("/api/cards/:id/schedules", requireAuth, requirePermission('cards:edit'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const schedules = req.body.schedules ?? req.body.scheduleWeekdays;

      if (!schedules) {
        return res.status(400).json({ error: "Missing schedules" });
      }

      console.log(`Received schedules update for card ${id}:`, Array.isArray(schedules) ? schedules.map(s => ({ startDate: s.startDate, endDate: s.endDate, image: Boolean(s.image) })) : String(schedules).slice(0,1000));

      // Accept either an array (client) or a JSON string
      let scheduleStr: string;
      if (Array.isArray(schedules)) {
        scheduleStr = JSON.stringify(schedules);
      } else if (typeof schedules === 'string') {
        // assume already JSON string
        scheduleStr = schedules;
      } else {
        return res.status(400).json({ error: "Invalid schedules format" });
      }

      const existing = await storage.getCard(id);
      if (!existing) return res.status(404).json({ error: 'Card not found' });

      // Require that each schedule entry includes an image (scheduling requires an image)
      try {
        const parsed = JSON.parse(scheduleStr) as any[];
        if (!Array.isArray(parsed)) {
          return res.status(400).json({ error: 'Schedules must be an array' });
        }
        // Log parsed schedule starts for debugging
        console.log(`Parsed schedules for card ${id}:`, parsed.map((p: any) => ({ startDate: p.startDate, endDate: p.endDate, hasImage: Boolean(p.image) })));
        for (const s of parsed) {
          if (!s || !s.image || typeof s.image !== 'string' || s.image.trim() === '') {
            return res.status(400).json({ error: 'Each schedule entry must include an image' });
          }
        }
      } catch (e) {
        return res.status(400).json({ error: 'Invalid schedules JSON' });
      }

      console.log(`Saving schedules for card ${id}, string length ${scheduleStr.length}`);
      const updated = await storage.updateCard(id, { scheduleWeekdays: scheduleStr });
      if (!updated) return res.status(500).json({ error: 'Failed to update schedules' });

      await clearCachePattern("cards:*");
      try { broadcast({ type: 'card:updated', cardId: id, scheduleWeekdays: updated.scheduleWeekdays }); } catch (e) {}
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update schedules" });
    }
  });

  app.patch("/api/cards/:id", requireAuth, requirePermission('cards:edit'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateSchema = insertCardSchema.partial();
      const result = updateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid update data", details: result.error.errors });
      }
      // If client sent an embedded data URL for image, extract and save it
      const payload = { ...result.data } as any;
      try {
        if (payload.image && typeof payload.image === 'string' && payload.image.startsWith('data:')) {
          // data:[mime];base64,[data]
          const m = (payload.image as string).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
          if (m) {
            const mime = m[1];
            const b64 = m[2];
            const ext = mime.split('/')[1].replace('+', '');
            const fileName = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
            const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
            await fs.mkdir(uploadsDir, { recursive: true });
            const outPathFile = path.join(uploadsDir, fileName);
            const buf = Buffer.from(b64, 'base64');
            await fs.writeFile(outPathFile, buf);
            payload.image = `/uploads/${fileName}`;
          } else {
            delete payload.image;
          }
        }
      } catch (e) {
        console.error('Failed to process embedded image for card update', e);
        delete payload.image;
      }

      let card;
      try {
        card = await storage.updateCard(id, payload);
      } catch (innerErr) {
        console.error('Storage updateCard error:', innerErr);
        return res.status(500).json({ error: 'Failed to update card (storage)', details: String((innerErr as any).message || innerErr) });
      }
      if (!card) return res.status(404).json({ error: "Card not found" });
      await clearCachePattern("cards:*");
      try { broadcast({ type: 'card:updated', card }); } catch (e) {}
      res.json(normalizeCardObject(card));
    } catch (error) {
      console.error('PATCH /api/cards/:id error:', error);
      res.status(500).json({ error: "Failed to update card", details: String((error as any).message || error) });
    }
  });

  app.delete("/api/cards/:id", requireAuth, requirePermission('cards:delete'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCard(id);
      await clearCachePattern("cards:*");
      try { broadcast({ type: 'card:deleted', id }); } catch (e) {}
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete card" });
    }
  });

  // NOTE: `/api/contacts/sync` route removed — client no longer posts bulk contact syncs.

  const httpServer = createServer(app);

  // Update only email for a contact by id
  app.patch('/api/contacts/:id/email', requireAuth, express.json(), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid contact id' });
      const emailRaw = (req.body && req.body.email) ? String(req.body.email).trim() : '';
      if (emailRaw && emailRaw.length > 0) {
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(emailRaw)) return res.status(400).json({ error: 'Invalid email' });
      }
      const emailNormalized = emailRaw && emailRaw.length > 0 ? emailRaw.toLowerCase() : null;
      const updated = await storage.updateContactEmail(id, emailNormalized);
      if (!updated) return res.status(404).json({ error: 'Contact not found' });
      return res.json({ ok: true, contact: updated });
    } catch (err) {
      console.error('Failed to update contact email', err);
      return res.status(500).json({ error: 'Failed to update contact email' });
    }
  });

  return httpServer;
}

// lightweight telemetry endpoint for calls
export async function registerTelemetry(app: Express) {
  app.post('/api/track-call', express.json(), (req, res) => {
    try {
      const body = req.body || {};
      console.log('[telemetry] call', body);
      return res.json({ ok: true });
    } catch (e) {
      console.error('Failed to track call', e);
      return res.status(500).json({ error: 'Failed to track' });
    }
  });
}
