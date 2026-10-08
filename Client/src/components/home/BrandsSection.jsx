import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import { subBrand } from '../../theme/brand';
import Img from '../ui/Img';
import Reveal from '../ui/Reveal';
import SectionIntro from '../ui/SectionIntro';
import Wordmark from '../ui/Wordmark';

const BRANDS = [
  {
    id: 'Inn',
    copyKey: 'home.brandInn',
    fallback: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=72',
  },
  {
    id: 'Residence',
    copyKey: 'home.brandResidence',
    fallback: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=72',
  },
  {
    id: 'Select',
    copyKey: 'home.brandSelect',
    fallback: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=72',
  },
];

/** Each sub-brand as its business card: the brand colour, its name stacked in syllables, a photo on hover */
function BrandCard({ id, image, copy, explore }) {
  const { color } = subBrand(id);
  return (
    <Link to={`/search?brand=${id}`} className="group block">
      <div className="relative isolate aspect-[4/5] overflow-hidden text-white" style={{ backgroundColor: color }}>
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
        <Wordmark word={id} className="absolute start-[7%] top-[7%] text-[24vw] text-white/90 md:text-[8.2vw] 2xl:text-[8rem]" />
        <div className="absolute inset-x-[7%] bottom-[7%] flex items-end justify-between gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.42em]">
            Prime <span className="font-light">{id}</span>
          </p>
          <span className="h-px w-8 bg-white/70 transition-all duration-500 ease-prime group-hover:w-14" aria-hidden />
        </div>
      </div>
      <p className="mt-6 max-w-sm text-[14.5px] font-light leading-[1.75] text-prime-muted">{copy}</p>
      <span className="prime-link mt-5">{explore}</span>
    </Link>
  );
}

export default function BrandsSection() {
  const { t } = useLocale();
  const [images, setImages] = useState({});

  useEffect(() => {
    let cancelled = false;
    api
      .getDestinations()
      .then((res) => {
        if (cancelled) return;
        const found = {};
        (res.items || []).forEach((d) =>
          (d.projects || []).forEach((p) => {
            if (p.brand && p.image && !found[p.brand]) found[p.brand] = p.image;
          })
        );
        setImages(found);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="prime-section bg-prime-mist">
      <div className="prime-container">
        <SectionIntro align="split" eyebrow={t('home.brandsEyebrow')} title={t('home.brandsTitle')} />
        <div className="grid gap-12 md:grid-cols-3 md:gap-5 lg:gap-6">
          {BRANDS.map((b, i) => (
            <Reveal key={b.id} delay={i * 120}>
              <BrandCard id={b.id} image={images[b.id] || b.fallback} copy={t(b.copyKey)} explore={t('home.explore')} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
