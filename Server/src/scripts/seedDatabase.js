/**
 * Create/upgrade the Postgres schema and fill an empty database
 * (from data/cms-store.json when present, otherwise the demo inventory).
 * Usage: npm run seed
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { isDatabaseConfigured, closeDatabase } = require('../config/database');
const { applySchema, seedIfEmpty } = require('../lib/postgresCms');
const { exportStore } = require('../lib/jsonCms');
const { directProjectRef, findSessionPooler } = require('../lib/supabasePooler');

const UNREACHABLE = ['ENOTFOUND', 'ENOENT', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH'];

async function connectAndApplySchema() {
  try {
    await applySchema();
  } catch (err) {
    if (!UNREACHABLE.includes(err.code) || !directProjectRef(process.env.DATABASE_URL)) throw err;
    console.log('Direct Supabase host is unreachable from this network — looking for your Session pooler…');
    await closeDatabase();
    const pooler = await findSessionPooler(process.env.DATABASE_URL);
    if (!pooler) throw new Error('Could not find the Supabase Session pooler. Paste the Session pooler string from Supabase › Connect into DATABASE_URL.');
    console.log(`Connected through ${pooler.host}. Use the Session pooler string in DATABASE_URL (locally and on Railway).`);
    process.env.DATABASE_URL = pooler.url;
    await applySchema();
  }
}

async function main() {
  if (!isDatabaseConfigured()) {
    console.error('Set DATABASE_URL in Server/.env first.');
    process.exit(1);
  }
  console.log('Applying schema…');
  await connectAndApplySchema();
  const result = await seedIfEmpty(exportStore());
  console.log(result.seeded ? `Filled the database from ${result.source === 'local' ? 'data/cms-store.json' : 'demo inventory'}.` : 'Database already has data — skipped.');
  await closeDatabase();
}

main().catch(async (err) => {
  console.error(err.message || err);
  await closeDatabase();
  process.exit(1);
});
