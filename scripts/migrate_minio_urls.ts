import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Import storage from server
async function run() {
  // load storage after dotenv so DB env vars are available
  const { storage } = await import('../server/storage');
  console.log('Starting MinIO URL migration (TS)...');

  const cards = await storage.getAllCards();
  console.log(`Found ${cards.length} cards`);

  const presignedRegex = /https?:\/\/[\w.-]+(?::\d+)?\/.+\/(.+)\?(?:.*X-Amz-Signature=.*|.*X-Amz-Expires=.*)/i;

  let updatedCount = 0;

  for (const card of cards) {
    let changed = false;
    const copy: any = { ...card };

    if (copy.image && typeof copy.image === 'string') {
      const m = copy.image.match(presignedRegex);
      if (m) {
        const fileName = m[1];
        const newUrl = `/api/files/${encodeURIComponent(fileName)}`;
        copy.image = newUrl;
        changed = true;
      }
    }

    if (copy.scheduleWeekdays && typeof copy.scheduleWeekdays === 'string') {
      try {
        const parsed = JSON.parse(copy.scheduleWeekdays);
        if (Array.isArray(parsed)) {
          let innerChanged = false;
          const mapped = parsed.map((entry: any) => {
            if (entry && entry.image && typeof entry.image === 'string') {
              const m = String(entry.image).match(presignedRegex);
              if (m) {
                entry.image = `/api/files/${encodeURIComponent(m[1])}`;
                innerChanged = true;
              }
            }
            return entry;
          });
          if (innerChanged) {
            copy.scheduleWeekdays = JSON.stringify(mapped);
            changed = true;
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    }

    if (changed) {
      try {
        const payload = { ...copy };
        delete payload.id;
        await storage.updateCard(copy.id, payload);
        updatedCount++;
        console.log(`Updated card ${copy.id}`);
      } catch (e) {
        console.error(`Failed to update card ${copy.id}:`, e);
      }
    }
  }

  console.log(`Cards updated: ${updatedCount}`);

  // Update textual files in public/
  const publicDir = path.resolve(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.ia') || f.endsWith('.txt') || f.endsWith('.md'));
    let fileChanges = 0;
    for (const f of files) {
      const p = path.join(publicDir, f);
      let raw = fs.readFileSync(p, 'utf8');
      const replaced = raw.replace(/https?:\/\/[^\s"']+\/(?:intranet|[^\/]+)\/(\d[\w\-\.]+\.(?:jpg|jpeg|png|gif|webp|svg))\?[^\s"']+/ig, (match, fn) => {
        fileChanges++;
        return `/api/files/${encodeURIComponent(fn)}`;
      });
      if (replaced !== raw) {
        fs.copyFileSync(p, p + '.bak');
        fs.writeFileSync(p, replaced, 'utf8');
        console.log(`Patched file ${f}`);
      }
    }
    console.log(`Files patched: ${fileChanges}`);
  } else {
    console.log('No public directory found, skipping file patching');
  }

  console.log('Migration complete.');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
