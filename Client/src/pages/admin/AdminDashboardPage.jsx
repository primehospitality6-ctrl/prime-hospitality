import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, FileText, Home, Megaphone, RefreshCw, Store } from 'lucide-react';
import api from '../../api/client';
import { AdminPageHeader } from '../../components/admin/AdminUi';
import { Card } from '../../components/admin/kit';
import { activeAnnouncement } from '../../context/SiteContext';

const QUICK_LINKS = [
  { to: '/admin/homepage', label: 'Edit homepage', icon: Home },
  { to: '/admin/pages', label: 'Pages & text', icon: FileText },
  { to: '/admin/marketing', label: 'Announcement & SEO', icon: Megaphone },
  { to: '/admin/settings', label: 'Business info', icon: Store },
  { to: '/admin/sync', label: 'Kwentra sync', icon: RefreshCw },
];

function buildChecks({ units, compounds, site, pixels, kwentra }) {
  const incomplete = units.filter((u) => u.published !== false && u.completeness?.complete === false).length;
  const noDetails = compounds.filter((c) => !c.address || !c.mapsUrl || !c.image).length;
  const featured = units.filter((u) => u.featured && u.published !== false).length;
  const seo = site?.seo?.pages || {};
  const seoMissing = !site?.seo?.defaultDescription && ['home', 'search', 'compounds'].some((p) => !seo[p]?.description);
  const hasTracking = Boolean(site?.tracking?.ga4Id || pixels?.metaPixelId || pixels?.facebookPixelId || pixels?.googleAdsId);
  const bar = site ? activeAnnouncement(site.announcement, 'en', new Date().toISOString().slice(0, 10)) : null;

  return [
    kwentra && {
      ok: kwentra.configured && (!kwentra.last || kwentra.last.ok),
      text: !kwentra.configured
        ? 'Kwentra is not connected — inventory is managed by hand.'
        : kwentra.last && !kwentra.last.ok
          ? 'The last Kwentra sync failed.'
          : kwentra.last
            ? `Kwentra synced ${new Date(kwentra.last.finishedAt).toLocaleString()}.`
            : 'Kwentra connected; no sync since the API started.',
      to: '/admin/sync',
    },
    {
      ok: !incomplete,
      text: incomplete
        ? `${incomplete} unit type(s) are hidden from guests until their missing fields (photos, price, details) are filled.`
        : 'Every published unit type is complete and live.',
      to: '/admin/units',
    },
    { ok: !noDetails, text: noDetails ? `${noDetails} propert(ies) are missing a photo, address or map link.` : 'All properties have photo, address and map.', to: '/admin/compounds' },
    { ok: featured >= 3, text: featured >= 3 ? `${featured} unit types featured on the homepage.` : `Only ${featured} unit type(s) featured — the homepage carousel looks best with 3+.`, to: '/admin/units' },
    { ok: !seoMissing, text: seoMissing ? 'Add SEO descriptions for the main pages.' : 'Main pages have SEO descriptions.', to: '/admin/marketing' },
    { ok: hasTracking, text: hasTracking ? 'Analytics / ad tracking is set up.' : 'No analytics or ad pixels configured.', to: '/admin/marketing' },
    { ok: true, text: bar ? `Announcement bar is live: “${bar.text}”` : 'No announcement bar running.', to: '/admin/marketing', info: true },
  ].filter(Boolean);
}

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [checks, setChecks] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .adminDashboard()
      .then(setData)
      .catch((err) => setError(err.message));
    Promise.all([
      api.adminGetUnits(),
      api.adminGetCompounds(),
      api.adminGetSite().catch(() => ({})),
      api.adminGetSettings().catch(() => ({})),
      api.adminKwentraStatus().catch(() => null),
    ])
      .then(([u, c, s, p, kwentra]) =>
        setChecks(buildChecks({ units: u.items || [], compounds: c.items || [], site: s.site || s, pixels: p.settings || p, kwentra }))
      )
      .catch(() => setChecks([]));
  }, []);

  const cards = data
    ? [
        { label: 'Destinations', value: data.counts.destinations ?? 0, to: '/admin/destinations' },
        { label: 'Properties', value: data.counts.compounds, to: '/admin/compounds' },
        { label: 'Unit types', value: data.counts.units, to: '/admin/units' },
        { label: 'Live', value: data.counts.publishedUnits, to: '/admin/units' },
        { label: 'Incomplete (hidden)', value: data.counts.incompleteUnits ?? 0, to: '/admin/units' },
        { label: 'Featured', value: data.counts.featuredUnits, to: '/admin/units' },
        { label: 'Website bookings', value: data.counts.bookings ?? 0, to: '/admin/bookings' },
        { label: 'Slides', value: data.counts.slides, to: '/admin/slideshow' },
      ]
    : [];

  return (
    <div>
      <AdminPageHeader title="Dashboard" lede="Control what guests see on the website. Rates, availability and reservations stay in Kwentra." />
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="border border-prime-line bg-prime-surface p-5 transition hover:border-prime-gold">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted">{c.label}</p>
            <p className="mt-3 font-display text-3xl font-bold tabular-nums">{c.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Needs attention" description="Quick health check of the guest website.">
          {checks === null ? (
            <p className="text-sm text-prime-muted">Checking…</p>
          ) : (
            <ul className="divide-y divide-prime-line">
              {checks.map((c) => (
                <li key={c.text}>
                  <Link to={c.to} className="group flex items-center gap-3 py-2.5 text-sm">
                    {c.ok ? (
                      <CheckCircle2 size={16} className={c.info ? 'shrink-0 text-prime-muted' : 'shrink-0 text-emerald-600'} />
                    ) : (
                      <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                    )}
                    <span className={c.ok ? 'text-prime-muted' : ''}>{c.text}</span>
                    <ArrowRight size={14} className="ms-auto shrink-0 opacity-0 transition group-hover:opacity-60" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Quick links">
          <div className="grid gap-2">
            {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className="flex items-center gap-3 border border-prime-line px-3 py-2.5 text-sm transition hover:border-prime-gold">
                <Icon size={15} className="text-prime-gold" />
                {label}
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {data && !data.databaseConfigured ? (
        <div className="mt-8 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No database connected — using local JSON. Set <code>DATABASE_URL</code> in <code>Server/.env</code> and restart the API; the schema is created
          automatically.
        </div>
      ) : null}
      {data && !data.cloudinaryConfigured ? (
        <div className="mt-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Cloudinary is not configured. Add <code>CLOUDINARY_*</code> keys to <code>Server/.env</code> for slideshow and property image uploads. Unit photos use Google
          Drive folders only.
        </div>
      ) : null}
      {data?.storage ? (
        <p className="mt-6 text-xs text-prime-muted">
          Database: {data.storage.database} · Unit photos: {data.storage.unitPhotos} · Other photos: {data.storage.otherPhotos}
          {data.updatedAt ? ` · Updated ${new Date(data.updatedAt).toLocaleString()}` : ''}
        </p>
      ) : null}
    </div>
  );
}
