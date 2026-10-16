import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import BrandsSection from '../components/home/BrandsSection';
import PageHero from '../components/ui/PageHero';
import Img from '../components/ui/Img';
import Reveal from '../components/ui/Reveal';
import { brand, whatsappHref } from '../theme/brand';
import api from '../api/client';
import { useLocale } from '../context/LocaleContext';
import { useSite } from '../context/SiteContext';
import { cn } from '../utils/cn';

export function StaticPage({ title, eyebrow, lede, image, children }) {
  return (
    <div>
      <Header overHero={Boolean(image)} />
      <main>
        <PageHero image={image || undefined} eyebrow={eyebrow} title={title} lede={lede} />
        <div className="prime-container pb-28">
          <div className="max-w-3xl space-y-6 border-t border-prime-line pt-12 text-[16px] font-light leading-[1.85] text-prime-ink/85">
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

/** Plain-text policy body: blank line = new paragraph, "## " = heading, "- " = bullet list */
function RichText({ text }) {
  const blocks = String(text || '')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks.map((block, i) => {
    if (block.startsWith('## ')) {
      return (
        <h2 key={i} className="pt-4 font-display text-[1.7rem] font-medium leading-snug text-prime-ink">
          {block.slice(3)}
        </h2>
      );
    }
    const lines = block.split('\n');
    if (lines.every((l) => l.trim().startsWith('- '))) {
      return (
        <ul key={i} className="list-disc space-y-2 ps-6">
          {lines.map((l, j) => (
            <li key={j}>{l.trim().slice(2)}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className="whitespace-pre-line">
        {block}
      </p>
    );
  });
}

function FaqItem({ item, index, open, onToggle }) {
  const id = `faq-${index}`;
  return (
    <div className="border-t border-prime-line last:border-b">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="group flex w-full items-start justify-between gap-6 py-7 text-start"
        >
          <span className="flex gap-5">
            <span className="pt-1.5 text-[11px] font-medium tracking-[0.2em] text-prime-gold-deep">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="font-display text-[1.45rem] font-medium leading-snug text-prime-ink transition-colors group-hover:text-prime-gold-deep md:text-[1.65rem]">
              {item.q}
            </span>
          </span>
          <Plus
            size={20}
            strokeWidth={1.25}
            className={cn('mt-1.5 shrink-0 text-prime-muted transition-transform duration-500 ease-prime', open && 'rotate-45')}
          />
        </button>
      </h3>
      <div
        id={id}
        className={cn(
          'grid transition-[grid-template-rows] duration-500 ease-prime',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <p className="max-w-2xl whitespace-pre-line pb-8 ps-10 text-[15.5px] font-light leading-[1.85] text-prime-muted">{item.a}</p>
        </div>
      </div>
    </div>
  );
}

export function FaqPage() {
  const { t, locale } = useLocale();
  const { site } = useSite();
  const heroImage = site.pages?.faq?.heroImage || '';
  const [open, setOpen] = useState(0);
  const [faqs, setFaqs] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api
      .getFaqs()
      .then((res) => {
        if (!cancelled) setFaqs(res.items || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const items = faqs.map((f) => (locale === 'ar' && f.qAr && f.aAr ? { q: f.qAr, a: f.aAr } : f));

  return (
    <div>
      <Header overHero={Boolean(heroImage)} />
      <main>
        <PageHero
          image={heroImage || undefined}
          eyebrow={t('faq.eyebrow')}
          title={t('faq.title')}
          lede={t('faq.lede')}
        />
        <section className="prime-container grid gap-14 pb-28 lg:grid-cols-[0.8fr_1.6fr] lg:gap-24">
          <aside className="lg:sticky lg:top-[calc(var(--prime-header-h)+2rem)] lg:self-start">
            <div className="bg-prime-mist p-8 md:p-10">
              <p className="font-display text-[1.8rem] font-medium leading-tight text-prime-ink">{t('faq.asideTitle')}</p>
              <p className="mt-4 text-[15px] font-light leading-relaxed text-prime-muted">{t('faq.asideBody')}</p>
              <div className="mt-8 flex flex-col gap-3">
                <a href={whatsappHref()} target="_blank" rel="noreferrer" className="prime-btn">
                  {t('faq.whatsapp')}
                </a>
                <Link to="/contact" className="prime-btn-outline">
                  {t('faq.contactPage')}
                </Link>
              </div>
            </div>
          </aside>
          <div>
            {items.map((item, i) => (
              <FaqItem key={`${i}-${item.q}`} item={item} index={i} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

const LEGAL_KEYS = { terms: 'terms', privacy: 'privacy', 'refund-policy': 'refund' };

export function LegalPage({ kind }) {
  const { t, locale, localeTag } = useLocale();
  const { site } = useSite();
  const key = LEGAL_KEYS[kind] || 'terms';
  const page = site.pages?.legal?.[key] || {};
  const body = (locale === 'ar' && page.ar) || page.en;
  const updated = page.updatedAt
    ? new Date(`${page.updatedAt}T00:00:00`).toLocaleDateString(localeTag, { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <StaticPage
      image={page.heroImage || undefined}
      eyebrow={t('legal.eyebrow')}
      title={t(`legal.${key}`)}
      lede={t('legal.lede')}
    >
      {updated ? <p className="text-[13px] uppercase tracking-[0.18em] text-prime-muted">{t('legal.updated', { date: updated })}</p> : null}
      {body ? <RichText text={body} /> : <p>{t('legal.placeholder')}</p>}
      <p className="text-[15px] text-prime-muted">
        {t('legal.contact')}{' '}
        <a href={`mailto:${brand.email}`} className="text-prime-ink underline decoration-prime-gold underline-offset-4">
          {brand.email}
        </a>
      </p>
    </StaticPage>
  );
}

const ABOUT_HERO = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2400&q=72';
const ABOUT_WIDE = 'https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&w=2400&q=72';
const ABOUT_PORTRAIT = 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=72';

export function AboutPage() {
  const { t } = useLocale();
  const { site } = useSite();
  const images = site.pages?.about || {};
  const values = [1, 2, 3].map((n) => ({ title: t(`about.value${n}Title`), body: t(`about.value${n}Body`) }));

  return (
    <div>
      <Header overHero />
      <main>
        <PageHero image={images.heroImage || ABOUT_HERO} eyebrow={t('about.eyebrow')} title={t('about.title')} lede={t('about.lede')} />

        <section className="prime-section">
          <div className="prime-container grid gap-12 lg:grid-cols-2 lg:gap-24">
            <Reveal>
              <p className="prime-eyebrow text-prime-gold-deep">{t('about.storyEyebrow')}</p>
              <h2 className="mt-6 font-display text-display-lg font-medium text-prime-ink text-balance">{t('about.storyTitle')}</h2>
            </Reveal>
            <Reveal delay={120} className="space-y-6 text-[16px] font-light leading-[1.85] text-prime-ink/80 md:text-[17px] lg:pt-14">
              <p>{t('about.storyBody1')}</p>
              <p className="text-prime-muted">{t('about.storyBody2')}</p>
              <Link to="/search" className="prime-link pt-2">
                {t('about.explore')}
              </Link>
            </Reveal>
          </div>
        </section>

        <Reveal className="prime-container">
          <div className="relative aspect-[4/5] overflow-hidden bg-prime-mist sm:aspect-[16/9] lg:aspect-[21/9]">
            <Img src={images.wideImage || ABOUT_WIDE} alt="" sizes="(min-width: 1360px) 1360px, 100vw" className="h-full w-full object-cover" />
          </div>
        </Reveal>

        <section className="prime-section">
          <div className="prime-container grid gap-14 lg:grid-cols-[1fr_1.2fr] lg:gap-24">
            <Reveal className="order-2 lg:order-1">
              <div className="relative aspect-[4/5] overflow-hidden bg-prime-mist">
                <Img
                  src={images.portraitImage || ABOUT_PORTRAIT}
                  alt=""
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="h-full w-full object-cover"
                />
              </div>
            </Reveal>
            <div className="order-1 lg:order-2 lg:py-10">
              <Reveal>
                <p className="prime-eyebrow text-prime-gold-deep">{t('about.valuesEyebrow')}</p>
                <h2 className="mt-6 font-display text-display-lg font-medium text-prime-ink text-balance">{t('about.valuesTitle')}</h2>
              </Reveal>
              <ol className="mt-12">
                {values.map((v, i) => (
                  <Reveal
                    as="li"
                    key={i}
                    delay={i * 90}
                    className="grid grid-cols-[3.5rem_1fr] gap-4 border-t border-prime-line py-8 last:border-b"
                  >
                    <span className="font-display text-[2rem] font-medium leading-none text-prime-gold">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="font-display text-[1.6rem] font-medium text-prime-ink">{v.title}</h3>
                      <p className="mt-2 text-[15px] font-light leading-[1.8] text-prime-muted">{v.body}</p>
                    </div>
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <BrandsSection />

        <section className="prime-section text-center">
          <Reveal className="prime-container max-w-3xl">
            <h2 className="font-display text-display-lg font-medium text-prime-ink text-balance">{t('about.ctaTitle')}</h2>
            <p className="prime-lede mx-auto mt-6 max-w-lg">{t('about.ctaBody')}</p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link to="/search" className="prime-btn">
                {t('about.ctaPrimary')}
              </Link>
              <Link to="/contact" className="prime-btn-outline">
                {t('about.ctaSecondary')}
              </Link>
            </div>
          </Reveal>
        </section>
      </main>
      <Footer />
    </div>
  );
}
