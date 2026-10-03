import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChartColumn, Check, Link2, MessageSquareText, PanelTop, Search } from 'lucide-react';
import api from '../../../api/client';
import { AdminPageHeader } from '../../../components/admin/AdminUi';
import { Badge, useToast } from '../../../components/admin/kit';
import { cn } from '../../../utils/cn';
import { ScoreRing, announcementStatus, popupStatus, scoreLabel, siteSeoScore } from './shared';
import { TRACKERS } from './MarketingTrackingPage';

const SEASONS = [
  { name: 'Ramadan', when: 'Start 2 weeks before', idea: 'Long-stay and family rates; iftar-friendly units near the city.' },
  { name: 'Eid holidays', when: 'Start 10 days before', idea: 'Short getaways — push last available dates on the North Coast.' },
  { name: 'Summer season', when: 'From April', idea: 'Early-booking offers for July & August; pool and sea-view units first.' },
  { name: 'Winter & New Year', when: 'From November', idea: 'City stays, monthly rates for expats and remote workers.' },
];

function SetupGuide({ tasks }) {
  const done = tasks.filter((t) => t.done).length;
  const firstOpen = tasks.find((t) => !t.done)?.id;
  const [open, setOpen] = useState(firstOpen);
  useEffect(() => setOpen(firstOpen), [firstOpen]);

  if (done === tasks.length) {
    return (
      <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
        <Check size={18} /> Setup complete — every marketing basic is in place.
      </div>
    );
  }

  return (
    <section className="border border-prime-line bg-prime-surface">
      <div className="border-b border-prime-line px-5 py-4">
        <h2 className="font-display text-lg font-bold text-prime-ink">Setup guide</h2>
        <p className="mt-0.5 text-xs text-prime-muted">The basics every hospitality website needs. Work through them top to bottom.</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden bg-prime-mist">
            <div className="h-full bg-prime-night transition-all" style={{ width: `${(done / tasks.length) * 100}%` }} />
          </div>
          <span className="text-xs font-semibold tabular-nums text-prime-muted">
            {done} of {tasks.length} done
          </span>
        </div>
      </div>
      <ul>
        {tasks.map((t) => {
          const expanded = open === t.id;
          return (
            <li key={t.id} className={cn('border-b border-prime-line last:border-b-0', expanded && 'bg-prime-mist/50')}>
              <button type="button" onClick={() => setOpen(expanded ? null : t.id)} className="flex w-full items-center gap-3 px-5 py-3 text-start">
                <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full border', t.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-dashed border-prime-muted')}>
                  {t.done ? <Check size={12} strokeWidth={3} /> : null}
                </span>
                <span className={cn('text-sm font-semibold', t.done ? 'text-prime-muted line-through decoration-prime-line' : 'text-prime-ink')}>{t.title}</span>
              </button>
              {expanded ? (
                <div className="flex flex-wrap items-end justify-between gap-3 px-5 pb-4 ps-[52px]">
                  <p className="max-w-xl text-sm leading-relaxed text-prime-muted">{t.body}</p>
                  <Link to={t.to} className="prime-btn">
                    {t.done ? 'Review' : t.cta}
                  </Link>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ToolCard({ to, icon: Icon, title, badge, children }) {
  return (
    <Link to={to} className="group flex flex-col border border-prime-line bg-prime-surface p-5 transition hover:border-prime-ink">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center border border-prime-line bg-prime-mist text-prime-ink">
          <Icon size={18} />
        </span>
        {badge}
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-prime-ink">{title}</h3>
      <div className="mt-1 flex-1 text-sm text-prime-muted">{children}</div>
      <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-prime-ink group-hover:text-prime-gold-deep">
        Manage <ArrowRight size={13} className="transition group-hover:translate-x-0.5 rtl:rotate-180" />
      </span>
    </Link>
  );
}

export default function MarketingOverviewPage() {
  const toast = useToast();
  const [site, setSite] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    Promise.all([api.adminGetSite(), api.adminGetSettings()])
      .then(([s, st]) => {
        setSite(s.site);
        setSettings(st.settings || {});
      })
      .catch((err) => toast.error(err.message));
  }, [toast]);

  const data = useMemo(() => {
    if (!site || !settings) return null;
    const bar = announcementStatus(site.announcement);
    const popup = popupStatus(site.popup);
    const seo = siteSeoScore(site.seo);
    const valueOf = (t) => (t.store === 'site' ? site.tracking?.[t.key] : settings[t.key]);
    const trackers = TRACKERS.map((t) => ({ ...t, on: Boolean(valueOf(t) && t.valid(valueOf(t))) }));
    const links = site.campaigns?.links || [];
    const tasks = [
      {
        id: 'description',
        title: 'Write a short description of Prime for Google',
        body: 'This is the grey text under your website in Google and in shared links. One or two sentences: what you offer, where, and why book direct.',
        cta: 'Write description',
        to: '/admin/marketing/seo',
        done: (site.seo.defaultDescription || '').length >= 50,
      },
      {
        id: 'image',
        title: 'Upload a share image',
        body: 'The picture shown when someone sends your website on WhatsApp, Facebook or Instagram. Use a bright photo of your best property (1200×630).',
        cta: 'Upload image',
        to: '/admin/marketing/seo',
        done: Boolean(site.seo.ogImage),
      },
      {
        id: 'ga4',
        title: 'Connect Google Analytics',
        body: 'See how many people visit, where they come from and which campaigns work. Free — you only need to paste one ID.',
        cta: 'Connect Analytics',
        to: '/admin/marketing/tracking',
        done: trackers.find((t) => t.key === 'ga4Id').on,
      },
      {
        id: 'meta',
        title: 'Connect the Meta Pixel',
        body: 'Needed before running Facebook or Instagram ads, so Meta can count bookings and show ads to the right people.',
        cta: 'Connect Meta',
        to: '/admin/marketing/tracking',
        done: trackers.find((t) => t.key === 'metaPixelId').on,
      },
      {
        id: 'seo',
        title: 'Get every page to a good SEO score',
        body: `Your website pages average ${seo.score}/100. Open SEO, click the pages marked orange or red and follow the checklist.`,
        cta: 'Improve SEO',
        to: '/admin/marketing/seo',
        done: seo.score >= 80,
      },
      {
        id: 'campaign',
        title: 'Create your first campaign link',
        body: 'Put a tracked link in your Instagram bio, ads and WhatsApp broadcasts so you know which ones bring bookings.',
        cta: 'Create a link',
        to: '/admin/marketing/campaigns',
        done: links.length > 0,
      },
      {
        id: 'promo',
        title: 'Run a promotion on the website',
        body: 'Use the announcement bar or a pop-up for your current offer, a new opening or the season. Schedule it and it turns off by itself.',
        cta: 'Set up a promotion',
        to: '/admin/marketing/announcement',
        done: bar.live || bar.scheduled || popup.live || popup.scheduled,
      },
    ];
    return { bar, popup, seo, trackers, links, tasks };
  }, [site, settings]);

  return (
    <div>
      <AdminPageHeader title="Marketing" lede="Everything for bringing guests to the website and booking direct — promotions, Google & social previews, tracking and campaign links. Nothing here touches the PMS." />
      {!data ? (
        <p className="text-sm text-prime-muted">Loading…</p>
      ) : (
        <div className="space-y-8">
          <SetupGuide tasks={data.tasks} />

          <div>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted">Your marketing tools</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <ToolCard to="/admin/marketing/announcement" icon={PanelTop} title="Announcement bar" badge={<Badge tone={data.bar.tone}>{data.bar.label}</Badge>}>
                {site.announcement.text?.en ? <p className="line-clamp-2">“{site.announcement.text.en}”</p> : <p>A strip above the menu for offers and news.</p>}
              </ToolCard>
              <ToolCard to="/admin/marketing/popup" icon={MessageSquareText} title="Pop-up" badge={<Badge tone={data.popup.tone}>{data.popup.label}</Badge>}>
                {site.popup.title?.en ? <p className="line-clamp-2">“{site.popup.title.en}”</p> : <p>A window for an offer, opening or WhatsApp nudge.</p>}
              </ToolCard>
              <ToolCard
                to="/admin/marketing/seo"
                icon={Search}
                title="SEO & sharing"
                badge={<ScoreRing score={data.seo.score} size={44} />}
              >
                <p>
                  {scoreLabel(data.seo.score)} · {data.seo.good} of {data.seo.good + data.seo.work + data.seo.poor} pages good
                </p>
              </ToolCard>
              <ToolCard
                to="/admin/marketing/tracking"
                icon={ChartColumn}
                title="Tracking & pixels"
                badge={<Badge tone={data.trackers.some((t) => t.on) ? 'green' : 'gray'}>{data.trackers.filter((t) => t.on).length} of {data.trackers.length} connected</Badge>}
              >
                <div className="flex flex-wrap gap-1.5">
                  {data.trackers.map((t) => (
                    <span key={t.key} className={cn('inline-flex items-center gap-1 border px-2 py-0.5 text-[11px]', t.on ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-prime-line text-prime-muted')}>
                      {t.on ? <Check size={11} /> : null}
                      {t.name}
                    </span>
                  ))}
                </div>
              </ToolCard>
              <ToolCard to="/admin/marketing/campaigns" icon={Link2} title="Campaign links" badge={<Badge tone={data.links.length ? 'gold' : 'gray'}>{data.links.length} saved</Badge>}>
                {data.links[0] ? <p className="truncate">Latest: {data.links[0].name}</p> : <p>Tracked links and QR codes for posts, ads and flyers.</p>}
              </ToolCard>
            </div>
          </div>

          <section className="border border-prime-line bg-prime-surface">
            <div className="border-b border-prime-line px-5 py-4">
              <h2 className="font-display text-lg font-bold text-prime-ink">Season planner</h2>
              <p className="mt-0.5 text-xs text-prime-muted">The busy moments for stays in Egypt, and when to start promoting them.</p>
            </div>
            <div className="grid divide-y divide-prime-line sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:divide-x">
              {SEASONS.map((s) => (
                <div key={s.name} className="p-5">
                  <p className="font-semibold text-prime-ink">{s.name}</p>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-prime-gold-deep">{s.when}</p>
                  <p className="mt-2 text-sm leading-relaxed text-prime-muted">{s.idea}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
