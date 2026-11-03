import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import api from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import { useBrands } from '../../context/SiteContext';
import { cn } from '../../utils/cn';
import Img from '../ui/Img';
import Reveal from '../ui/Reveal';
import SectionIntro from '../ui/SectionIntro';

/** Photo of a brand washed in its colour, or the colour alone with its initial when there is no photo */
function BrandVisual({ brand, sizes, className }) {
  return (
    <div className={cn('relative isolate overflow-hidden', className)} style={{ backgroundColor: brand.color }}>
      {brand.image ? (
        <Img src={brand.image} alt="" sizes={sizes} className="absolute inset-0 -z-10 h-full w-full object-cover" />
      ) : (
        <span
          className="absolute -bottom-[0.18em] end-[4%] -z-10 select-none font-display text-[18rem] font-extralight leading-none text-white/15"
          aria-hidden
        >
          {brand.name.charAt(0)}
        </span>
      )}
      <div
        className="absolute inset-0 -z-10 opacity-80"
        style={{ background: `linear-gradient(to top, ${brand.color} 0%, transparent 62%)` }}
        aria-hidden
      />
    </div>
  );
}

/**
 * The collection as an editorial index: large brand names on one side, and on wide screens
 * a photo panel that follows the brand you point at. Small screens get each brand's photo inline.
 */
export default function BrandsSection() {
  const { t, locale } = useLocale();
  const items = useBrands();
  const [propertyImages, setPropertyImages] = useState({});
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .getDestinations()
      .then((res) => {
        if (cancelled) return;
        const found = {};
        (res.items || []).forEach((d) =>
          (d.projects || []).forEach((p) => {
            const key = String(p.brand || '').toLowerCase();
            if (key && p.image && !found[key]) found[key] = p.image;
          })
        );
        setPropertyImages(found);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!items.length) return null;

  const brands = items.map((b) => ({
    ...b,
    image: b.image || propertyImages[b.name.toLowerCase()] || '',
    copy: (locale === 'ar' && b.text?.ar) || b.text?.en || '',
  }));
  const current = brands[Math.min(active, brands.length - 1)];

  return (
    <section className="prime-section relative isolate overflow-hidden bg-prime-night text-white">
      {/* A faint glow in the colour of the brand in focus */}
      <div
        className="pointer-events-none absolute -end-[20%] -top-[30%] -z-10 h-[80%] w-[70%] rounded-full opacity-25 blur-[120px] transition-colors duration-1000"
        style={{ backgroundColor: current.color }}
        aria-hidden
      />
      <div className="prime-container">
        <SectionIntro align="split" tone="dark" eyebrow={t('home.brandsEyebrow')} title={t('home.brandsTitle')} />

        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          {/* Wide screens: the photo of the brand in focus */}
          <Reveal className="relative hidden lg:block">
            <div className="sticky top-[calc(var(--prime-header-h)+2rem)] aspect-[4/5] overflow-hidden">
              {brands.map((b, i) => (
                <div
                  key={b.name}
                  className={cn(
                    'absolute inset-0 transition duration-[1100ms] ease-prime',
                    i === active ? 'scale-100 opacity-100' : 'scale-[1.04] opacity-0'
                  )}
                  aria-hidden={i !== active}
                >
                  <BrandVisual brand={b} sizes="40vw" className="h-full w-full" />
                </div>
              ))}
              <div className="absolute inset-x-8 bottom-8 flex items-end justify-between gap-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.42em]" dir="ltr">
                  Prime <span className="font-light">{current.name}</span>
                </p>
                <span className="font-display text-[3.2rem] font-extralight leading-none tabular-nums text-white/80">
                  {String(active + 1).padStart(2, '0')}
                </span>
              </div>
            </div>
          </Reveal>

          {/* The index */}
          <ol className="border-t border-white/15">
            {brands.map((b, i) => {
              const on = i === active;
              return (
                <Reveal as="li" key={b.name} delay={(i % 5) * 90} className="border-b border-white/15">
                  <Link
                    to="/search"
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    className="group relative block py-8 focus-visible:outline-none md:py-10"
                  >
                    {/* Colour rule that grows on the brand in focus */}
                    <span
                      className={cn(
                        'absolute -top-px start-0 hidden h-[2px] transition-all duration-700 ease-prime lg:block',
                        on ? 'w-full' : 'w-0'
                      )}
                      style={{ backgroundColor: b.color }}
                      aria-hidden
                    />

                    <BrandVisual
                      brand={b}
                      sizes="100vw"
                      className="mb-7 aspect-[16/10] lg:hidden"
                    />

                    <div className="flex items-start gap-5 md:gap-8">
                      <span className="mt-3 w-8 shrink-0 font-display text-[1rem] tabular-nums text-white/40 md:mt-5">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-3 text-[10.5px] font-semibold uppercase tracking-[0.36em] text-white/55">
                          <span className="h-2 w-2 rotate-45" style={{ backgroundColor: b.color }} aria-hidden />
                          Prime
                        </p>
                        <h3
                          className={cn(
                            'mt-2 font-display text-[2.7rem] font-extralight leading-[1.02] transition-colors duration-500 md:text-[3.6rem] xl:text-[4.4rem]',
                            on ? 'text-white' : 'text-white lg:text-white/35 lg:group-hover:text-white'
                          )}
                          dir="ltr"
                        >
                          {b.name}
                        </h3>
                        {b.copy ? (
                          <div
                            className={cn(
                              'grid transition-[grid-template-rows,opacity] duration-700 ease-prime',
                              on ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[1fr] opacity-100 lg:grid-rows-[0fr] lg:opacity-0'
                            )}
                          >
                            <p className="overflow-hidden">
                              <span className="block max-w-md pt-4 text-[14.5px] font-light leading-[1.75] text-white/65">
                                {b.copy}
                              </span>
                            </p>
                          </div>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          'mt-4 grid h-12 w-12 shrink-0 place-items-center rounded-full border transition duration-500 ease-prime md:mt-6',
                          on
                            ? 'border-prime-gold bg-prime-gold text-prime-night'
                            : 'border-white/25 text-white/70 group-hover:border-prime-gold group-hover:text-prime-gold-soft'
                        )}
                        aria-hidden
                      >
                        <ArrowUpRight size={18} strokeWidth={1.5} className="rtl:-scale-x-100" />
                      </span>
                    </div>
                    <span className="sr-only">{t('home.explore')}</span>
                  </Link>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
