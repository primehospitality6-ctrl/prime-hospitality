/**
 * Write data/supabase-seed.sql: the schema plus the local JSON store as SQL, for pasting into
 * Supabase › SQL Editor when this machine cannot reach the database directly.
 * Runs the same code path as `npm run seed`, recording the statements instead of executing them.
 * Usage: npm run seed:sql
 */
const fs = require('fs');
const path = require('path');

const statements = [];

function literal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (v instanceof Date) v = v.toISOString();
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'object') v = JSON.stringify(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function render(sql, params = []) {
  return sql.replace(/\$(\d+)/g, (_, i) => literal(params[Number(i) - 1])).replace(/\s+returning \*$/i, '');
}

const recorder = {
  async query(sql, params) {
    if (/select count\(\*\)::int as n from compounds/i.test(sql)) return { rows: [{ n: 0 }] };
    if (!/^(begin|commit|rollback)$/i.test(sql.trim())) statements.push(`${render(sql, params)};`);
    return { rows: [{}] };
  },
  release() {},
};

const dbPath = require.resolve('../config/database');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: (sql, params) => recorder.query(sql, params),
    getPool: () => ({ connect: async () => recorder, query: (sql, params) => recorder.query(sql, params) }),
    isDatabaseConfigured: () => true,
    closeDatabase: async () => {},
  },
};

const { seedIfEmpty } = require('../lib/postgresCms');
const { exportStore } = require('../lib/jsonCms');

async function main() {
  await seedIfEmpty(exportStore());
  const schema = fs.readFileSync(path.join(__dirname, '../../supabase/schema.sql'), 'utf8').trim();
  const out = ['-- Prime Hospitality: schema + site data. Paste into Supabase › SQL Editor and click Run.', schema, '', 'begin;', ...statements, 'commit;', ''].join('\n');
  const file = path.join(__dirname, '../../data/supabase-seed.sql');
  fs.writeFileSync(file, out, 'utf8');

  const count = (table) => statements.filter((s) => s.startsWith(`insert into ${table} `)).length;
  console.log(
    `Wrote data/supabase-seed.sql (${Math.round(out.length / 1024)} KB): ${count('destinations')} destinations, ${count('compounds')} properties, ${count('units')} units, ${count('slideshow_slides')} slides, ${count('bookings')} bookings.`
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
