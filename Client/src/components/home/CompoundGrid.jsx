import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import Img from '../ui/Img';
import Reveal from '../ui/Reveal';
import SectionIntro from '../ui/SectionIntro';
import { cn } from '../../utils/cn';

function DestinationTile({ destination, index, meta, lead }) {
  const { t, term } = useLocale();
  return (
    <Link
      to={`/search?destination=${encodeURIComponent(destination.id)}`}
      className={cn(
        'group relative block w-[82vw] flex-none snap-start overflow-hidden bg-brand-black sm:w-[48vw] md:w-auto',
        lead ? 'aspect-[3/4] md:col-span-2 md:row-span-2 md:min-h-[36rem] md:aspect-auto' : 'aspect-[3/4] md:aspect-[4/5]'
      )}
    >
      <Img
        src={destination.image}
        alt=""
        sizes={lead ? '(min-width: 768px) 60vw, 80vw' : '(min-width: 768px) 30vw, 80vw'}
        className="absolute inset-0 h-full w-full object-cover opacity-95 transition duration-[1800ms] ease-prime group-hover:scale-[1.04] group-hover:opacity-100"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
      <span className="absolute start-5 top-5 text-[10.5px] font-medium tracking-[0.24em] text-white/65 md:start-8 md:top-8">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-8 lg:p-10">
        <h3
          className={cn(
            'font-display font-extralight leading-none tracking-[-0.035em]',
            lead ? 'text-[2.5rem] md:text-[3.75rem]' : 'text-[2rem] md:text-[2.35rem]'
          )}
        >
          {term(destination.name)}
        </h3>
        {meta ? <p className="mt-4 text-[12.5px] font-light text-white/65">{meta}</p> : null}
        <span className="mt-6 inline-flex items-center gap-3 text-[10.5px] font-medium uppercase tracking-[0.24em] text-white/90">
          {t('home.discover')}
          <span className="h-px w-8 bg-prime-gold-soft transition-all duration-700 ease-prime group-hover:w-14" />
        </span>
      </div>
    </Link>
  );
}

/** Home: destination tiles → /search?destination=… */
export default function CompoundGrid({ limit, hideIntro = false, homeOnly = false }) {
  const { t } = useLocale();
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api
      .getDestinations(homeOnly ? { home: true } : undefined)
      .then((res) => {
        if (cancelled) return;
        const list = res.items || [];
        setItems(limit ? list.slice(0, limit) : list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [limit, homeOnly]);

  const destinationMeta = (d) =>
    [
      t('home.propertiesCount', { count: d.projectCount ?? d.projects?.length ?? 0 }),
      d.unitTypeCount ? t('home.unitTypesCount', { count: d.unitTypeCount }) : null,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <section className="prime-section overflow-hidden">
      <div className="prime-container">
        {!hideIntro ? (
          <SectionIntro
            align="split"
            eyebrow={t('home.destinations')}
            title={t('home.destinationsBody')}
            link={{ to: '/compounds', label: t('home.exploreCompounds') }}
          />
        ) : null}
        <Reveal className="prime-scroll-x -mx-5 gap-3 px-5 sm:-mx-8 sm:gap-4 sm:px-8 md:mx-0 md:grid md:grid-cols-3 md:gap-3 md:overflow-visible md:px-0 lg:gap-4">
          {items.map((d, i) => (
            <DestinationTile
              key={d.id}
              destination={d}
              index={i}
              meta={destinationMeta(d)}
              lead={i === 0 && items.length > 2}
            />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
