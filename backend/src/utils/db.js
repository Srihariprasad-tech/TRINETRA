import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
// Also load backend/.env if present (deployment container). Non-overriding.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/nexnetra';

// Managed Postgres providers (Neon, Supabase, AWS RDS, etc.) require SSL, and
// their certs are not in the default CA bundle. Enable SSL for remote/production
// connections; keep it OFF for local (localhost) development.
const isLocal = /(^|@|\/\/)(localhost|127\.0\.0\.1|::1)/.test(connectionString);
const useSsl = !isLocal && (
  process.env.NODE_ENV === 'production' ||
  process.env.DATABASE_SSL === 'true' ||
  /sslmode=require/i.test(connectionString)
);

const pool = new pg.Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function getClient() {
  return pool.connect();
}

export default pool;
