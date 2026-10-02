/**
 * Supabase direct hosts (db.<ref>.supabase.co) are IPv6-only. On IPv4 networks the same database is
 * reachable through the Session pooler (aws-N-<region>.pooler.supabase.com:5432, user postgres.<ref>),
 * whose region is not part of the direct URL, so it is found by trying each region.
 */
const { Client } = require('pg');

const REGIONS = [
  'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-2', 'eu-north-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'ca-central-1', 'sa-east-1',
  'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
];

function directProjectRef(url) {
  try {
    const m = new URL(url).hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function poolerUrl(url, host) {
  const u = new URL(url);
  u.username = `postgres.${directProjectRef(url)}`;
  u.hostname = host;
  u.port = '5432';
  return u.toString();
}

async function tryHost(url, host) {
  const client = new Client({ connectionString: poolerUrl(url, host), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10_000 });
  try {
    await client.connect();
    await client.query('select 1');
    return { ok: true };
  } catch (err) {
    return { ok: false, passwordRejected: /password authentication failed/i.test(err.message), message: err.message };
  } finally {
    await client.end().catch(() => {});
  }
}

/** Session pooler URL for a Supabase direct URL, or null. Throws when the pooler is found but rejects the password. */
async function findSessionPooler(url) {
  if (!directProjectRef(url)) return null;
  const hosts = ['aws-0', 'aws-1'].flatMap((prefix) => REGIONS.map((r) => `${prefix}-${r}.pooler.supabase.com`));
  for (let i = 0; i < hosts.length; i += 6) {
    const batch = hosts.slice(i, i + 6);
    const results = await Promise.all(batch.map((h) => tryHost(url, h)));
    const found = results.findIndex((r) => r.ok);
    if (found >= 0) return { url: poolerUrl(url, batch[found]), host: batch[found] };
    const rejected = results.findIndex((r) => r.passwordRejected);
    if (rejected >= 0) {
      const err = new Error(`Found your Supabase pooler (${batch[rejected]}) but it rejected the database password in DATABASE_URL.`);
      err.code = 'PASSWORD_REJECTED';
      throw err;
    }
  }
  return null;
}

module.exports = { directProjectRef, findSessionPooler };
