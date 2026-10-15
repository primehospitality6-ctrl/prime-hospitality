import { Link } from 'react-router-dom';
import { useLocale } from '../../context/LocaleContext';
import Img from '../ui/Img';
import Reveal from '../ui/Reveal';
import Wordmark from '../ui/Wordmark';

const IMAGE = 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=2000&q=72';

/** Owners call-to-action: the Residence card colourway — Black 80% beside a photograph */
export default function PartnerCta() {
  const { t } = useLocale();
  return (
    <section className="grid bg-brand-residence text-white md:grid-cols-2">
      <div className="relative isolate overflow-hidden px-5 py-24 sm:px-8 md:py-32 lg:px-12 xl:ps-[max(3rem,calc((100vw_-_1440px)/2_+_3rem))]">
        <Wordmark
          word="Residence"
          className="pointer-events-none absolute -bottom-[0.08em] end-[-0.04em] -z-10 text-[clamp(6rem,15vw,14rem)] text-white/[0.07]"
        />
        <Reveal className="max-w-xl">
          <p className="prime-eyebrow mb-7 flex items-center gap-4 text-white/70">
            <span className="h-px w-10 bg-prime-gold-soft" aria-hidden />
            {t('home.partnersLabel')}
          </p>
          <h2 className="font-display text-display-xl font-extralight text-balance">{t('home.partnerCtaTitle')}</h2>
          <p className="mt-8 max-w-lg text-[15px] font-light leading-[1.85] text-white/70 md:text-[16.5px]">{t('home.partnerCtaBody')}</p>
          <Link to="/owners" className="prime-btn-ghost mt-12">
            {t('home.partnerCtaBtn')}
          </Link>
        </Reveal>
      </div>
      <div className="relative min-h-[22rem] overflow-hidden md:min-h-0">
        <Img src={IMAGE} alt="" sizes="(min-width: 768px) 50vw, 100vw" className="absolute inset-0 h-full w-full object-cover" />
      </div>
    </section>
  );
}
