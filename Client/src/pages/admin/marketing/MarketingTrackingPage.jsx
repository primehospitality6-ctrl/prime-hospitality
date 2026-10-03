import { useEffect, useState } from 'react';
import { ChartColumn, ChevronDown, ExternalLink, Facebook, Search, Tag } from 'lucide-react';
import api from '../../../api/client';
import { AdminPageHeader } from '../../../components/admin/AdminUi';
import { Badge, SaveBar, useSiteSection, useToast } from '../../../components/admin/kit';
import { useSite } from '../../../context/SiteContext';
import { cn } from '../../../utils/cn';
import MarketingNav from './MarketingNav';

/** store: 'settings' (pixel IDs) or 'site' (GA4 lives in the site document) */
export const TRACKERS = [
  {
    key: 'metaPixelId',
    store: 'settings',
    name: 'Meta Pixel',
    sub: 'Facebook & Instagram ads',
    icon: Facebook,
    color: 'text-[#1877f2]',
    placeholder: '1234567890123456',
    valid: (v) => /^\d{10,20}$/.test(v),
    format: 'A 15–16 digit number',
    why: 'Counts visits and bookings from your Facebook/Instagram ads, and lets you retarget people who looked at a unit.',
    steps: ['Open Meta Events Manager (business.facebook.com/events_manager).', 'Pick your pixel (or create one under “Connect data sources › Web”).', 'Copy the Pixel ID number shown under its name.'],
    link: 'https://business.facebook.com/events_manager',
  },
  {
    key: 'ga4Id',
    store: 'site',
    name: 'Google Analytics 4',
    sub: 'Website visitors & sources',
    icon: ChartColumn,
    color: 'text-[#e37400]',
    placeholder: 'G-XXXXXXXXXX',
    valid: (v) => /^G-[A-Z0-9]{4,20}$/i.test(v),
    format: 'Starts with G-',
    why: 'Shows how many people visit, where they come from (Instagram, Google, WhatsApp…) and which campaign links work.',
    steps: ['Open analytics.google.com › Admin (gear icon).', 'Under Property, open “Data streams” and pick the website stream.', 'Copy the “Measurement ID” (starts with G-).'],
    link: 'https://analytics.google.com/',
  },
  {
    key: 'googleAdsId',
    store: 'settings',
    name: 'Google Ads',
    sub: 'Search & display ads',
    icon: Search,
    color: 'text-[#4285f4]',
    placeholder: 'AW-123456789',
    valid: (v) => /^AW-[A-Z0-9-]+$/i.test(v),
    format: 'Starts with AW-',
    why: 'Measures bookings from Google Ads so Google can show your ads to people more likely to book.',
    steps: ['Open ads.google.com › Goals › Conversions.', 'Open a conversion action › “Tag setup” › “Install the tag yourself”.', 'Copy the ID that starts with AW-.'],
    link: 'https://ads.google.com/',
  },
  {
    key: 'gtmId',
    store: 'settings',
    name: 'Google Tag Manager',
    sub: 'Advanced — for agencies',
    icon: Tag,
    color: 'text-[#8ab4f8]',
    placeholder: 'GTM-XXXXXXX',
    valid: (v) => /^GTM-[A-Z0-9]+$/i.test(v),
    format: 'Starts with GTM-',
    why: 'Only needed if your agency manages tags in Tag Manager. If you use it, you may not need the other IDs here.',
    steps: ['Open tagmanager.google.com.', 'The container ID (GTM-…) is shown next to the container name at the top.'],
    link: 'https://tagmanager.google.com/',
  },
];

