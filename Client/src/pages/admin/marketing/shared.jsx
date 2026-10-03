import { useState } from 'react';
import { Check, CircleAlert, CircleCheck, Copy, Monitor, Smartphone } from 'lucide-react';
import { SEO_DEFAULT_TITLES, SEO_ROUTES } from '../../../components/SeoManager';
import { brand } from '../../../theme/brand';
import { cn } from '../../../utils/cn';

export const today = () => new Date().toISOString().slice(0, 10);
export const siteOrigin = () => (brand.domain || window.location.origin).replace(/\/$/, '');
export const PAGE_PATHS = Object.fromEntries(Object.entries(SEO_ROUTES).map(([path, key]) => [key, path]));
export const SEO_PAGE_KEYS = Object.keys(SEO_DEFAULT_TITLES);

/* ——— Status rules ——— */

/** { tone, label, live } for a scheduled promotion (announcement bar or pop-up) */
export function scheduleStatus(item, hasContent, day = today()) {
  if (!item?.enabled) return { tone: 'gray', label: 'Off', live: false };
  if (!hasContent) return { tone: 'red', label: 'Needs a message', live: false };
  if (item.startsAt && day < item.startsAt) return { tone: 'blue', label: `Scheduled · ${item.startsAt}`, live: false, scheduled: true };
  if (item.endsAt && day > item.endsAt) return { tone: 'gray', label: 'Ended', live: false };
  return { tone: 'green', label: item.endsAt ? `Live until ${item.endsAt}` : 'Live', live: true };
}

export const announcementStatus = (a) => scheduleStatus(a, Boolean(a?.text?.en || a?.text?.ar));
export const popupStatus = (p) => scheduleStatus(p, Boolean(p?.title?.en || p?.title?.ar || p?.text?.en || p?.text?.ar));

/* ——— SEO analysis (Yoast / Rank Math style traffic lights) ——— */

export const TITLE_RANGE = [30, 60];
export const DESCRIPTION_RANGE = [70, 160];

export function effectiveTitle(seo, key) {
  const suffix = seo.titleSuffix || brand.name;
  return `${seo.pages?.[key]?.title || SEO_DEFAULT_TITLES[key]} · ${suffix}`;
}

export function effectiveDescription(seo, key) {
  return seo.pages?.[key]?.description || seo.defaultDescription || '';
}

/** Checklist for one page: [{ level: good|warn|bad, text }] */
export function seoChecks(seo, key) {
  const page = seo.pages?.[key] || {};
  const title = effectiveTitle(seo, key);
  const desc = effectiveDescription(seo, key);
  const checks = [];

  if (!page.title) checks.push({ level: 'warn', text: 'Uses the built-in title. Write one with the words guests search for.' });
  else checks.push({ level: 'good', text: 'Has its own SEO title.' });

  if (title.length < TITLE_RANGE[0]) checks.push({ level: 'warn', text: `Title is short (${title.length} characters). Aim for ${TITLE_RANGE[0]}–${TITLE_RANGE[1]}.` });
  else if (title.length > TITLE_RANGE[1]) checks.push({ level: 'bad', text: `Title is ${title.length} characters — Google cuts it off after about ${TITLE_RANGE[1]}.` });
  else checks.push({ level: 'good', text: `Title length is good (${title.length} characters).` });

  if (!desc) checks.push({ level: 'bad', text: 'No description — Google will pick random text from the page.' });
  else if (!page.description) checks.push({ level: 'warn', text: 'Uses the site-wide description. A page-specific one gets more clicks.' });
  else checks.push({ level: 'good', text: 'Has its own description.' });

  if (desc) {
    if (desc.length < DESCRIPTION_RANGE[0]) checks.push({ level: 'warn', text: `Description is short (${desc.length}). Aim for ${DESCRIPTION_RANGE[0]}–${DESCRIPTION_RANGE[1]} characters.` });
    else if (desc.length > DESCRIPTION_RANGE[1]) checks.push({ level: 'warn', text: `Description is ${desc.length} characters — it will be cut off around ${DESCRIPTION_RANGE[1]}.` });
    else checks.push({ level: 'good', text: `Description length is good (${desc.length} characters).` });
  }

  const duplicate = SEO_PAGE_KEYS.some((k) => k !== key && effectiveTitle(seo, k) === title);
  if (duplicate) checks.push({ level: 'bad', text: 'Another page has the same title — every page needs a unique one.' });

  checks.push(seo.ogImage ? { level: 'good', text: 'Share image is set for WhatsApp / Facebook previews.' } : { level: 'warn', text: 'No share image — links shared on WhatsApp/Facebook show no picture.' });
  return checks;
}

export function scoreOf(checks) {
  const points = { good: 1, warn: 0.5, bad: 0 };
  return Math.round((checks.reduce((sum, c) => sum + points[c.level], 0) / checks.length) * 100);
}

export const scoreTone = (score) => (score >= 80 ? 'green' : score >= 50 ? 'gold' : 'red');
export const scoreLabel = (score) => (score >= 80 ? 'Good' : score >= 50 ? 'Needs work' : 'Poor');

