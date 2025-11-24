import { storage } from "./storage";
import { clearCachePattern } from "./redis";
import { broadcast } from "./sse";
import fs from "fs/promises";
import path from "path";

type ScheduleEntry = {
  startDate?: string;
  endDate?: string;
  image?: string;
};

let _interval: NodeJS.Timeout | null = null;
let _promptInterval: NodeJS.Timeout | null = null;

export function startScheduler(intervalMs?: number) {
  // determine scheduler interval (ms) used to decide the application window
  const envMs = Number(process.env.SCHEDULER_INTERVAL_MS || '');
  // default to 1 second for higher precision (can be overridden via env or param)
  const checkIntervalMs = typeof intervalMs === 'number' ? intervalMs : (Number.isFinite(envMs) && envMs > 0 ? envMs : 1_000);

  async function checkSchedules() {
    try {
      const now = new Date();
      const cards = await storage.getAllCards();

      for (const card of cards) {
        // scheduleWeekdays stored as JSON string (array of schedules)
        const raw = (card as any).scheduleWeekdays;
        if (!raw) continue;

        let schedules: ScheduleEntry[];
        try {
          schedules = JSON.parse(raw) as ScheduleEntry[];
        } catch (e) {
          // invalid JSON, skip
          continue;
        }

        if (!Array.isArray(schedules)) continue;

        // remove expired schedules (endDate in the past)
        const originalCount = schedules.length;
        const filtered = schedules.filter((s) => {
          if (!s) return false;
          if (!s.endDate) return true; // no end date -> keep
          const end = new Date(s.endDate);
          if (isNaN(end.getTime())) return true;
          return end.getTime() > now.getTime();
        });

        if (filtered.length !== originalCount) {
          try {
            const updated = filtered.length ? JSON.stringify(filtered) : null;
            await storage.updateCard((card as any).id, { scheduleWeekdays: updated } as any);
            await clearCachePattern("cards:*");
            try { broadcast({ type: 'card:updated', cardId: (card as any).id, scheduleWeekdays: filtered.length ? filtered : null }); } catch (e) {}
            console.log(`Removed ${originalCount - filtered.length} expired schedule(s) for card ${(card as any).id}`);
          } catch (err) {
            console.error("Failed to remove expired schedules for card", (card as any).id, err);
          }
        }

        // use the filtered schedules for applying logic
        schedules = filtered;

        let applied = false;
        for (const s of schedules) {
          if (!s || !s.startDate) continue;
          const start = new Date(s.startDate);
          const end = s.endDate ? new Date(s.endDate) : null;
          if (isNaN(start.getTime())) continue;
          if (start <= now && (!end || now <= end)) {
            // Apply schedule only when we're within the scheduler's polling window
            // to avoid applying the image prematurely due to clock/precision issues.
            const diff = now.getTime() - start.getTime();
            const withinWindow = diff >= 0 && diff < checkIntervalMs;
            const missedWindow = diff >= checkIntervalMs;

              // Debug logging for schedules near their start time to diagnose early/late application
              const diffSec = Math.round(diff / 1000);
              if (Math.abs(diffSec) <= 30) {
                console.log(`Schedule check card=${(card as any).id} start=${start.toISOString()} now=${now.toISOString()} diffSec=${diffSec} withinWindow=${withinWindow} missedWindow=${missedWindow}`);
              }

            // If we're before the start, skip (shouldn't happen because start <= now check),
            // but guard anyway. If we're within the window, apply. If we already
            // missed the window (e.g. server was down) apply immediately so we don't
            // miss scheduled content.
            if (withinWindow || missedWindow) {
              if (s.image && card.image !== s.image) {
                try {
                  await storage.updateCard((card as any).id, { image: s.image } as any);
                  await clearCachePattern("cards:*");
                  try { broadcast({ type: 'card:updated', cardId: (card as any).id, image: s.image }); } catch (e) {}
                  console.log(`Applied schedule for card ${ (card as any).id }`);
                } catch (err) {
                  console.error("Failed to apply schedule for card", (card as any).id, err);
                }
              }
            }
            // once an active schedule is applied for this card, skip other schedules
            applied = true;
            break;
          }
        }
        // If there is no active schedule, do not clear the card image.
        // Clearing the image caused the main card image to be removed whenever a
        // schedule existed but wasn't currently active. Instead, keep the
        // current card image untouched so scheduling does not unexpectedly
        // remove the published content. (Restoring a previous non-scheduled
        // image would require storing an original image field; avoid that for
        // now to keep behavior safe and predictable.)
        if (!applied && schedules.length > 0) {
          // nothing to do — maintain existing card.image
        }
      }
    } catch (err) {
      console.error("Scheduler error:", err);
    }
  }

  // run immediately then every interval
  const ms = typeof intervalMs === "number" ? intervalMs : (Number.isFinite(envMs) && envMs > 0 ? envMs : 1_000);
  console.log(`Scheduler starting with interval ${ms}ms (check window ${checkIntervalMs}ms)`);
  checkSchedules().catch((e) => console.error(e));
  _interval = setInterval(() => checkSchedules().catch((e) => console.error(e)), ms);

  // start periodic site prompt generation for AI consumption
  async function generateSitePrompt() {
    try {
      const cards = await storage.getAllCards();
      const tasks = await storage.getAllTasks();
      const categories = await storage.getAllCategories();

      const lines: string[] = [];
      lines.push("SITE PROMPT GENERATION");
      lines.push(`generated_at: ${new Date().toISOString()}`);
      lines.push('');

      lines.push('--- CARDS ---');
      for (const c of cards) {
        lines.push(`id: ${ (c as any).id }`);
        lines.push(`title: ${ (c as any).title || '' }`);
        lines.push(`subtitle: ${ (c as any).subtitle || '' }`);
        lines.push(`image: ${ (c as any).image || '' }`);
        lines.push(`scheduleWeekdays: ${ (c as any).scheduleWeekdays || '' }`);
        lines.push('');
      }

      lines.push('--- TASKS ---');
      for (const t of tasks) {
        lines.push(`id: ${ (t as any).id } title: ${ (t as any).title } completed: ${ (t as any).completed }`);
      }
      lines.push('');

      lines.push('--- CATEGORIES ---');
      for (const cat of categories) {
        lines.push(`id: ${ (cat as any).id } name: ${ (cat as any).name }`);
      }

      const out = lines.join('\n');
      const outDir = path.resolve(process.cwd(), 'public');
      try { await fs.mkdir(outDir, { recursive: true }); } catch (e) {}
      const outPath = path.join(outDir, 'promt-site.ia');
      // Include contacts from database (if available)
      try {
        lines.push('');
        lines.push('--- CONTACTS (/contacts) ---');
        const sections = ['ramais','departments','companies','setor','cargos'];
        for (const section of sections) {
          const items = await storage.getContactsByKind(section);
          lines.push(`section: ${section}`);
          for (const it of items as any[]) {
            if (section === 'ramais') {
              lines.push(`- name: ${it.name || ''}`);
              lines.push(`  ramal: ${it.number || ''}`);
              lines.push(`  departamento: ${it.department || ''}`);
              if (it.setor) lines.push(`  setor: ${it.setor}`);
              if (it.image) lines.push(`  image: ${it.image}`);
            } else {
              lines.push(`- name: ${it.name || ''}`);
              if (it.image) lines.push(`  image: ${it.image}`);
            }
          }
          lines.push('');
        }
      } catch (e) {
        // ignore failures to read contacts
      }
      await fs.writeFile(outPath, lines.join('\n'), 'utf8');
      console.log('Wrote site prompt to', outPath);
    } catch (err) {
      console.error('Failed to generate site prompt:', err);
    }
  }

  const envPromptMs = Number(process.env.SITE_PROMPT_INTERVAL_MS || '');
  const promptMs = (Number.isFinite(envPromptMs) && envPromptMs > 0) ? envPromptMs : 60 * 60 * 1000; // default 1h
  // run once now
  generateSitePrompt().catch(() => {});
  _promptInterval = setInterval(() => generateSitePrompt().catch(() => {}), promptMs);
}

export function stopScheduler() {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
  }
  if (_promptInterval) {
    clearInterval(_promptInterval);
    _promptInterval = null;
  }
}
