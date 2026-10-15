import { useEffect, useState } from 'react';
import api from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import Img from '../ui/Img';
import Reveal from '../ui/Reveal';

const IMAGE = 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1400&q=72';

export default function TrustSection() {
  const { t, locale } = useLocale();
  const ar = locale === 'ar';
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api
      .getTrust()
      .then((res) => {
        if (!cancelled) setItems(res.items || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="prime-section bg-prime-mist/40">
      <div className="prime-container grid gap-16 lg:grid-cols-2 lg:gap-28">
        <Reveal className="lg:sticky lg:top-[calc(var(--prime-header-h)+2rem)] lg:self-start">
          <div className="relative aspect-[4/5] overflow-hidden bg-prime-mist">
            <Img src={IMAGE} alt="" sizes="(min-width: 1024px) 45vw, 100vw" className="h-full w-full object-cover" />
          </div>
        </Reveal>

        <div className="lg:py-12">
          <Reveal>
            <p className="prime-eyebrow mb-7 flex items-center gap-4 text-prime-gold">
              <span className="h-px w-10 bg-prime-gold" aria-hidden />
              {t('home.why')}
            </p>
            <h2 className="font-display text-display-lg font-extralight text-prime-ink text-balance">{t('home.trustTitle')}</h2>
            <p className="prime-lede mt-7 max-w-md">{t('home.trustBody')}</p>
          </Reveal>

          <ol className="mt-16">
            {items.map((p, i) => (
              <Reveal
                as="li"
                key={p.title}
                delay={i * 80}
                className="grid grid-cols-[3rem_1fr] gap-5 border-t border-prime-line/80 py-9 last:border-b sm:grid-cols-[4.5rem_1fr]"
              >
                <span className="pt-1.5 text-[10.5px] font-medium tracking-[0.22em] text-prime-gold">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="font-display text-[1.35rem] font-light leading-snug tracking-[-0.02em] text-prime-ink md:text-[1.5rem]">
                    {(ar && p.titleAr) || p.title}
                  </h3>
                  <p className="mt-3 max-w-md text-[14.5px] font-light leading-[1.8] text-prime-muted">
                    {(ar && p.bodyAr) || p.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