export function siteSeoScore(seo) {
  const scores = SEO_PAGE_KEYS.map((k) => scoreOf(seoChecks(seo, k)));
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  return {
    score: avg,
    good: scores.filter((s) => s >= 80).length,
    work: scores.filter((s) => s >= 50 && s < 80).length,
    poor: scores.filter((s) => s < 50).length,
  };
}

/* ——— Campaign channels (Shopify-style presets fill the UTM tags) ——— */

export const CHANNELS = [
  { id: 'instagram-bio', label: 'Instagram bio', source: 'instagram', medium: 'social', icon: 'Instagram' },
  { id: 'instagram-story', label: 'Instagram story', source: 'instagram', medium: 'story', icon: 'Instagram' },
  { id: 'instagram-post', label: 'Instagram post', source: 'instagram', medium: 'social', icon: 'Instagram' },
  { id: 'meta-ads', label: 'Facebook & Instagram ads', source: 'facebook', medium: 'paid-social', icon: 'Facebook' },
  { id: 'facebook-post', label: 'Facebook post', source: 'facebook', medium: 'social', icon: 'Facebook' },
  { id: 'google-ads', label: 'Google Ads', source: 'google', medium: 'cpc', icon: 'Search' },
  { id: 'tiktok', label: 'TikTok', source: 'tiktok', medium: 'social', icon: 'Music2' },
  { id: 'whatsapp', label: 'WhatsApp broadcast', source: 'whatsapp', medium: 'message', icon: 'MessageCircle' },
  { id: 'email', label: 'Email newsletter', source: 'newsletter', medium: 'email', icon: 'Mail' },
  { id: 'influencer', label: 'Influencer / creator', source: 'influencer', medium: 'referral', icon: 'Users' },
  { id: 'print', label: 'Flyer / QR code', source: 'print', medium: 'qr', icon: 'QrCode' },
  { id: 'custom', label: 'Something else', source: '', medium: '', icon: 'Link2' },
];

export const utmSlug = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._~-]/g, '');

export function campaignUrl({ path = '/', source, medium, campaign, content }) {
  const u = new URL(path || '/', `${siteOrigin()}/`);
  [
    ['utm_source', source],
    ['utm_medium', medium],
    ['utm_campaign', campaign],
    ['utm_content', content],
  ].forEach(([k, v]) => utmSlug(v) && u.searchParams.set(k, utmSlug(v)));
  return u.toString();
}

/* ——— UI pieces ——— */

/** Polaris "annotated section": explanation on the left, the form card on the right */
export function AnnotatedSection({ title, description, children, aside }) {
  return (
    <section className="grid gap-4 border-b border-prime-line py-8 first:pt-0 last:border-b-0 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="font-display text-lg font-bold text-prime-ink">{title}</h2>
        {description ? <p className="mt-1.5 text-sm leading-relaxed text-prime-muted">{description}</p> : null}
        {aside}
      </div>
      <div className="min-w-0 space-y-5 border border-prime-line bg-prime-surface p-5">{children}</div>
    </section>
  );
}

export function SegmentedControl({ value, onChange, options, size = 'md' }) {
  return (
    <div className="inline-flex border border-prime-line bg-prime-surface p-0.5">
      {options.map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          className={cn(
            'inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.12em] transition',
            size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]',
            value === id ? 'bg-prime-night text-prime-sand' : 'text-prime-muted hover:text-prime-ink'
          )}
        >
          {Icon ? <Icon size={13} /> : null}
          {label}
        </button>
      ))}
    </div>
  );
}

export const DEVICE_OPTIONS = [
  ['desktop', 'Desktop', Monitor],
  ['mobile', 'Mobile', Smartphone],
];
export const LOCALE_OPTIONS = [
  ['en', 'EN'],
  ['ar', 'AR'],
];

/** A small browser / phone mock with a fake site header, for live previews */
export function PreviewFrame({ device = 'desktop', path = '/', top, overlay, dir = 'ltr' }) {
  const mobile = device === 'mobile';
  return (
    <div className={cn('mx-auto overflow-hidden border border-prime-line bg-prime-sand shadow-premium', mobile ? 'w-[300px] rounded-[26px] border-[6px] border-prime-night' : 'w-full')}>
      {mobile ? (
        <div className="flex h-5 items-center justify-center bg-prime-night">
          <span className="h-1.5 w-14 rounded-full bg-white/20" />
        </div>
      ) : (
        <div className="flex items-center gap-2 border-b border-prime-line bg-prime-mist px-3 py-2">
          <span className="flex gap-1">
            {['bg-red-300', 'bg-amber-300', 'bg-emerald-300'].map((c) => (
              <span key={c} className={cn('h-2 w-2 rounded-full', c)} />
            ))}
          </span>
          <span className="min-w-0 flex-1 truncate border border-prime-line bg-white px-2 py-0.5 text-[10px] text-prime-muted">
            {siteOrigin()}
            {path}
          </span>
        </div>
      )}
      <div dir={dir} className="relative">
        {top}
        <div className="flex items-center justify-between border-b border-prime-line bg-prime-surface px-4 py-3">
          <span className="font-display text-sm font-bold tracking-[0.2em]">PRIME</span>
          <span className="flex gap-2">
            {(mobile ? [1] : [1, 2, 3, 4]).map((i) => (
              <span key={i} className="h-1.5 w-8 bg-prime-line" />
            ))}
          </span>
        </div>
        <div className={cn('relative bg-gradient-to-br from-[#3a3433] via-[#5b514c] to-[#a08c74]', mobile ? 'h-[380px]' : 'h-[260px]')}>
          <div className="absolute bottom-6 start-5 space-y-2">
            <span className="block h-3 w-40 bg-white/70" />
            <span className="block h-2 w-28 bg-white/40" />
          </div>
          {overlay ? <div className="absolute inset-0 grid place-items-center bg-black/45 p-4">{overlay}</div> : null}
        </div>
      </div>
    </div>
  );
}

