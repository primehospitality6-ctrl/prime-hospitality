import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import Img from '../ui/Img';
import Reveal from '../ui/Reveal';
import SectionIntro from '../ui/SectionIntro';
import { cn } from '../../utils/cn';

/** Destination chapter: the photo on one side, its name on the other, alternating per place */
function DestinationChapter({ destination, index, meta }) {
  const { t, term } = useLocale();
  const odd = index % 2 === 1;

  return (
    <Link
      to={`/search?destination=${encodeURIComponent(destination.id)}`}
      className="group grid items-center gap-8 border-t border-prime-line py-12 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:gap-14 md:py-16"
    >
      <div className={cn('relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-prime-mist md:aspect-[5/4]', odd && 'md:order-2')}>
        <Img
          src={destination.image}
          alt=""
          sizes="(min-width: 768px) 55vw, 100vw"
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition duration-[2200ms] ease-prime group-hover:scale-[1.05]',
            odd ? 'origin-bottom' : 'origin-top'
          )}
        />
      </div>

      <div className={cn(odd && 'md:order-1')}>
        <span className="font-display text-[clamp(3rem,7vw,5.5rem)] font-extralight leading-none tracking-[-0.06em] text-prime-gold/60">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h3 className="mt-3 font-display text-[clamp(2.4rem,5.5vw,4.6rem)] font-extralight leading-[0.98] tracking-[-0.04em] text-prime-ink text-balance transition-colors duration-500 group-hover:text-prime-gold-deep">
          {term(destination.name)}
        </h3>
        {meta ? <p className="mt-5 max-w-md text-[14px] font-light tracking-wide text-prime-muted">{meta}</p> : null}
        <span className="mt-8 inline-flex items-center gap-4 text-[11px] font-medium uppercase tracking-[0.28em] text-prime-ink">
          {t('home.discover')}
          <span className="relative h-px w-16 overflow-hidden bg-prime-line">
            <span className="absolute inset-y-0 start-0 w-0 bg-prime-gold transition-all duration-700 ease-prime group-hover:w-full" />
          </span>
        </span>
      </div>
    </Link>
  );
}

/** Home: stacked destination chapters → /search?destination=… */
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
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <section className="overflow-hidden">
      {!hideIntro ? (
        <div className="prime-container prime-section pb-10 md:pb-14">
          <SectionIntro
            align="split"
            eyebrow={t('home.destinations')}
            title={t('home.destinationsBody')}
            link={{ to: '/compounds', label: t('home.exploreCompounds') }}
          />
        </div>
      ) : null}
      <Reveal className="prime-container flex flex-col border-b border-prime-line pb-px">
        {items.map((d, i) => (
          <DestinationChapter key={d.id} destination={d} index={i} meta={destinationMeta(d)} />
        ))}
      </Reveal>
    </section>
  );
}
