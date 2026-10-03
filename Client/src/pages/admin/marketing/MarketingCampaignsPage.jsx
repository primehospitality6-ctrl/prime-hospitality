import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { ChevronDown, Download, Facebook, Instagram, Link2, Mail, MessageCircle, Music2, QrCode, Search, Trash2, Users } from 'lucide-react';
import api from '../../../api/client';
import { AdminPageHeader } from '../../../components/admin/AdminUi';
import { Card, ConfirmDialog, EmptyState, Field, SearchInput, useToast } from '../../../components/admin/kit';
import { SEO_DEFAULT_TITLES } from '../../../components/SeoManager';
import { cn } from '../../../utils/cn';
import { CHANNELS, CopyButton, PAGE_PATHS, campaignUrl, utmSlug } from './shared';
import MarketingNav from './MarketingNav';

const ICONS = { Instagram, Facebook, Search, Music2, MessageCircle, Mail, Users, QrCode, Link2 };

async function downloadQr(url, name) {
  const dataUrl = await QRCode.toDataURL(url, { width: 1024, margin: 2, color: { dark: '#221f20', light: '#ffffff' } });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${utmSlug(name) || 'campaign'}-qr.png`;
  a.click();
}

function QrPreview({ url }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 360, margin: 1, color: { dark: '#221f20', light: '#ffffff' } })
      .then((d) => alive && setSrc(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [url]);
  return src ? <img src={src} alt="QR code for this link" className="h-36 w-36 border border-prime-line bg-white p-1" /> : <div className="h-36 w-36 border border-prime-line bg-prime-mist" />;
}

function Step({ n, title, children }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[32px_minmax(0,1fr)]">
      <span className="grid h-8 w-8 place-items-center bg-prime-night font-display text-sm font-bold text-prime-sand">{n}</span>
      <div className="min-w-0">
        <p className="mb-3 pt-1 font-semibold text-prime-ink">{title}</p>
        {children}
      </div>
    </div>
  );
}

const EMPTY = { channel: 'instagram-bio', source: 'instagram', medium: 'social', path: '/', campaign: '', content: '' };

export default function MarketingCampaignsPage() {
  const toast = useToast();
  const [links, setLinks] = useState(null);
  const [targets, setTargets] = useState({ destinations: [], compounds: [], units: [] });
  const [form, setForm] = useState(EMPTY);
  const [advanced, setAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    api
      .adminGetSite()
      .then((res) => setLinks(res.site.campaigns?.links || []))
      .catch((err) => toast.error(err.message));
    Promise.all([api.adminGetDestinations(), api.adminGetCompounds(), api.adminGetUnits()])
      .then(([d, c, u]) =>
        setTargets({
          destinations: d.items || [],
          compounds: c.items || [],
          units: (u.items || []).filter((x) => x.published !== false),
        })
      )
      .catch(() => {});
  }, [toast]);

  const channel = CHANNELS.find((c) => c.id === form.channel) || CHANNELS[0];
  const url = campaignUrl(form);
  const ready = utmSlug(form.source) && utmSlug(form.campaign);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const pageLabel = useMemo(() => {
    const map = new Map(Object.entries(PAGE_PATHS).map(([k, p]) => [p, SEO_DEFAULT_TITLES[k]]));
    targets.destinations.forEach((d) => map.set(`/search?destination=${d.id}`, `Destination: ${d.name}`));
    targets.compounds.forEach((c) => map.set(`/search?compound=${c.id}`, `Property: ${c.name}`));
    targets.units.forEach((u) => map.set(`/listings/${u.slug}`, [u.compound, u.title].filter(Boolean).join(' — ')));
    return (path) => map.get(path) || path;
  }, [targets]);

  function pickChannel(c) {
    set({ channel: c.id, source: c.source, medium: c.medium });
    if (c.id === 'custom') setAdvanced(true);
  }

  async function persist(next, message) {
    setSaving(true);
    try {
      const res = await api.adminSaveSite({ campaigns: { links: next } });
      setLinks(res.site.campaigns?.links || next);
      toast.success(message);
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveLink() {
    const link = {
      id: Math.random().toString(36).slice(2, 10),
      name: `${channel.label} · ${form.campaign.trim()}${form.content.trim() ? ` · ${form.content.trim()}` : ''}`,
      path: form.path,
      channel: form.channel,
      source: utmSlug(form.source),
      medium: utmSlug(form.medium),
      campaign: utmSlug(form.campaign),
      content: utmSlug(form.content),
      createdAt: new Date().toISOString(),
    };
    if (await persist([link, ...links], 'Link saved to your campaign links.')) set({ content: '' });
  }

  async function removeLink() {
    if (await persist(links.filter((l) => l.id !== deleting.id), 'Link deleted.')) setDeleting(null);
  }

  const visible = (links || []).filter((l) => !query || `${l.name} ${l.campaign} ${l.source} ${pageLabel(l.path)}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <MarketingNav />
      <AdminPageHeader
        title="Campaign links"
        lede="Make a tracked link for every post, ad, story or flyer. Google Analytics and Meta then show exactly which campaign brought each visit and booking."
      />

      <Card title="Create a link" description="Three quick steps — the tracking tags are filled in for you.">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-7">
            <Step n="1" title="Where will you share it?">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {CHANNELS.map((c) => {
                  const Icon = ICONS[c.icon] || Link2;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pickChannel(c)}
                      className={cn('flex items-center gap-2 border-2 px-3 py-2.5 text-start text-xs font-semibold transition', form.channel === c.id ? 'border-prime-night bg-prime-night text-prime-sand' : 'border-prime-line bg-prime-surface hover:border-prime-ink')}
                    >
                      <Icon size={15} className="shrink-0" /> {c.label}
                    </button>
                  );
                })}
              </div>
            </Step>

            <Step n="2" title="Which page should it open?">
              <select className="prime-input" value={form.path} onChange={(e) => set({ path: e.target.value })}>
                <optgroup label="Website pages">
                  {Object.entries(SEO_DEFAULT_TITLES).map(([key, label]) => (
                    <option key={key} value={PAGE_PATHS[key]}>
                      {label}
                    </option>
                  ))}
                </optgroup>
                {targets.destinations.length ? (
                  <optgroup label="Destinations (search results)">
                    {targets.destinations.map((d) => (
                      <option key={d.id} value={`/search?destination=${d.id}`}>
                        {d.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {targets.compounds.length ? (
                  <optgroup label="Properties (search results)">
                    {targets.compounds.map((c) => (
                      <option key={c.id} value={`/search?compound=${c.id}`}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {targets.units.length ? (
                  <optgroup label="Unit types">
                    {targets.units.map((u) => (
                      <option key={u.id} value={`/listings/${u.slug}`}>
                        {[u.compound, u.title].filter(Boolean).join(' — ')}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </Step>

            <Step n="3" title="Name the campaign">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Campaign name" hint="Same name for every post in one campaign, e.g. summer-2026, eid-offer.">
                  <input className="prime-input" value={form.campaign} placeholder="summer-2026" onChange={(e) => set({ campaign: e.target.value })} />
                </Field>
                <Field label="Post / ad name (optional)" hint="To compare posts inside a campaign, e.g. reel-pool, story-1.">
                  <input className="prime-input" value={form.content} placeholder="reel-pool" onChange={(e) => set({ content: e.target.value })} />
                </Field>
              </div>
              <button type="button" onClick={() => setAdvanced((a) => !a)} className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-prime-muted hover:text-prime-ink">
                Advanced: source & medium <ChevronDown size={13} className={cn('transition', advanced && 'rotate-180')} />
              </button>
              {advanced ? (
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field label="Source (utm_source)" hint="Who sends the visit: instagram, google, newsletter…">
                    <input className="prime-input" value={form.source} onChange={(e) => set({ source: e.target.value })} />
                  </Field>
                  <Field label="Medium (utm_medium)" hint="The type: social, cpc, email, qr…">
                    <input className="prime-input" value={form.medium} onChange={(e) => set({ medium: e.target.value })} />
                  </Field>
                </div>
              ) : null}
            </Step>
          </div>

          <div className="h-fit space-y-4 border border-prime-line bg-prime-mist/60 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted">Your link</p>
            <code className="block break-all border border-prime-line bg-white p-3 text-[11.5px] leading-relaxed">{url}</code>
            {!ready ? <p className="text-xs text-prime-muted">Add a campaign name to finish the link.</p> : null}
            <div className="flex flex-wrap gap-2">
              <CopyButton text={url} />
              <button type="button" disabled={!ready || saving} onClick={saveLink} className="prime-btn-outline disabled:opacity-50">
                {saving ? 'Saving…' : 'Save link'}
              </button>
            </div>
            <div className="flex items-end gap-3 border-t border-prime-line pt-4">
              <QrPreview url={url} />
              <button type="button" onClick={() => downloadQr(url, form.campaign || channel.label)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-prime-ink hover:text-prime-gold-deep">
                <Download size={13} /> QR code
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-8" title="Saved links" description="Every link your team has made. Copy it again any time — the numbers in Analytics keep adding up under the same campaign." actions={links?.length ? <SearchInput value={query} onChange={setQuery} placeholder="Search links…" className="w-56" /> : null}>
        {!links ? (
          <p className="text-sm text-prime-muted">Loading…</p>
        ) : !links.length ? (
          <EmptyState icon={Link2} title="No saved links yet" subtitle="Create a link above and press “Save link” to keep it here for the whole team." />
        ) : (
          <div className="-m-5 divide-y divide-prime-line">
            {visible.map((l) => {
              const c = CHANNELS.find((x) => x.id === l.channel);
              const Icon = ICONS[c?.icon] || Link2;
              const full = campaignUrl(l);
              return (
                <div key={l.id} className="grid gap-3 px-5 py-3.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                  <span className="grid h-9 w-9 place-items-center border border-prime-line bg-prime-mist text-prime-ink">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-prime-ink">{l.name || l.campaign}</p>
                    <p className="truncate text-xs text-prime-muted">
                      {pageLabel(l.path)} · {l.source}/{l.medium} · {l.createdAt ? new Date(l.createdAt).toLocaleDateString() : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CopyButton text={full} label="Copy" className="border border-prime-line px-2.5 py-1.5 text-[11px] font-semibold hover:border-prime-ink" />
                    <button type="button" title="Download QR code" onClick={() => downloadQr(full, l.name || l.campaign)} className="grid h-8 w-8 place-items-center border border-prime-line hover:border-prime-ink">
                      <QrCode size={14} />
                    </button>
                    <button type="button" title="Delete" onClick={() => setDeleting(l)} className="grid h-8 w-8 place-items-center border border-prime-line text-prime-muted hover:border-red-300 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            {!visible.length ? <p className="px-5 py-6 text-sm text-prime-muted">No links match “{query}”.</p> : null}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this link?"
        message="The link keeps working wherever it was shared — it is only removed from this list."
        confirmText="Delete"
        danger
        busy={saving}
        onConfirm={removeLink}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
