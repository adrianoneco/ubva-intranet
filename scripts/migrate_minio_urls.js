#!/usr/bin/env node
/*
  Migration script: replace stored presigned MinIO URLs (pointing to wrong host)
  with app proxy URLs /api/files/<fileName>.

  Usage: from repo root
    node scripts/migrate_minio_urls.js

  It will:
  - load dotenv
  - require server/storage to get all cards and update them
  - replace card.image and scheduleWeekdays entries with proxy URLs when matching presigned patterns
  - update files under public/ replacing occurrences in textual files (e.g., .ia)

  NOTE: run a backup before executing in production.
*/

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

async function run() {
  console.log('Starting MinIO URL migration...');

  // load storage module from server (it should export getAllCards and updateCard)
  const storagePath = path.resolve(process.cwd(), 'server', 'storage.js');
  if (!fs.existsSync(storagePath)) {
    console.error('Could not find server/storage.js; aborting.');
    process.exit(1);
  }

  const storage = require(storagePath);
  if (!storage.getAllCards || !storage.updateCard) {
    console.error('storage module does not expose getAllCards/updateCard; aborting.');
    process.exit(1);
  }

  const cards = await storage.getAllCards();
  console.log(`Found ${cards.length} cards`);

  const presignedRegex = /https?:\/\/[\w.-]+(?::\d+)?\/.+\/(.+)\?(?:.*X-Amz-Signature=.*|.*X-Amz-Expires=.*)/i;

  let updatedCount = 0;

  for (const card of cards) {
    let changed = false;
    const copy = { ...card };

    // image
    if (copy.image && typeof copy.image === 'string') {
      const m = copy.image.match(presignedRegex);
      if (m) {
        const fileName = m[1];
        const newUrl = `/api/files/${encodeURIComponent(fileName)}`;
        copy.image = newUrl;
        changed = true;
      }
    }

    // scheduleWeekdays (stored JSON string)
    if (copy.scheduleWeekdays && typeof copy.scheduleWeekdays === 'string') {
      try {
        const parsed = JSON.parse(copy.scheduleWeekdays);
        if (Array.isArray(parsed)) {
          let innerChanged = false;
          const mapped = parsed.map(entry => {
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
        await storage.updateCard(copy.id, copy);
        updatedCount++;
        console.log(`Updated card ${copy.id}`);
      } catch (e) {
        console.error(`Failed to update card ${copy.id}:`, e);
      }
    }
  }

  console.log(`Cards updated: ${updatedCount}`);

  // Now update textual files in public/ (e.g., promt-site.ia)
  const publicDir = path.resolve(process.cwd(), 'public');
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

  console.log('Migration complete.');
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
