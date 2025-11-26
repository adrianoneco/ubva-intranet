#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import crypto from 'crypto';

function loadEnv(envPath) {
  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    const lines = raw.split(/\r?\n/);
    const env = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx);
      let value = trimmed.slice(idx + 1);
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
    return env;
  } catch (err) {
    return {};
  }
}

const env = loadEnv(path.resolve(process.cwd(), '.env'));
const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set in .env or environment');
  process.exit(1);
}

const apply = process.argv.includes('--apply');
const dryRun = !apply;

async function main() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    console.log(dryRun ? 'Running in dry-run mode. No DB changes will be applied.' : 'Running in apply mode. DB will be modified.');

    // find users with non-empty permissions
    const res = await client.query("SELECT id, username, permissions FROM users WHERE permissions IS NOT NULL AND trim(permissions) <> '' AND permissions <> '[]'");
    if (res.rows.length === 0) {
      console.log('No users with per-user permissions found. Nothing to do.');
      return;
    }

    // normalize permission sets and group users
    const map = new Map(); // key canonical -> { perms, users: [id,...] }
    for (const row of res.rows) {
      let permsRaw = row.permissions;
      let parsed = null;
      try { parsed = JSON.parse(permsRaw); } catch (e) { console.warn(`Skipping user ${row.username} (id=${row.id}) - invalid JSON permissions: ${permsRaw}`); continue; }
      if (!Array.isArray(parsed)) { console.warn(`Skipping user ${row.username} (id=${row.id}) - permissions not an array`); continue; }
      const uniq = Array.from(new Set(parsed.map(String))).sort();
      const canonical = JSON.stringify(uniq);
      const entry = map.get(canonical) || { perms: uniq, users: [] };
      entry.users.push(row.id);
      map.set(canonical, entry);
    }

    console.log(`Found ${res.rows.length} users with per-user permissions, grouped into ${map.size} unique permission-sets.`);

    const actions = [];

    for (const [canonical, info] of map.entries()) {
      // check if a group with same permissions already exists
      const gres = await client.query('SELECT id, name FROM groups WHERE permissions = $1 LIMIT 1', [canonical]);
      let groupId = null;
      if (gres.rows.length > 0) {
        groupId = gres.rows[0].id;
        console.log(`Reusing existing group ${groupId} for permissions ${canonical}`);
      } else {
        // create a new group id
        const hash = crypto.createHash('sha1').update(canonical).digest('hex').slice(0, 12);
        groupId = `migrated-${hash}`;
        const groupName = `Migrated ${hash}`;
        console.log(`Will create group ${groupId} (${groupName}) for permissions ${canonical}`);
        actions.push({ type: 'create-group', id: groupId, name: groupName, permissions: canonical, users: info.users });
      }
      if (gres.rows.length > 0) {
        actions.push({ type: 'assign-users', id: groupId, users: info.users });
      }
    }

    if (actions.length === 0) {
      console.log('No actions to perform.');
      return;
    }

    console.log('Planned actions:');
    for (const a of actions) {
      if (a.type === 'create-group') console.log(`  Create group ${a.id} name='${a.name}' users=${a.users.length}`);
      if (a.type === 'assign-users') console.log(`  Assign ${a.users.length} users to existing group ${a.id}`);
    }

    if (dryRun) {
      console.log('\nDry-run finished. Re-run with --apply to perform the migration.');
      return;
    }

    // perform DB changes in a transaction
    await client.query('BEGIN');
    try {
      for (const a of actions) {
        if (a.type === 'create-group') {
          await client.query('INSERT INTO groups (id, name, permissions) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [a.id, a.name, a.permissions]);
          await client.query('UPDATE users SET role = $1, permissions = NULL WHERE id = ANY($2::int[])', [a.id, a.users]);
        } else if (a.type === 'assign-users') {
          await client.query('UPDATE users SET role = $1, permissions = NULL WHERE id = ANY($2::int[])', [a.id, a.users]);
        }
      }
      await client.query('COMMIT');
      console.log('Migration applied successfully.');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 2;
  } finally {
    await client.end();
  }
}

main();
