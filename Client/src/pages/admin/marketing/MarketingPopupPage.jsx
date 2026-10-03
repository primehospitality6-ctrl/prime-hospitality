import { useState } from 'react';
import { MousePointerClick, Timer } from 'lucide-react';
import api from '../../../api/client';
import { AdminPageHeader, ImageUploadField } from '../../../components/admin/AdminUi';
import { Badge, BilingualField, Field, SaveBar, Toggle, useSiteSection, useToast } from '../../../components/admin/kit';
import { PopupCard } from '../../../components/PromoPopup';
import { useSite } from '../../../context/SiteContext';
import { brand } from '../../../theme/brand';
import { cn } from '../../../utils/cn';
import { AnnotatedSection, DEVICE_OPTIONS, LOCALE_OPTIONS, PreviewFrame, SegmentedControl, TemplatePicker, popupStatus } from './shared';
import MarketingNav from './MarketingNav';

const whatsappLink = () => `https://wa.me/${String(brand.whatsapp || '').replace(/\D/g, '')}`;

const TEMPLATES = [
  {
    id: 'direct',
    label: 'Book direct offer',
    title: { en: 'Book direct, save more', ar: 'احجز مباشرة ووفّر أكثر' },
    text: { en: 'Our best rates are always here on our website — no platform fees and instant confirmation.', ar: 'أفضل أسعارنا دائمًا هنا على موقعنا — بدون رسوم منصات وتأكيد فوري.' },
    ctaLabel: { en: 'Find your stay', ar: 'ابحث عن إقامتك' },
    href: '/search',
    trigger: 'delay',
    delaySeconds: 10,
    pages: 'all',
  },
  {
    id: 'whatsapp',
    label: 'Help on WhatsApp',
    title: { en: 'Need help choosing?', ar: 'محتاج مساعدة في الاختيار؟' },
    text: { en: 'Message our team on WhatsApp — we usually reply within minutes.', ar: 'راسل فريقنا على واتساب — عادةً نرد خلال دقائق.' },
    ctaLabel: { en: 'Chat on WhatsApp', ar: 'تواصل عبر واتساب' },
    href: 'whatsapp',
    trigger: 'scroll',
    scrollPercent: 50,
    pages: 'listings',
  },
  {
    id: 'opening',
    label: 'New opening',
    title: { en: 'Now open', ar: 'افتتاح جديد' },
    text: { en: 'Our newest property is taking bookings. Be among the first to stay.', ar: 'أحدث عقاراتنا متاح للحجز الآن. كن من أوائل الضيوف.' },
    ctaLabel: { en: 'See properties', ar: 'شاهد العقارات' },
    href: '/compounds',
    trigger: 'delay',
    delaySeconds: 6,
    pages: 'home',
  },
  {
    id: 'owners',
    label: 'Property owners',
    title: { en: 'Own a property?', ar: 'عندك عقار؟' },
    text: { en: 'Let Prime manage it — professional hosting, higher occupancy, zero hassle.', ar: 'خلّي برايم تديره — استضافة احترافية، إشغال أعلى، وبدون مجهود.' },
    ctaLabel: { en: 'List your property', ar: 'اعرض عقارك' },
    href: '/owners',
    trigger: 'scroll',
    scrollPercent: 60,
    pages: 'home',
  },
];

const PAGE_OPTIONS = [
  ['all', 'All pages'],
  ['home', 'Homepage only'],
  ['listings', 'Unit pages only'],
  ['search', 'Search & properties pages'],
];

const FREQUENCY_OPTIONS = [
  [0, 'Once per visit'],
  [1, 'Once a day'],
  [7, 'Once a week'],
  [30, 'Once a month'],
];

