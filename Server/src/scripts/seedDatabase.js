/**
 * Create/upgrade the Postgres schema and fill an empty database
 * (from data/cms-store.json when present, otherwise the demo inventory).
 * Usage: npm run seed
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { isDatabaseConfigured, closeDatabase } = require('../config/database');
const { applySchema, seedIfEmpty } = require('../lib/postgresCms');
const { exportStore } = require('../lib/jsonCms');

async function main() {
  if (!isDatabaseConfigured()) {
    console.error('Set DATABASE_URL in Server/.env first.');
    process.exit(1);
  }
  console.log('Applying schema…');
  await applySchema();
  const result = await seedIfEmpty(exportStore());
  console.log(result.seeded ? `Filled the database from ${result.source === 'local' ? 'data/cms-store.json' : 'demo inventory'}.` : 'Database already has data — skipped.');
  await closeDatabase();
}

main().catch(async (err) => {
  console.error(err.message || err);
  await closeDatabase();
  process.exit(1);
});
