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
    <section className="overflow-hidden bg-brand-black text-white">
      <div className="grid lg:grid-cols-2">
        <Reveal className="relative min-h-[28rem] overflow-hidden lg:min-h-[42rem]">
          <Img src={IMAGE} alt="" sizes="(min-width: 1024px) 50vw, 100vw" className="absolute inset-0 h-full w-full object-cover opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-brand-black/40 max-lg:bg-gradient-to-t max-lg:from-brand-black/70 max-lg:to-transparent" />
        </Reveal>

        <div className="flex flex-col justify-center px-5 py-20 sm:px-8 md:px-12 md:py-28 lg:px-16 xl:pe-[max(3rem,calc((100vw_-_1440px)/2_+_3rem))]">
          <Reveal>
            <p className="prime-eyebrow text-prime-gold-soft">{t('home.why')}</p>
            <h2 className="mt-7 font-display text-display-lg font-extralight text-balance">{t('home.trustTitle')}</h2>
            <p className="mt-7 max-w-md text-[15px] font-light leading-[1.85] text-white/60">{t('home.trustBody')}</p>
          </Reveal>

          <ol className="mt-14">
            {items.map((p, i) => (
              <Reveal
                as="li"
                key={p.title}
                delay={i * 80}
                className="grid grid-cols-[3.5rem_1fr] gap-5 border-t border-white/12 py-8 last:border-b sm:grid-cols-[5rem_1fr]"
              >
                <span className="pt-1 font-display text-[1.75rem] font-extralight leading-none tracking-[-0.04em] text-prime-gold/70">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="font-display text-[1.4rem] font-light leading-snug tracking-[-0.02em] md:text-[1.55rem]">
                    {(ar && p.titleAr) || p.title}
                  </h3>
                  <p className="mt-3 max-w-md text-[14.5px] font-light leading-[1.8] text-white/55">
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
