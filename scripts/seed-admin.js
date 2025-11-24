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
  console.error('DATABASE_URL not set in .env');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const username = 'admin';
    const res = await client.query('SELECT id FROM users WHERE username = $1', [username]);
    if (res.rows.length === 0) {
      const password = env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'admin';
      const salt = crypto.randomBytes(16).toString('hex');
      const iterations = 100000;
      const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
      await client.query('INSERT INTO users (username, password_hash, salt, iterations) VALUES ($1, $2, $3, $4)', [username, hash, salt, iterations]);
      console.log('Created admin user in database (username=admin)');
    } else {
      console.log('Admin user already exists in database');
    }
  } catch (err) {
    console.error('Failed to seed admin user:', err);
    process.exitCode = 2;
  } finally {
    await client.end();
  }
}

main();
