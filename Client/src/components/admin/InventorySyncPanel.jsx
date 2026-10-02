import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { cn } from '../../utils/cn';

const labelCls = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted';
const POLL_MS = 15_000;

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function KwentraCard({ onChanged }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lastFinished = useRef(null);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .adminKwentraStatus()
        .then((s) => {
          if (!alive) return;
          setStatus(s);
          const finished = s?.last?.finishedAt || null;
          if (lastFinished.current && finished && finished !== lastFinished.current) onChangedRef.current?.();
          lastFinished.current = finished;
        })
        .catch((err) => alive && setError(err.message));
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  async function syncNow() {
    setBusy(true);
    setError('');
    try {
      const report = await api.adminKwentraSync();
      lastFinished.current = report?.finishedAt || lastFinished.current;
      setStatus((s) => ({ ...s, last: report }));
      onChanged?.();
    } catch (err) {
      setError(err.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  const last = status?.last;
  const webhookUrl = status?.webhook ? status.webhook.url || `https://YOUR-API-DOMAIN${status.webhook.path}` : '';
  return (
    <section className="border border-prime-line bg-prime-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold">Kwentra PMS</h2>
          <p className="mt-1 max-w-xl text-sm text-prime-muted">
            Room types you add or edit in Kwentra appear on the website automatically as unit types (name, description,
            capacity, room numbers). Availability and prices are read live from Kwentra, and website bookings are created
            there. Photos, featured and published stay controlled here.
          </p>
        </div>
        <span
          className={cn(
            'border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
            status?.configured ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-prime-line bg-prime-mist text-prime-muted'
          )}
        >
          {status ? (status.configured ? (status.running ? 'Syncing…' : 'Connected') : 'Not connected') : '…'}
        </span>
      </div>

      {status && !status.configured ? (
        <p className="mt-4 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Add the Kwentra API credentials to <span className="font-mono text-xs">Server/.env</span> and restart the API, then
          set each property&apos;s Kwentra tenant ID on the{' '}
          <Link to="/admin/compounds" className="font-semibold underline underline-offset-4">
            Properties
          </Link>{' '}
          page. Until then, units can only be added by hand in the admin.
        </p>
      ) : null}

      {status?.configured && status.tenants ? (
        <div className="mt-4 border border-prime-line px-4 py-3 text-sm">
          <p className={labelCls}>Kwentra tenants</p>
          {status.tenants.properties.length ? (
            <ul className="space-y-0.5">
              {status.tenants.properties.map((p) => (
                <li key={p.id}>
                  {p.name} — <span className="font-mono text-xs">{p.tenantId}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {status.tenants.propertiesWithoutTenant ? (
            <p className="mt-1 text-xs text-prime-muted">
              {status.tenants.propertiesWithoutTenant} propert{status.tenants.propertiesWithoutTenant === 1 ? 'y has' : 'ies have'} no
              tenant ID{status.tenants.defaultTenant ? ' and use the default tenant from Server/.env' : ' — set it on the Properties page'}.
            </p>
          ) : null}
        </div>
      ) : null}

      {status?.configured ? (
        <div className="mt-4 space-y-1 text-sm text-prime-muted">
          <p>
            Instant: Kwentra notifies the website on every inventory change.{' '}
            {status.autoSyncMinutes
              ? `Backup check every ${status.autoSyncMinutes} minute${status.autoSyncMinutes === 1 ? '' : 's'}.`
              : 'Backup check is off.'}
          </p>
          <p>
            {last ? `Last sync ${formatTime(last.finishedAt)}` : 'No sync yet since the API started'}
            {status.lastTrigger ? ` · last trigger: ${status.lastTrigger.reason}` : ''}.
          </p>
        </div>
      ) : null}

      {status?.webhook ? (
        <div className="mt-4 border border-prime-line px-4 py-3">
          <p className={labelCls}>Webhook for Kwentra</p>
          <p className="break-all font-mono text-xs">{webhookUrl}</p>
          <p className="mt-1 text-xs text-prime-muted">
            Give Kwentra this URL for room type, room, property and destination changes
            {status.webhook.url ? '' : ' (set PUBLIC_API_URL in Server/.env to show the real address)'}.{' '}
            {status.webhook.secretConfigured
              ? 'Protected by KWENTRA_WEBHOOK_SECRET (send it in the X-Kwentra-Secret header).'
              : 'Set KWENTRA_WEBHOOK_SECRET in Server/.env before going live.'}
          </p>
        </div>
      ) : null}

      {last ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ['Unit types', last.units],
            ['Properties', last.properties],
            ['Destinations', last.destinations],
          ]
            .filter(([label, counts]) => label === 'Unit types' || counts?.created || counts?.updated)
            .map(([label, counts]) => (
            <div key={label} className="border border-prime-line px-4 py-3">
              <p className={labelCls}>{label}</p>
              <p className="text-sm">
                <span className="font-semibold">{counts?.created || 0}</span> new ·{' '}
                <span className="font-semibold">{counts?.updated || 0}</span> updated
                {counts?.unchanged != null ? ` · ${counts.unchanged} unchanged` : ''}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {last?.incomplete?.count ? (
        <div className="mt-4 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p>
            <span className="font-semibold">{last.incomplete.count}</span> unit type(s) from Kwentra are hidden until every field is
            filled (usually the Google Drive photos folder).{' '}
            <Link to="/admin/units" className="font-semibold underline underline-offset-4">
              Fill them in
            </Link>
          </p>
          <ul className="mt-2 list-disc space-y-0.5 ps-5 text-xs">
            {last.incomplete.items.map((u) => (
              <li key={u.id}>
                {u.title} — missing {u.missing.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {last?.errors?.length ? (
        <div className="mt-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {last.errors.map((e) => (
            <p key={e.kind + e.message}>
              <span className="font-semibold capitalize">{e.kind}:</span> {e.message}
            </p>
          ))}
          {last.needFromKwentra?.length ? (
            <ul className="mt-2 list-disc ps-5 text-xs">
              {last.needFromKwentra.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <button type="button" className="prime-btn mt-5" disabled={busy || !status?.configured} onClick={syncNow}>
        {busy ? 'Syncing…' : 'Sync now'}
      </button>
    </section>
  );
}

export default function InventorySyncPanel({ onChanged }) {
  return <KwentraCard onChanged={onChanged} />;
}