/** Character count with a coloured bar showing the recommended range */
export function LengthMeter({ value, range }) {
  const n = String(value || '').length;
  const [min, max] = range;
  const tone = !n ? 'bg-prime-line' : n < min ? 'bg-amber-400' : n > max ? 'bg-red-500' : 'bg-emerald-500';
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden bg-prime-mist">
        <div className={cn('h-full transition-all', tone)} style={{ width: `${Math.min(100, (n / (max * 1.25)) * 100)}%` }} />
      </div>
      <span className={cn('text-[11px] tabular-nums', n > max ? 'text-red-600' : 'text-prime-muted')}>
        {n}/{max}
      </span>
    </div>
  );
}

const DOT = { good: 'bg-emerald-500', warn: 'bg-amber-400', bad: 'bg-red-500' };

export function CheckList({ checks }) {
  return (
    <ul className="space-y-2">
      {checks.map((c) => (
        <li key={c.text} className="flex items-start gap-2.5 text-sm">
          <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', DOT[c.level])} />
          <span className={c.level === 'good' ? 'text-prime-muted' : 'text-prime-ink'}>{c.text}</span>
        </li>
      ))}
    </ul>
  );
}

const RING = { green: '#10b981', gold: '#b8935a', red: '#ef4444' };

export function ScoreRing({ score, size = 64, label = true }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const tone = scoreTone(score);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-prime-mist" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={RING[tone]} strokeWidth="6" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} strokeLinecap="round" />
      </svg>
      {label ? <span className="absolute inset-0 grid place-items-center font-display text-sm font-bold tabular-nums">{score}</span> : null}
    </div>
  );
}

export function GooglePreview({ url, title, description, mobile = false }) {
  return (
    <div className={cn('border border-prime-line bg-white p-4 font-sans leading-snug', mobile ? 'max-w-[360px]' : '')}>
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full border border-[#dadce0] bg-[#f1f3f4] text-[11px] font-bold text-[#202124]">P</span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] text-[#202124]">{brand.name}</span>
          <span className="block truncate text-[11px] text-[#4d5156]">{url}</span>
        </span>
      </div>
      <p className={cn('mt-2 text-[#1a0dab]', mobile ? 'line-clamp-2 text-[17px]' : 'truncate text-[19px]')}>{title}</p>
      <p className="mt-1 line-clamp-2 text-[13px] text-[#4d5156]">{description || 'No description yet — Google will choose text from the page.'}</p>
    </div>
  );
}

export function SocialPreview({ url, title, description, image }) {
  let host = '';
  try {
    host = new URL(url).host;
  } catch {
    host = url;
  }
  return (
    <div className="max-w-[420px] overflow-hidden border border-prime-line bg-[#f0f2f5]">
      {image ? (
        <img src={image} alt="" className="aspect-[1.91/1] w-full object-cover" />
      ) : (
        <div className="grid aspect-[1.91/1] w-full place-items-center bg-prime-mist text-xs text-prime-muted">No share image</div>
      )}
      <div className="px-3 py-2.5">
        <p className="truncate text-[11px] uppercase text-[#65676b]">{host}</p>
        <p className="truncate text-[15px] font-semibold text-[#050505]">{title}</p>
        <p className="line-clamp-1 text-[13px] text-[#65676b]">{description}</p>
      </div>
    </div>
  );
}

export function CopyButton({ text, label = 'Copy link', className }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the text is still selectable */
    }
  }
  return (
    <button type="button" onClick={copy} className={cn('inline-flex items-center gap-1.5', className || 'prime-btn')}>
      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : label}
    </button>
  );
}

export function StatusLine({ ok, children }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', ok ? 'text-emerald-700' : 'text-prime-muted')}>
      {ok ? <CircleCheck size={14} /> : <CircleAlert size={14} />}
      {children}
    </span>
  );
}

/** "Start from a template" chips */
export function TemplatePicker({ templates, onPick }) {
  return (
    <div className="flex flex-wrap gap-2">
      {templates.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onPick(t)}
          className="border border-prime-line bg-prime-surface px-3 py-1.5 text-xs font-semibold text-prime-ink transition hover:border-prime-gold hover:bg-prime-gold/10"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
