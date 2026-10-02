const { Pool, types } = require('pg');

// Keep DATE columns as 'YYYY-MM-DD' strings and timestamps as ISO strings (no local-timezone shifts).
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1114, (v) => new Date(`${v}Z`).toISOString());
types.setTypeParser(1184, (v) => new Date(v).toISOString());

function databaseUrl() {
  return String(process.env.DATABASE_URL || process.env.Database_URL || '').trim();
}

function isDatabaseConfigured() {
  const url = databaseUrl();
  return /^postgres(ql)?:\/\//i.test(url) && !url.includes('[YOUR-PASSWORD]');
}

function sslFor(url) {
  if (process.env.DATABASE_SSL === 'false') return false;
  const host = new URL(url).hostname;
  if (host === 'localhost' || host === '127.0.0.1') return false;
  return { rejectUnauthorized: process.env.DATABASE_SSL === 'verify' };
}

let pool;

function getPool() {
  if (!isDatabaseConfigured()) {
    const err = new Error('Database is not configured. Set DATABASE_URL in Server/.env');
    err.status = 503;
    throw err;
  }
  if (!pool) {
    const url = databaseUrl();
    pool = new Pool({
      connectionString: url,
      ssl: sslFor(url),
      max: Number(process.env.DATABASE_POOL_MAX) || 10,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    });
    pool.on('error', (err) => console.error('[prime] Postgres pool error:', err.message));
  }
  return pool;
}

async function query(text, params = []) {
  return getPool().query(text, params);
}

async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = { query, getPool, isDatabaseConfigured, closeDatabase };