function TrackerCard({ tracker, value, onChange }) {
  const [help, setHelp] = useState(false);
  const Icon = tracker.icon;
  const v = String(value || '');
  const ok = v && tracker.valid(v);
  const invalid = v && !ok;
  return (
    <div className={cn('border bg-prime-surface', invalid ? 'border-red-200' : 'border-prime-line')}>
      <div className="flex items-start gap-4 p-5">
        <span className={cn('grid h-11 w-11 shrink-0 place-items-center border border-prime-line bg-prime-mist', tracker.color)}>
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold text-prime-ink">{tracker.name}</h2>
            {ok ? <Badge tone="green">Connected</Badge> : invalid ? <Badge tone="red">Check the ID</Badge> : <Badge>Not connected</Badge>}
          </div>
          <p className="text-xs text-prime-muted">{tracker.sub}</p>
          <p className="mt-2 text-sm leading-relaxed text-prime-muted">{tracker.why}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              className={cn('prime-input max-w-xs font-mono text-sm', invalid && 'border-red-300')}
              value={v}
              placeholder={tracker.placeholder}
              onChange={(e) => onChange(e.target.value.trim())}
              aria-label={`${tracker.name} ID`}
            />
            {v ? (
              <button type="button" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-prime-muted hover:text-red-600" onClick={() => onChange('')}>
                Disconnect
              </button>
            ) : null}
          </div>
          <p className={cn('mt-1 text-[11px]', invalid ? 'text-red-600' : 'text-prime-muted')}>{invalid ? `This doesn’t look right — ${tracker.format.toLowerCase()}.` : tracker.format}</p>
        </div>
      </div>
      <button type="button" onClick={() => setHelp((h) => !h)} className="flex w-full items-center justify-between border-t border-prime-line px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-prime-muted hover:text-prime-ink">
        Where do I find this ID?
        <ChevronDown size={14} className={cn('transition', help && 'rotate-180')} />
      </button>
      {help ? (
        <div className="border-t border-prime-line bg-prime-mist/50 px-5 py-4">
          <ol className="list-decimal space-y-1.5 ps-5 text-sm text-prime-ink">
            {tracker.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <a href={tracker.link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-prime-gold-deep hover:text-prime-ink">
            Open {tracker.name} <ExternalLink size={12} />
          </a>
        </div>
      ) : null}
    </div>
  );
}

export default function MarketingTrackingPage() {
  const toast = useToast();
  const { replace } = useSite();
  const site = useSiteSection(api, ['tracking'], replace);
  const [pixels, setPixels] = useState(null);
  const [pixelsSaved, setPixelsSaved] = useState(null);
  const [savingPixels, setSavingPixels] = useState(false);

  useEffect(() => {
    api
      .adminGetSettings()
      .then((res) => {
        setPixels(res.settings || {});
        setPixelsSaved(res.settings || {});
      })
      .catch((err) => toast.error(err.message));
  }, [toast]);

  const pixelsDirty = pixelsSaved != null && JSON.stringify(pixels) !== JSON.stringify(pixelsSaved);
  const loaded = site.loaded && pixels;
  const valueOf = (t) => (t.store === 'site' ? site.draft?.tracking?.[t.key] : pixels?.[t.key]);
  const connected = loaded ? TRACKERS.filter((t) => valueOf(t) && t.valid(valueOf(t))).length : 0;

  function onChange(t, v) {
    if (t.store === 'site') site.setDraft((d) => ({ ...d, tracking: { ...d.tracking, [t.key]: v } }));
    else setPixels((p) => ({ ...p, [t.key]: v }));
  }

  async function onSave() {
    const bad = TRACKERS.find((t) => valueOf(t) && !t.valid(valueOf(t)));
    if (bad) {
      toast.error(`${bad.name}: ${bad.format.toLowerCase()}. Fix it or clear the field.`);
      return;
    }
    let ok = true;
    if (site.dirty) ok = await site.save();
    if (ok && pixelsDirty) {
      setSavingPixels(true);
      try {
        const res = await api.adminSaveSettings(pixels);
        setPixels(res.settings);
        setPixelsSaved(res.settings);
      } catch (err) {
        ok = false;
        toast.error(err.message);
      } finally {
        setSavingPixels(false);
      }
    }
    if (ok) toast.success('Tracking saved — it’s live on the website.');
  }

  return (
    <div>
      <MarketingNav />
      <AdminPageHeader
        title="Tracking & pixels"
        lede="Paste the ID from each platform — the website adds the official tracking code by itself. Nothing loads on the admin pages."
        actions={loaded ? <Badge tone={connected ? 'green' : 'gray'}>{connected} of {TRACKERS.length} connected</Badge> : null}
      />
      {site.error ? <p className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{site.error}</p> : null}
      {!loaded ? (
        <p className="text-sm text-prime-muted">Loading…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {TRACKERS.map((t) => (
            <TrackerCard key={t.key} tracker={t} value={valueOf(t)} onChange={(v) => onChange(t, v)} />
          ))}
        </div>
      )}
      <SaveBar
        dirty={site.dirty || pixelsDirty}
        saving={site.saving || savingPixels}
        onSave={onSave}
        onDiscard={() => {
          site.discard();
          setPixels(pixelsSaved);
        }}
      />
    </div>
  );
}
