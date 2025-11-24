#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

// Simple .env parser to avoid adding dependencies
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
      // remove surrounding quotes
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
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


const migrationsDir = path.resolve(process.cwd(), 'migrations');

async function main() {
  const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set in .env');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    files.sort();

    for (const file of files) {
      const full = path.join(migrationsDir, file);
      const sql = fs.readFileSync(full, 'utf8');
      console.log(`Applying migration ${file}...`);
      await client.query(sql);
      console.log(`Applied ${file}`);
    }

    console.log('All migrations applied.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(2);
  } finally {
    await client.end();
  }
}

main();