export default function MarketingPopupPage() {
  const toast = useToast();
  const { replace } = useSite();
  const site = useSiteSection(api, ['popup'], replace);
  const [device, setDevice] = useState('desktop');
  const [locale, setLocale] = useState('en');

  const value = site.draft?.popup;
  const set = (patch) => site.setDraft((d) => ({ ...d, popup: { ...d.popup, ...patch } }));
  const status = value ? popupStatus(value) : null;

  function applyTemplate(t) {
    const { id: _id, label: _label, href, ...rest } = t;
    set({ ...rest, href: href === 'whatsapp' ? whatsappLink() : href });
  }

  async function onSave() {
    if (await site.save()) toast.success('Pop-up saved.');
  }

  const previewPopup = value
    ? {
        title: value.title?.[locale] || value.title?.en || 'Your headline',
        text: value.text?.[locale] || value.text?.en || 'A short sentence about the offer.',
        ctaLabel: value.ctaLabel?.[locale] || value.ctaLabel?.en || '',
        href: value.href || '#',
        image: value.image,
      }
    : null;

  return (
    <div>
      <MarketingNav />
      <AdminPageHeader
        title="Pop-up"
        lede="A window that appears over the website after a few seconds or when a guest scrolls — for an offer, a new opening or a nudge to WhatsApp. It never shows during checkout."
        actions={status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
      />
      {site.error ? <p className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{site.error}</p> : null}
      {!value ? (
        <p className="text-sm text-prime-muted">Loading…</p>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <AnnotatedSection title="Status" description="Tip: write and preview everything first, then switch it on.">
              <Toggle checked={value.enabled} onChange={(enabled) => set({ enabled })} label="Show the pop-up on the website" hint={status.label} />
            </AnnotatedSection>

            <AnnotatedSection title="Content" description="A short headline, one or two sentences and one button work best." aside={<p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-prime-muted">Start from a template</p>}>
              <TemplatePicker templates={TEMPLATES} onPick={applyTemplate} />
              <BilingualField label="Headline" value={value.title} onChange={(title) => set({ title })} placeholder={{ en: 'Book direct, save more', ar: 'احجز مباشرة ووفّر أكثر' }} />
              <BilingualField label="Text" multiline rows={3} value={value.text} onChange={(text) => set({ text })} />
              <ImageUploadField label="Image (optional)" value={value.image || ''} folder="site" ratio="16:9" size="1200×675" onChange={(image) => set({ image })} />
            </AnnotatedSection>

            <AnnotatedSection title="Button" description="Where the button takes guests. Leave the text empty for no button.">
              <BilingualField label="Button text" value={value.ctaLabel} onChange={(ctaLabel) => set({ ctaLabel })} placeholder={{ en: 'Find your stay', ar: 'ابحث عن إقامتك' }} />
              <Field label="Button goes to" hint="A page on the site (/search) or a full https:// link.">
                <input className="prime-input" value={value.href || ''} placeholder="/search" onChange={(e) => set({ href: e.target.value })} />
              </Field>
              <div className="flex flex-wrap gap-2">
                {[
                  ['/search', 'Search page'],
                  ['/compounds', 'Properties'],
                  ['/contact', 'Contact'],
                  [whatsappLink(), 'WhatsApp chat'],
                ].map(([href, label]) => (
                  <button key={label} type="button" onClick={() => set({ href })} className={cn('border px-2.5 py-1 text-[11px] font-semibold transition', value.href === href ? 'border-prime-night bg-prime-night text-prime-sand' : 'border-prime-line hover:border-prime-ink')}>
                    {label}
                  </button>
                ))}
              </div>
            </AnnotatedSection>

            <AnnotatedSection title="When it appears" description="Waiting a few seconds, or until the guest has scrolled, feels far less pushy than showing it straight away.">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['delay', 'After a few seconds', Timer],
                  ['scroll', 'After scrolling down', MousePointerClick],
                ].map(([id, label, Icon]) => (
                  <button key={id} type="button" onClick={() => set({ trigger: id })} className={cn('flex items-center gap-3 border-2 p-3 text-start text-sm font-semibold transition', value.trigger === id ? 'border-prime-night' : 'border-prime-line hover:border-prime-ink')}>
                    <Icon size={18} className="text-prime-gold-deep" /> {label}
                  </button>
                ))}
              </div>
              {value.trigger === 'delay' ? (
                <Field label={`Wait ${value.delaySeconds} seconds`}>
                  <input type="range" min={0} max={60} step={1} value={value.delaySeconds} onChange={(e) => set({ delaySeconds: Number(e.target.value) })} className="w-full accent-[#221f20]" />
                </Field>
              ) : (
                <Field label={`Show after ${value.scrollPercent}% of the page`}>
                  <input type="range" min={10} max={90} step={5} value={value.scrollPercent} onChange={(e) => set({ scrollPercent: Number(e.target.value) })} className="w-full accent-[#221f20]" />
                </Field>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Show on">
                  <select className="prime-input" value={value.pages} onChange={(e) => set({ pages: e.target.value })}>
                    {PAGE_OPTIONS.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="How often per guest" hint="After closing it, a guest won't see it again for this long. Editing the text shows it again.">
                  <select className="prime-input" value={value.frequencyDays} onChange={(e) => set({ frequencyDays: Number(e.target.value) })}>
                    {FREQUENCY_OPTIONS.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </AnnotatedSection>

            <AnnotatedSection title="Schedule" description="Optional. Perfect for limited-time offers — it stops by itself.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Start showing on">
                  <input type="date" className="prime-input" value={value.startsAt || ''} onChange={(e) => set({ startsAt: e.target.value })} />
                </Field>
                <Field label="Stop showing after">
                  <input type="date" className="prime-input" min={value.startsAt || undefined} value={value.endsAt || ''} onChange={(e) => set({ endsAt: e.target.value })} />
                </Field>
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
            <PreviewFrame
              device={device}
              dir={locale === 'ar' ? 'rtl' : 'ltr'}
              overlay={
                <div className="w-full max-w-[300px] origin-center scale-[0.82]">
                  <PopupCard popup={previewPopup} onClose={() => {}} dir={locale === 'ar' ? 'rtl' : 'ltr'} preview />
                </div>
              }
            />
            <p className="mt-3 text-xs leading-relaxed text-prime-muted">
              {value.trigger === 'delay' ? `Appears ${value.delaySeconds}s after the page opens` : `Appears after scrolling ${value.scrollPercent}% of the page`} ·{' '}
              {PAGE_OPTIONS.find(([id]) => id === value.pages)?.[1].toLowerCase()} · {FREQUENCY_OPTIONS.find(([id]) => id === value.frequencyDays)?.[1].toLowerCase()}.
            </p>
          </aside>
        </div>
      )}
      <SaveBar dirty={site.dirty} saving={site.saving} onSave={onSave} onDiscard={site.discard} />
    </div>
  );
}
