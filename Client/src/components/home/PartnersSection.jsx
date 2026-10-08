import { useEffect, useState } from 'react';
import api from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import { cn } from '../../utils/cn';

function PartnerLogo({ partner }) {
  const [failed, setFailed] = useState(false);

  if (failed || !partner.logo) {
    return <span className="text-[13px] font-semibold uppercase tracking-[0.24em] text-prime-muted">{partner.name}</span>;
  }

  return (
    <img
      src={partner.logo}
      alt={partner.name}
      title={partner.name}
      loading="lazy"
      decoding="async"
      className="h-7 w-auto max-w-[120px] object-contain opacity-50 grayscale transition duration-500 hover:opacity-100 hover:grayscale-0 dark:invert md:h-8"
      onError={() => setFailed(true)}
    />
  );
}

export default function PartnersSection({ className }) {
  const { t } = useLocale();
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api
      .getPartners()
      .then((res) => {
        if (!cancelled) setPartners(res.items || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!partners.length) return null;

  return (
    <section className={cn('border-y border-prime-line py-14 md:py-16', className)}>
      <div className="prime-container flex flex-col items-center gap-10 lg:flex-row lg:gap-16">
        <p className="prime-eyebrow shrink-0 text-center lg:text-start">{t('home.partners')}</p>
        <div className="flex flex-1 flex-wrap items-center justify-center gap-x-12 gap-y-8 lg:justify-between">
          {partners.map((partner) => (
            <div key={partner.id || partner.name || partner} className="flex h-10 items-center justify-center">
              <PartnerLogo partner={typeof partner === 'string' ? { name: partner } : partner} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
