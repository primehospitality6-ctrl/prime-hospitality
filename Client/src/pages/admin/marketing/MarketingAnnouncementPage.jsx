import { useState } from 'react';
import { X } from 'lucide-react';
import api from '../../../api/client';
import { AdminPageHeader } from '../../../components/admin/AdminUi';
import { Badge, BilingualField, Field, SaveBar, Toggle, useSiteSection, useToast } from '../../../components/admin/kit';
import { useSite } from '../../../context/SiteContext';
import { cn } from '../../../utils/cn';
import { AnnotatedSection, DEVICE_OPTIONS, LOCALE_OPTIONS, LengthMeter, PreviewFrame, SegmentedControl, TemplatePicker, announcementStatus } from './shared';
import MarketingNav from './MarketingNav';

const TONES = [
  ['night', 'Charcoal', 'bg-[#221f20] text-white'],
  ['gold', 'Gold', 'bg-prime-gold text-[#221f20]'],
  ['sand', 'Sand', 'bg-prime-mist text-prime-ink border-b border-prime-line'],
];

const TEMPLATES = [
  {
    id: 'direct',
    label: 'Book direct',
    text: { en: 'Book direct on our website for the best rate — no booking fees', ar: 'احجز مباشرة من موقعنا بأفضل سعر — بدون رسوم حجز' },
    linkLabel: { en: 'Find a stay', ar: 'ابحث عن إقامة' },
    href: '/search',
  },
  {
    id: 'summer',
    label: 'Summer season',
    text: { en: 'Summer is here — limited dates left for July & August', ar: 'الصيف وصل — تواريخ محدودة متبقية في يوليو وأغسطس' },
    linkLabel: { en: 'Check dates', ar: 'شوف المواعيد' },
    href: '/search',
  },
  {
    id: 'opening',
    label: 'New property',
    text: { en: 'Now open: a new Prime property — be among the first guests', ar: 'افتتاح جديد: عقار جديد من برايم — كن من أوائل الضيوف' },
    linkLabel: { en: 'See properties', ar: 'شاهد العقارات' },
    href: '/compounds',
  },
  {
    id: 'ramadan',
    label: 'Ramadan / Eid',
    text: { en: 'Ramadan Kareem — special rates on longer stays this month', ar: 'رمضان كريم — أسعار خاصة للإقامات الطويلة هذا الشهر' },
    linkLabel: { en: 'Book now', ar: 'احجز الآن' },
    href: '/search',
  },
  {
    id: 'monthly',
    label: 'Monthly stays',
    text: { en: 'Staying a month or more? Ask us about monthly rates', ar: 'إقامة شهر أو أكثر؟ اسألنا عن الأسعار الشهرية' },
    linkLabel: { en: 'Contact us', ar: 'تواصل معنا' },
    href: '/contact',
  },
];

function BarPreview({ value, locale }) {
  const tone = TONES.find(([id]) => id === value.tone) || TONES[0];
  const text = value.text?.[locale] || value.text?.en || 'Your message appears here';
  const link = value.linkLabel?.[locale] || value.linkLabel?.en;
  return (
    <div className={cn('relative flex h-8 items-center justify-center px-8 text-center text-[10.5px] tracking-[0.05em]', tone[2])}>
      <p className="truncate">
        {text}
        {link ? <span className="ms-2 underline underline-offset-4">{link}</span> : null}
      </p>
      <X size={11} className="absolute end-2 opacity-60" />
    </div>
  );
}

