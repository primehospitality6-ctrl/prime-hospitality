import { useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Img from '../components/ui/Img';
import Wordmark from '../components/ui/Wordmark';
import { useCurrency } from '../context/CurrencyContext';
import { useLocale } from '../context/LocaleContext';
import { formatIsoDate } from '../components/booking/bookingUtils';

function readSummary(state, voucher) {
  if (state?.booking) return state;
  if (!voucher) return null;
  try {
    return JSON.parse(sessionStorage.getItem(`prime.booking.${voucher}`) || 'null');
  } catch {
    return null;
  }
}

export default function BookingSuccessPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const { t, localeTag } = useLocale();
  const { format } = useCurrency();
  const voucher = params.get('voucher') || params.get('bookingId') || '';
  const summary = useMemo(() => readSummary(location.state, voucher), [location.state, voucher]);
  const booking = summary?.booking;
  const firstName = booking?.primaryGuestName?.split(' ')[0];
  const email = summary?.email;

  const rows = booking
    ? [
        { label: t('bm.destination'), value: booking.destination },
        { label: t('bm.property'), value: booking.property },
        { label: t('bm.roomType'), value: booking.roomType },
        { label: t('bm.arrivalDate'), value: formatIsoDate(booking.arrivalDate, localeTag) },
        { label: t('bm.departureDate'), value: formatIsoDate(booking.departureDate, localeTag) },
        { label: t('bm.nights'), value: booking.nights },
        {
          label: t('bm.guests'),
          value: [
            t('bm.adultsCount', { count: booking.adults }),
            booking.children ? t('bm.childrenCount', { count: booking.children }) : null,
          ]
            .filter(Boolean)
            .join(' · '),
        },
        { label: t('bm.ratePlan'), value: booking.ratePlanName },
      ].filter((r) => r.value !== undefined && r.value !== null && r.value !== '')
    : [];

  return (
    <div>
      <Header overHero />
      <main className="relative isolate overflow-hidden bg-brand-black text-white">
        <Wordmark
          word="Hospitality"
          className="pointer-events-none absolute inset-x-0 top-[8%] mx-auto w-max text-center text-[clamp(7rem,20vw,18rem)] text-white/[0.05]"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(140,112,77,0.2),transparent_55%)]" aria-hidden />

        <div className="prime-container relative max-w-3xl pb-28 pt-28 md:pt-36">
          <div className="prime-fade-up text-center">
            <p className="prime-eyebrow text-prime-gold-soft">{t('bs.eyebrow')}</p>
            <h1 className="mt-7 font-display text-display-xl font-extralight text-balance">
              {firstName ? t('bs.title', { name: firstName }) : t('bs.titleAnon')}
            </h1>
            <p className="mx-auto mt-7 max-w-lg text-[15px] font-light leading-[1.85] text-white/60 md:text-[16.5px]">
              {email ? t('bs.lede', { email }) : t('bs.ledeAnon')}
            </p>
          </div>

          {voucher ? (
            <div
              className="prime-fade-up relative mx-auto mt-16 max-w-xl border border-white/15 bg-white/[0.03] px-8 py-14 text-center backdrop-blur-sm md:px-14 md:py-16"
              style={{ animationDelay: '120ms' }}
            >
              <span className="absolute start-5 top-5 h-6 w-6 border-s border-t border-prime-gold/70" aria-hidden />
              <span className="absolute end-5 top-5 h-6 w-6 border-e border-t border-prime-gold/70" aria-hidden />
              <span className="absolute bottom-5 start-5 h-6 w-6 border-b border-s border-prime-gold/70" aria-hidden />
              <span className="absolute bottom-5 end-5 h-6 w-6 border-b border-e border-prime-gold/70" aria-hidden />
              <p className="text-[10.5px] font-medium uppercase tracking-[0.36em] text-white/45">{t('bs.voucher')}</p>
              <p className="mt-5 font-display text-[clamp(2.4rem,7vw,4rem)] font-extralight tracking-[0.08em] text-prime-gold-soft">
                {voucher}
              </p>
            </div>
          ) : null}

          {booking ? (
            <div className="prime-fade-up mt-14" style={{ animationDelay: '200ms' }}>
              {summary.image ? (
                <div className="relative aspect-[21/9] overflow-hidden bg-white/5">
                  <Img src={summary.image} alt="" sizes="(min-width: 768px) 720px, 100vw" className="absolute inset-0 h-full w-full object-cover opacity-90" />
                </div>
              ) : null}
              <dl className="mt-2 border-t border-white/10">
                {rows.map((row) => (
                  <div key={row.label} className="flex justify-between gap-6 border-b border-white/10 py-4 text-[14.5px]">
                    <dt className="font-light text-white/45">{row.label}</dt>
                    <dd className="m-0 text-end text-white/90">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex items-baseline justify-between gap-4 py-7">
                <span className="text-[10.5px] font-medium uppercase tracking-[0.28em] text-white/45">{t('bs.paid')}</span>
                <span className="text-end">
                  <span className="block font-display text-[2.4rem] font-extralight tabular-nums tracking-[-0.02em] text-prime-gold-soft">
                    {format(booking.rateAmount)}
                  </span>
                </span>
              </div>
            </div>
          ) : null}

          <div className="mt-14 flex flex-wrap justify-center gap-4">
            <Link to="/search" className="prime-btn-gold">
              {t('bs.browse')}
            </Link>
            <Link to="/" className="prime-btn-ghost">
              {t('bs.home')}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
