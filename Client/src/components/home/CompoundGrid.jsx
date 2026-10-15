import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import Img from '../ui/Img';
import Reveal from '../ui/Reveal';
import SectionIntro from '../ui/SectionIntro';
import { cn } from '../../utils/cn';

/** Full-bleed destination chapter — one composition per place */
function DestinationChapter({ destination, index, meta }) {
  const { t, term } = useLocale();
  const odd = index % 2 === 1;

  return (
    <Link
      to={`/search?destination=${encodeURIComponent(destination.id)}`}
      className="group relative block min-h-[78svh] overflow-hidden bg-brand-black md:min-h-[88svh]"
    >
      <Img
        src={destination.image}
        alt=""
        sizes="100vw"
        className={cn(
          'absolute inset-0 h-full w-full object-cover transition duration-[2200ms] ease-prime group-hover:scale-[1.06]',
          odd ? 'origin-bottom' : 'origin-top'
        )}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/20" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.35)_100%)]" />

      <div className="relative flex min-h-[78svh] flex-col justify-end px-5 pb-16 pt-32 sm:px-8 md:min-h-[88svh] md:px-12 md:pb-24 lg:px-[max(3rem,calc((100vw_-_1440px)/2_+_3rem))]">
        <span className="font-display text-[clamp(4rem,12vw,9rem)] font-extralight leading-none tracking-[-0.06em] text-white/[0.12]">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h3 className="mt-2 max-w-4xl font-display text-[clamp(2.8rem,8vw,6.5rem)] font-extralight leading-[0.95] tracking-[-0.04em] text-white text-balance">
          {term(destination.name)}
        </h3>
        {meta ? <p className="mt-6 max-w-md text-[14px] font-light tracking-wide text-white/65">{meta}</p> : null}
        <span className="mt-10 inline-flex items-center gap-4 text-[11px] font-medium uppercase tracking-[0.28em] text-white">
          {t('home.discover')}
          <span className="relative h-px w-16 overflow-hidden bg-white/30">
            <span className="absolute inset-y-0 start-0 w-0 bg-prime-gold-soft transition-all duration-700 ease-prime group-hover:w-full" />
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
      d.unitTypeCount ? t('home.unitTypesCount', { count: d.unitTypeCount }) : null,
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
      <Reveal className="flex flex-col">
        {items.map((d, i) => (
          <DestinationChapter key={d.id} destination={d} index={i} meta={destinationMeta(d)} />
        ))}
      </Reveal>
    </section>
  );
}
