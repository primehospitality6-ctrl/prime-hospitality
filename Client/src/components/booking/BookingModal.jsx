import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, X } from 'lucide-react';
import { kwentraApi } from '../../services/api';
import { formatMoney } from '../../theme/brand';
import { useLocale } from '../../context/LocaleContext';
import { cn } from '../../utils/cn';
import { browserCountry } from '../../utils/countries';
import PaymentPanel from './PaymentPanel';
import { MobileSummary, SummaryPanel } from './BookingSummary';
import { GuestStep, RateStep, ReviewStep, StayStep, StepHeading } from './BookingSteps';
import {
  STEPS,
  STEP_OF_FIELD,
  cleanName,
  nightsBetween,
  priceStay,
  validateGuest,
  validateRate,
  validateStay,
} from './bookingUtils';

const EMPTY_GUEST = {
  primaryGuestName: '',
  otherGuestNames: [],
  nationality: '',
  reservationCountry: '',
  email: '',
  phone: '',
  notes: '',
};

/**
 * Website booking engine popup — collects every guest-facing PMS field in four steps
 * (stay → rate plan → guest details → review) and takes payment in place.
 */
export default function BookingModal({
  open,
  onClose,
  listing,
  blockedDates = [],
  checkoutDates = [],
  dailyPrices = {},
  initialCheckIn = '',
  initialCheckOut = '',
  initialAdults = 2,
  initialChildren = 0,
  onBooked,
  onDatesTaken,
}) {
  const { t, term } = useLocale();
  const maxGuests = listing?.maxGuests || 8;
  const scrollRef = useRef(null);
  const dialogRef = useRef(null);

  const [step, setStep] = useState('stay');
  const [reached, setReached] = useState(0);
  const [config, setConfig] = useState(null);
  const [stay, setStay] = useState({
    arrivalDate: '',
    departureDate: '',
    adults: 2,
    children: 0,
    checkInTime: '',
    checkOutTime: '',
  });
  const [ratePlanCode, setRatePlanCode] = useState('FLEX');
  const [guest, setGuest] = useState(EMPTY_GUEST);
  const [autoCountry, setAutoCountry] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const nights = nightsBetween(stay.arrivalDate, stay.departureDate);
  const stayView = useMemo(() => ({ ...stay, nights }), [stay, nights]);

  // (Re)open: seed from the listing page, but resume an unpaid hold instead of creating a second one.
  useEffect(() => {
    if (!open) return;
    if (result && result.booking?.paymentStatus !== 'paid') return;
    const adults = Math.min(Math.max(1, initialAdults || 1), maxGuests);
    setStay({
      arrivalDate: initialCheckIn || '',
      departureDate: initialCheckOut || '',
      adults,
      children: Math.min(Math.max(0, initialChildren || 0), maxGuests - adults),
      checkInTime: '',
      checkOutTime: '',
    });
    setStep('stay');
    setReached(0);
    setErrors({});
    setSubmitError('');
    setAgreed(false);
    setResult(null);
  }, [open]);

  useEffect(() => {
    if (!open || config) return;
    kwentraApi
      .getBookingConfig()
      .then(setConfig)
      .catch(() => setSubmitError('bm.err.config'));
  }, [open, config]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    kwentraApi
      .getGeo()
      .catch(() => null)
      .then((geo) => {
        if (cancelled) return;
        const code = geo?.country || browserCountry();
        if (!code) return;
        setAutoCountry(code);
        setGuest((g) => ({
          ...g,
          nationality: g.nationality || code,
          reservationCountry: g.reservationCountry || code,
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const requestClose = useCallback(() => {
    if (!submitting) onClose?.();
  }, [submitting, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && requestClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, requestClose]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    scrollRef.current?.querySelector('[data-step-heading]')?.focus({ preventScroll: true });
  }, [step]);

  // The server prices with the PMS's own rates for this exact party; local maths is the instant fallback.
  const quoteKey = nights > 0 ? [stay.arrivalDate, stay.departureDate, stay.adults, stay.children].join('|') : '';
  const [serverQuote, setServerQuote] = useState(null);
  useEffect(() => {
    if (!open || !quoteKey || !listing?.slug) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      kwentraApi
        .quote({
          slug: listing.slug,
          arrivalDate: stay.arrivalDate,
          departureDate: stay.departureDate,
          adults: stay.adults,
          children: stay.children,
        })
        .then((q) => !cancelled && setServerQuote({ key: quoteKey, plans: q?.ratePlans || [] }))
        .catch(() => {});
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, quoteKey, listing?.slug]);

  const plans = config?.ratePlans || [];
  const quotes = useMemo(
    () =>
      plans.map((plan) => {
        const server = serverQuote?.key === quoteKey ? serverQuote.plans.find((p) => p.code === plan.code) : null;
        return {
          plan,
          eligible: nights >= plan.minNights,
          price: server
            ? {
                nights,
                baseTotal: server.rateAmount + (server.discount || 0),
                rateAmount: server.rateAmount,
                discount: server.discount || 0,
                averageNightlyRate: server.averageNightlyRate,
              }
            : priceStay({
                arrivalDate: stay.arrivalDate,
                departureDate: stay.departureDate,
                dailyPrices,
                fallbackNightly: listing?.pricePerNight,
                plan,
              }),
        };
      }),
    [plans, nights, stay.arrivalDate, stay.departureDate, dailyPrices, listing, serverQuote, quoteKey]
  );

  // A shorter stay can make the chosen plan ineligible (e.g. weekly) — fall back to the first eligible one.
  useEffect(() => {
    if (!quotes.length) return;
    const current = quotes.find((q) => q.plan.code === ratePlanCode);
    if (!current?.eligible) {
      const first = quotes.find((q) => q.eligible);
      if (first) setRatePlanCode(first.plan.code);
    }
  }, [quotes, ratePlanCode]);

  const selected = quotes.find((q) => q.plan.code === ratePlanCode) || null;
  const plan = selected?.plan || null;
  const price = selected?.price || (nights ? priceStay({ ...stay, dailyPrices, fallbackNightly: listing?.pricePerNight }) : null);

  const localized = (key, fallback) => {
    const s = t(key);
    return s === key ? fallback : s;
  };
  const planName = (p) => localized(`bm.plan.${p.code}`, p.name);
  const planDescription = (p) => localized(`bm.plan.${p.code}.desc`, p.description);

  const stepIndex = STEPS.indexOf(step);

  function goTo(target) {
    const idx = STEPS.indexOf(target);
    if (idx <= reached && step !== 'pay') setStep(target);
  }

  function advance() {
    let stepErrors = {};
    if (step === 'stay') stepErrors = validateStay(stay, maxGuests);
    if (step === 'rate') stepErrors = validateRate(plan, nights);
    if (step === 'guests') stepErrors = validateGuest(guest);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length) return;
    const next = STEPS[stepIndex + 1];
    setReached((r) => Math.max(r, stepIndex + 1));
    setStep(next);
  }

  async function submit() {
    if (!agreed) {
      setSubmitError('bm.err.agree');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await kwentraApi.bookDirect({
        slug: listing.slug,
        arrivalDate: stay.arrivalDate,
        departureDate: stay.departureDate,
        adults: stay.adults,
        children: stay.children,
        checkInTime: stay.checkInTime,
        checkOutTime: stay.checkOutTime,
        ratePlanCode,
        primaryGuestName: cleanName(guest.primaryGuestName),
        otherGuestNames: guest.otherGuestNames
          .slice(0, Math.max(0, stay.adults + stay.children - 1))
          .map(cleanName)
          .filter(Boolean),
        nationality: guest.nationality,
        reservationCountry: guest.reservationCountry,
        email: guest.email.trim(),
        phone: guest.phone.trim(),
        notes: guest.notes.trim(),
      });
      setResult(res);
      setReached(STEPS.length - 1);
      setStep('pay');
    } catch (err) {
      const fields = err.data?.fields || {};
      if (Object.keys(fields).length) {
        setErrors(fields);
        const firstStep = STEPS.find((s) => Object.keys(fields).some((f) => STEP_OF_FIELD[f] === s));
        if (firstStep) setStep(firstStep);
      }
      if (err.status === 409) onDatesTaken?.();
      setSubmitError(err.message || 'bm.err.generic');
    } finally {
      setSubmitting(false);
    }
  }

  const handlePaid = useCallback(() => {
    const booking = { ...result.booking, status: 'confirmed', paymentStatus: 'paid' };
    setResult((r) => ({ ...r, booking }));
    onBooked?.({ booking, pms: result.pms, email: guest.email.trim() });
  }, [result, onBooked, guest.email]);

  if (!open || !listing || typeof document === 'undefined') return null;

  const stepTitles = {
    stay: { title: t('bm.stayTitle'), lede: t('bm.stayLede') },
    rate: { title: t('bm.rateTitle'), lede: nights ? t('bm.rateLede', { count: nights }) : '' },
    guests: { title: t('bm.guestsTitle'), lede: t('bm.guestsLede') },
    review: { title: t('bm.reviewTitle'), lede: t('bm.reviewLede') },
    pay: {
      title: t('bm.payTitle'),
      lede: result?.booking?.voucherNumber ? t('bm.payLede', { voucher: result.booking.voucherNumber }) : '',
    },
  };
  const heading = (
    <StepHeading index={stepIndex} total={STEPS.length} title={stepTitles[step].title} lede={stepTitles[step].lede} />
  );

  const primaryLabel = {
    stay: t('bm.toRates'),
    rate: t('bm.toGuests'),
    guests: t('bm.toReview'),
    review: price?.rateAmount
      ? t('bm.confirmPay', { amount: formatMoney(price.rateAmount, listing.currency) })
      : t('bm.confirm'),
  }[step];

  const summaryProps = { listing, stay: stayView, plan, planName, price, config };

  return createPortal(
    <div className="fixed inset-0 z-[240] flex items-stretch justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-prime-night/60 backdrop-blur-[3px] animate-[primeFadeIn_0.25s_var(--prime-ease)_both]"
        onClick={requestClose}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bm-title"
        tabIndex={-1}
        className="relative flex h-dvh-100 w-full flex-col overflow-hidden bg-prime-surface shadow-premium-lg outline-none animate-[primeModalIn_0.45s_var(--prime-ease)_both] sm:h-dvh-modal sm:max-w-[44rem] sm:border sm:border-prime-line lg:max-w-[70rem] lg:flex-row"
      >
        <SummaryPanel {...summaryProps} className="hidden w-[23rem] shrink-0 lg:flex" />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-prime-line px-5 pb-4 pt-4 sm:px-8 sm:pt-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-prime-muted">
                  {t('bm.eyebrow')}
                </p>
                <h2 id="bm-title" className="mt-1 truncate font-display text-lg font-bold tracking-[-0.02em] text-prime-ink">
                  {term(listing.title)}
                </h2>
              </div>
              <button
                type="button"
                onClick={requestClose}
                className="grid h-10 w-10 shrink-0 place-items-center border border-prime-line text-prime-ink transition hover:border-prime-gold"
                aria-label={t('common.close')}
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>

            <ol className="mt-4 flex items-center gap-1.5" aria-label={t('bm.progress')}>
              {STEPS.map((s, i) => {
                const done = i < stepIndex || (s === 'pay' && result?.booking?.paymentStatus === 'paid');
                const current = i === stepIndex;
                const clickable = i <= reached && step !== 'pay' && !current;
                return (
                  <li key={s} className="flex min-w-0 flex-1 items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() => goTo(s)}
                      aria-current={current ? 'step' : undefined}
                      className="group flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 disabled:cursor-default sm:min-w-0 sm:shrink sm:justify-start"
                    >
                      <span
                        className={cn(
                          'grid h-6 w-6 shrink-0 place-items-center border text-[11px] font-bold tabular-nums transition',
                          current && 'border-prime-ink bg-prime-ink text-prime-sand',
                          done && !current && 'border-prime-gold bg-prime-gold text-white',
                          !done && !current && 'border-prime-line text-prime-muted',
                          clickable && 'group-hover:border-prime-gold-deep'
                        )}
                      >
                        {done && !current ? <Check size={12} strokeWidth={3} /> : i + 1}
                      </span>
                      <span
                        className={cn(
                          'hidden truncate text-[11px] font-semibold uppercase tracking-[0.16em] sm:inline',
                          current ? 'text-prime-ink' : 'text-prime-muted'
                        )}
                      >
                        {t(`bm.step.${s}`)}
                      </span>
                    </button>
                    {i < STEPS.length - 1 && (
                      <span className={cn('h-px min-w-[0.75rem] flex-1', i < stepIndex ? 'bg-prime-gold' : 'bg-prime-line')} />
                    )}
                  </li>
                );
              })}
            </ol>
          </header>

          <MobileSummary {...summaryProps} className="shrink-0 lg:hidden" />

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8">
            <div key={step} className="animate-[primeStepIn_0.35s_var(--prime-ease)_both]">
              {step === 'stay' && (
                <StayStep
                  stay={stayView}
                  setStay={setStay}
                  errors={errors}
                  listing={listing}
                  config={config}
                  blockedDates={blockedDates}
                  checkoutDates={checkoutDates}
                  dailyPrices={dailyPrices}
                  heading={heading}
                />
              )}
              {step === 'rate' && (
                <RateStep
                  quotes={quotes}
                  selected={ratePlanCode}
                  onSelect={setRatePlanCode}
                  error={errors.ratePlanCode}
                  currency={listing.currency}
                  loading={!config}
                  planName={planName}
                  planDescription={planDescription}
                  heading={heading}
                />
              )}
              {step === 'guests' && (
                <GuestStep
                  guest={guest}
                  setGuest={setGuest}
                  stay={stay}
                  errors={errors}
                  autoCountry={autoCountry}
                  heading={heading}
                />
              )}
              {step === 'review' && (
                <ReviewStep
                  listing={listing}
                  stay={stayView}
                  guest={guest}
                  plan={plan}
                  planName={planName}
                  price={price}
                  config={config}
                  goTo={goTo}
                  agreed={agreed}
                  setAgreed={(v) => {
                    setAgreed(v);
                    if (v && submitError === 'bm.err.agree') setSubmitError('');
                  }}
                  error={submitError}
                  heading={heading}
                />
              )}
              {step === 'pay' && result && (
                <section>
                  {heading}
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-prime-gold/40 bg-prime-gold/10 px-4 py-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-prime-gold-deep">
                        {t('bm.voucher')}
                      </p>
                      <p className="mt-0.5 font-display text-lg font-bold tracking-[0.02em] text-prime-ink">
                        {result.booking?.voucherNumber}
                      </p>
                    </div>
                    <p className="text-[12px] text-prime-muted">{t('bm.heldNote')}</p>
                  </div>
                  <PaymentPanel
                    payment={result.payment}
                    booking={result.booking}
                    amount={result.booking?.rateAmount}
                    currency={result.booking?.rateCurrency || listing.currency}
                    onPaid={handlePaid}
                  />
                </section>
              )}
              {step !== 'review' && step !== 'pay' && submitError && (
                <p className="mt-5 text-[13px] font-medium text-red-600" role="alert">
                  {t(submitError)}
                </p>
              )}
            </div>
          </div>

          {step !== 'pay' && (
            <footer className="flex shrink-0 items-center gap-3 border-t border-prime-line bg-prime-surface px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-8">
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep(STEPS[stepIndex - 1])}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-1 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted transition hover:text-prime-ink"
                >
                  <ArrowLeft size={14} className="rtl:rotate-180" aria-hidden />
                  {t('bm.back')}
                </button>
              ) : (
                <span className="text-[11px] text-prime-muted">{t('bm.noChargeYet')}</span>
              )}
              <button
                type="button"
                onClick={step === 'review' ? submit : advance}
                disabled={submitting || (step === 'rate' && !config)}
                className="prime-btn ms-auto px-6 disabled:cursor-not-allowed disabled:opacity-50 sm:px-8"
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" aria-hidden />
                    {t('bm.holding')}
                  </>
                ) : (
                  <>
                    {primaryLabel}
                    {step !== 'review' && <ArrowRight size={14} className="rtl:rotate-180" aria-hidden />}
                  </>
                )}
              </button>
            </footer>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
