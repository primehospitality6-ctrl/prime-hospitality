import { useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Img from '../components/ui/Img';
import Wordmark from '../components/ui/Wordmark';
import { formatMoney } from '../theme/brand';
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
      <Header />
      <main className="relative isolate overflow-hidden pb-28 pt-16 md:pt-24">
        <Wordmark
          word="Hospitality"
          className="pointer-events-none absolute -top-[0.08em] end-[-0.04em] -z-10 hidden text-[clamp(7rem,14vw,14rem)] text-prime-ink/[0.04] md:block"
        />

        <div className="prime-container max-w-3xl">
          <div className="prime-fade-up text-center">
            <p className="prime-eyebrow text-prime-gold">{t('bs.eyebrow')}</p>
            <h1 className="mt-6 font-display text-display-lg font-extralight text-prime-ink text-balance">
              {firstName ? t('bs.title', { name: firstName }) : t('bs.titleAnon')}
            </h1>
            <p className="prime-lede mx-auto mt-7 max-w-lg">{email ? t('bs.lede', { email }) : t('bs.ledeAnon')}</p>
          </div>

          {voucher ? (
            <div
              className="prime-fade-up relative mx-auto mt-14 max-w-xl border border-prime-line px-8 py-12 text-center md:px-12 md:py-14"
              style={{ animationDelay: '120ms' }}
            >
              <span className="absolute start-4 top-4 h-5 w-5 border-s border-t border-prime-gold/60" aria-hidden />
              <span className="absolute end-4 top-4 h-5 w-5 border-e border-t border-prime-gold/60" aria-hidden />
              <span className="absolute bottom-4 start-4 h-5 w-5 border-b border-s border-prime-gold/60" aria-hidden />
              <span className="absolute bottom-4 end-4 h-5 w-5 border-b border-e border-prime-gold/60" aria-hidden />
              <p className="text-[10.5px] font-medium uppercase tracking-[0.32em] text-prime-muted">{t('bs.voucher')}</p>
              <p className="mt-4 font-display text-[2.6rem] font-extralight tracking-[0.06em] text-prime-ink md:text-[3.4rem]">
                {voucher}
              </p>
            </div>
          ) : null}

          {booking ? (
            <div className="prime-fade-up mt-12 border-t border-prime-line" style={{ animationDelay: '200ms' }}>
              {summary.image ? (
                <div className="relative mt-10 aspect-[21/9] overflow-hidden bg-prime-mist">
                  <Img src={summary.image} alt="" sizes="(min-width: 768px) 720px, 100vw" className="absolute inset-0 h-full w-full object-cover" />
                </div>
              ) : null}
              <dl className="mt-2">
                {rows.map((row) => (
                  <div key={row.label} className="flex justify-between gap-6 border-b border-prime-line py-4 text-[14.5px]">
                    <dt className="font-light text-prime-muted">{row.label}</dt>
                    <dd className="m-0 text-end text-prime-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex items-baseline justify-between gap-4 py-6">
                <span className="text-[10.5px] font-medium uppercase tracking-[0.26em] text-prime-muted">{t('bs.paid')}</span>
                <span className="font-display text-[2.15rem] font-extralight tabular-nums tracking-[-0.02em] text-prime-ink">
                  {formatMoney(booking.rateAmount, booking.rateCurrency)}
                </span>
              </div>
            </div>
          ) : null}

          <div className="mt-14 flex flex-wrap justify-center gap-4">
            <Link to="/search" className="prime-btn">
              {t('bs.browse')}
            </Link>
            <Link to="/" className="prime-btn-outline">
              {t('bs.home')}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
