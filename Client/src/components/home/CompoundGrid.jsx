import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import Img from '../ui/Img';
import Reveal from '../ui/Reveal';
import SectionIntro from '../ui/SectionIntro';
import { cn } from '../../utils/cn';

function DestinationTile({ destination, index, meta, lead }) {
  return (
    <Link
      to={`/search?destination=${encodeURIComponent(destination.id)}`}
      className={cn(
        'group relative block w-[78vw] flex-none snap-start overflow-hidden bg-brand-black sm:w-[46vw] md:w-auto',
        lead ? 'aspect-[3/4] md:col-span-2 md:row-span-2 md:aspect-auto' : 'aspect-[3/4] md:aspect-[4/5]'
      )}
    >
      <Img
        src={destination.image}
        alt=""
        sizes={lead ? '(min-width: 768px) 60vw, 80vw' : '(min-width: 768px) 30vw, 80vw'}
        className="absolute inset-0 h-full w-full object-cover opacity-90 transition duration-[1600ms] ease-prime group-hover:scale-[1.05] group-hover:opacity-100"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
      <span className="absolute start-5 top-5 text-[11px] font-semibold tracking-[0.2em] text-white/75 md:start-7 md:top-7">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="absolute inset-x-0 bottom-0 p-5 text-white md:p-7">
        <h3
          className={cn(
            'font-display font-light leading-none tracking-[-0.03em]',
            lead ? 'text-[2.3rem] md:text-[3.4rem]' : 'text-[1.9rem] md:text-[2.15rem]'
          )}
        >
          {destination.name}
        </h3>
        {meta ? <p className="mt-3 text-[12px] font-light text-white/70">{meta}</p> : null}
        <span className="mt-5 inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/90">
          Discover
          <span className="h-px w-6 bg-prime-gold-soft transition-all duration-500 ease-prime group-hover:w-12" />
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
        <Reveal className="prime-scroll-x -mx-5 gap-3 px-5 sm:-mx-8 sm:px-8 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 lg:gap-5">
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