export default function MarketingAnnouncementPage() {
  const toast = useToast();
  const { replace } = useSite();
  const site = useSiteSection(api, ['announcement'], replace);
  const [device, setDevice] = useState('desktop');
  const [locale, setLocale] = useState('en');

  const value = site.draft?.announcement;
  const set = (patch) => site.setDraft((d) => ({ ...d, announcement: { ...d.announcement, ...patch } }));
  const status = value ? announcementStatus(value) : null;

  async function onSave() {
    if (await site.save()) toast.success('Announcement bar saved.');
  }

  return (
    <div>
      <MarketingNav />
      <AdminPageHeader
        title="Announcement bar"
        lede="A thin strip above the menu on every page of the website — for offers, seasonal news and openings. Guests can close it."
        actions={status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
      />
      {site.error ? <p className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{site.error}</p> : null}
      {!value ? (
        <p className="text-sm text-prime-muted">Loading…</p>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <AnnotatedSection title="Status" description="Switch the bar on or off. With dates set below, it turns itself on and off automatically.">
              <Toggle checked={value.enabled} onChange={(enabled) => set({ enabled })} label="Show the announcement bar on the website" hint={status.label} />
            </AnnotatedSection>

            <AnnotatedSection title="Message" description="Keep it short — one sentence that fits on a phone. Write both languages so Arabic visitors see Arabic." aside={<p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-prime-muted">Start from a template</p>}>
              <TemplatePicker templates={TEMPLATES} onPick={(t) => set({ text: t.text, linkLabel: t.linkLabel, href: t.href })} />
              <div>
                <BilingualField label="Message" value={value.text} onChange={(text) => set({ text })} placeholder={{ en: 'Summer on the North Coast — book direct for the best rate', ar: 'صيف الساحل الشمالي — احجز مباشرة بأفضل سعر' }} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <LengthMeter value={value.text?.en} range={[20, 90]} />
                  <LengthMeter value={value.text?.ar} range={[20, 90]} />
                </div>
              </div>
            </AnnotatedSection>

            <AnnotatedSection title="Button link" description="Optional. Send guests to a page on the site (like /search) or a full https:// link such as WhatsApp.">
              <BilingualField label="Link text" value={value.linkLabel} onChange={(linkLabel) => set({ linkLabel })} placeholder={{ en: 'Explore', ar: 'استكشف' }} />
              <Field label="Link goes to" hint="Examples: /search · /compounds · /contact · https://wa.me/20…">
                <input className="prime-input" value={value.href || ''} placeholder="/search" onChange={(e) => set({ href: e.target.value })} />
              </Field>
              <div className="flex flex-wrap gap-2">
                {[
                  ['/search', 'Search page'],
                  ['/compounds', 'Properties'],
                  ['/contact', 'Contact'],
                  ['/owners', 'List your property'],
                ].map(([href, label]) => (
                  <button key={href} type="button" onClick={() => set({ href })} className={cn('border px-2.5 py-1 text-[11px] font-semibold transition', value.href === href ? 'border-prime-night bg-prime-night text-prime-sand' : 'border-prime-line hover:border-prime-ink')}>
                    {label}
                  </button>
                ))}
              </div>
            </AnnotatedSection>

            <AnnotatedSection title="Schedule" description="Leave both empty to run until you switch it off. Dates use the guest's local day.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Start showing on">
                  <input type="date" className="prime-input" value={value.startsAt || ''} onChange={(e) => set({ startsAt: e.target.value })} />
                </Field>
                <Field label="Stop showing after">
                  <input type="date" className="prime-input" min={value.startsAt || undefined} value={value.endsAt || ''} onChange={(e) => set({ endsAt: e.target.value })} />
                </Field>
              </div>
              {value.startsAt || value.endsAt ? (
                <button type="button" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-prime-muted hover:text-prime-ink" onClick={() => set({ startsAt: '', endsAt: '' })}>
                  Clear dates
                </button>
              ) : null}
            </AnnotatedSection>

            <AnnotatedSection title="Style" description="Charcoal suits most messages; gold stands out for offers.">
              <div className="grid gap-3 sm:grid-cols-3">
                {TONES.map(([id, label, cls]) => (
                  <button key={id} type="button" onClick={() => set({ tone: id })} className={cn('border-2 p-1 text-start transition', value.tone === id ? 'border-prime-night' : 'border-transparent hover:border-prime-line')}>
                    <span className={cn('block h-8', cls)} />
                    <span className="mt-1.5 block text-xs font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            </AnnotatedSection>
          </div>

          <aside className="xl:sticky xl:top-20 xl:h-fit">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted">Live preview</p>
              <div className="flex gap-2">
                <SegmentedControl size="sm" value={locale} onChange={setLocale} options={LOCALE_OPTIONS} />
                <SegmentedControl size="sm" value={device} onChange={setDevice} options={DEVICE_OPTIONS} />
              </div>
            </div>
            <PreviewFrame device={device} dir={locale === 'ar' ? 'rtl' : 'ltr'} top={<BarPreview value={value} locale={locale} />} />
            {!value.enabled ? <p className="mt-3 text-xs text-prime-muted">The bar is switched off — guests don't see it yet.</p> : null}
          </aside>
        </div>
      )}
      <SaveBar dirty={site.dirty} saving={site.saving} onSave={onSave} onDiscard={site.discard} />
    </div>
  );
}
