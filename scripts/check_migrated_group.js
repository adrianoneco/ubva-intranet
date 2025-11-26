#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

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

(async function main(){
  const env = loadEnv(path.resolve(process.cwd(), '.env'));
  const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const groupsRes = await client.query("SELECT id, name, permissions FROM groups ORDER BY id");
    console.log('Groups:');
    for (const g of groupsRes.rows) {
      console.log(`- ${g.id} (${g.name}): ${g.permissions}`);
    }
    console.log('\nUsers with migrated-* role:');
    const ures = await client.query("SELECT id, username, display_name, role, permissions FROM users WHERE role LIKE 'migrated-%'");
    if (ures.rows.length === 0) console.log('  (none)');
    for (const u of ures.rows) {
      console.log(`- id=${u.id} username=${u.username} display_name=${u.display_name} role=${u.role} permissions=${u.permissions}`);
    }

    console.log('\nUsers with admin role:');
    const ares = await client.query("SELECT id, username, display_name, role, permissions FROM users WHERE role = 'admin'");
    if (ares.rows.length === 0) console.log('  (none)');
    for (const u of ares.rows) {
      console.log(`- id=${u.id} username=${u.username} display_name=${u.display_name} role=${u.role} permissions=${u.permissions}`);
    }
  } catch (e) {
    console.error('Failed to query DB', e);
  } finally {
    await client.end();
  }
})();
