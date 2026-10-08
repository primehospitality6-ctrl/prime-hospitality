import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import { useBrands } from '../../context/SiteContext';
import { cn } from '../../utils/cn';
import Img from '../ui/Img';
import Reveal from '../ui/Reveal';
import SectionIntro from '../ui/SectionIntro';
import Wordmark from '../ui/Wordmark';

const GRID_COLS = { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-2 lg:grid-cols-4' };

/** Each sub-brand as its business card: the brand colour, its name stacked in syllables, a photo on hover */
function BrandCard({ name, color, image, copy, explore, dense, wide }) {
  return (
    <Link to={`/search?brand=${encodeURIComponent(name)}`} className="group block">
      <div
        className={cn('relative isolate overflow-hidden text-white', wide ? 'aspect-[5/4]' : 'aspect-[4/5]')}
        style={{ backgroundColor: color }}
      >
        {image ? (
          <>
            <Img
              src={image}
              alt=""
              sizes="(min-width: 768px) 33vw, 100vw"
              className="absolute inset-0 -z-20 h-full w-full scale-[1.06] object-cover opacity-0 transition duration-[1400ms] ease-prime group-hover:scale-100 group-hover:opacity-100"
            />
            <div
              className="absolute inset-0 -z-10 opacity-0 mix-blend-multiply transition-opacity duration-[1400ms] ease-prime group-hover:opacity-90"
              style={{ backgroundColor: color }}
            />
          </>
        ) : null}
        <Wordmark
          word={name}
          className={cn(
            'absolute start-[7%] top-[7%] text-[24vw] text-white/90 md:text-[8.2vw] 2xl:text-[8rem]',
            dense && 'lg:text-[5.6vw] 2xl:text-[5.6rem]'
          )}
        />
        <div className="absolute inset-x-[7%] bottom-[7%] flex items-end justify-between gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.42em]" dir="ltr">
            Prime <span className="font-light">{name}</span>
          </p>
          <span className="h-px w-8 bg-white/70 transition-all duration-500 ease-prime group-hover:w-14" aria-hidden />
        </div>
      </div>
      {copy ? <p className="mt-6 max-w-sm text-[14.5px] font-light leading-[1.75] text-prime-muted">{copy}</p> : null}
      <span className="prime-link mt-5">{explore}</span>
    </Link>
  );
}

export default function BrandsSection() {
  const { t, locale } = useLocale();
  const brands = useBrands();
  const [propertyImages, setPropertyImages] = useState({});

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

  if (!brands.length) return null;

  return (
    <section className="prime-section bg-prime-mist">
      <div className="prime-container">
        <SectionIntro align="split" eyebrow={t('home.brandsEyebrow')} title={t('home.brandsTitle')} />
        <div className={cn('grid gap-12 md:gap-5 lg:gap-6', GRID_COLS[brands.length] || 'md:grid-cols-3')}>
          {brands.map((b, i) => (
            <Reveal key={b.name} delay={(i % 4) * 120}>
              <BrandCard
                name={b.name}
                color={b.color}
                image={b.image || propertyImages[b.name.toLowerCase()]}
                copy={(locale === 'ar' && b.text?.ar) || b.text?.en}
                explore={t('home.explore')}
                dense={brands.length === 4}
                wide={brands.length <= 2}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
