import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, MessageCircle, X } from 'lucide-react';
import api from '../../api/client';
import { kwentraApi } from '../../services/api';
import { GUEST_AVAILABILITY_MONTHS } from '../../constants/availability';
import { whatsappHref } from '../../theme/brand';
import { useCurrency } from '../../context/CurrencyContext';
import { useLocale } from '../../context/LocaleContext';
import { findBrand, useBrands } from '../../context/SiteContext';
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
  pricesForGuests,
  validateGuest,
  validateRate,
  validateStay,
  clampParty,
  normalizeOccupancies,
} from './bookingUtils';

const EMPTY_GUEST = {
  primaryGuestName: '',
  otherGuestNames: [],
  nationality: '',
  reservationCountry: 'EG',
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
  occupancy = {},
  initialCheckIn = '',
  initialCheckOut = '',
  initialAdults = 2,
  initialChildren = 0,
  onBooked,
  onDatesTaken,
}) {
  const { t, term, locale } = useLocale();
  const { format, refresh } = useCurrency();
  useEffect(() => {
    if (open) refresh(true);
  }, [open, refresh]);
  const brands = useBrands();
  const brandMinNights = Math.max(
    1,
    Number(findBrand(brands, listing?.brand)?.minNights) || Number(listing?.minNights) || 1
  );
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
    checkInTime: '15:00',
    checkOutTime: '12:00',
  });
  const [ratePlanCode, setRatePlanCode] = useState('BB');
  const [guest, setGuest] = useState(EMPTY_GUEST);
  const [autoCountry, setAutoCountry] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [problem, setProblem] = useState(false);
  const [liveOccupancies, setLiveOccupancies] = useState([]);
  const scenarios = useMemo(
    () => (liveOccupancies.length ? liveOccupancies : normalizeOccupancies(listing?.occupancies)),
    [liveOccupancies, listing?.occupancies]
  );
  const maxGuests = scenarios.length
    ? Math.max(...scenarios.map((row) => row.adults + row.children))
    : listing?.maxGuests || 8;

  const nights = nightsBetween(stay.arrivalDate, stay.departureDate);
  const stayView = useMemo(() => ({ ...stay, nights }), [stay, nights]);
  const [partyPrices, setPartyPrices] = useState(null);
  const fromOccupancy = useMemo(
    () => pricesForGuests(occupancy, stay.adults, stay.children),
    [occupancy, stay.adults, stay.children]
  );
  const calendarPrices = Object.keys(fromOccupancy).length
    ? fromOccupancy
    : partyPrices || dailyPrices;

  // Occupancy grid is instant. When Kwentra didn't return adult columns, reload nightly rates for this party.
  useEffect(() => {
    if (!open || !listing?.slug || Object.keys(fromOccupancy).length) return undefined;
    let cancelled = false;
    const from = new Date();
    const toDate = new Date();
    toDate.setMonth(toDate.getMonth() + GUEST_AVAILABILITY_MONTHS);
    const iso = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const timer = setTimeout(() => {
      api
        .getListingPricing(listing.slug, {
          from: iso(from),
          to: iso(toDate),
          adults: stay.adults,
          children: stay.children,
        })
        .then((data) => {
          if (!cancelled) setPartyPrices(data?.prices && Object.keys(data.prices).length ? data.prices : null);
        })
        .catch(() => {
          if (!cancelled) setPartyPrices(null);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, listing?.slug, stay.adults, stay.children, fromOccupancy]);

  // (Re)open: seed from the listing page, but resume an unpaid hold instead of creating a second one.
  useEffect(() => {
    if (!open) return;
    if (result && result.booking?.paymentStatus !== 'paid') return;
    const party = clampParty(scenarios, initialAdults || 1, initialChildren || 0, maxGuests);
    setStay({
      arrivalDate: initialCheckIn || '',
      departureDate: initialCheckOut || '',
      adults: party.adults,
      children: party.children,
      checkInTime: '15:00',
      checkOutTime: '12:00',
    });
    setGuest((g) => ({ ...EMPTY_GUEST, nationality: g.nationality || '', reservationCountry: 'EG' }));
    setRatePlanCode('BB');
    setPartyPrices(null);
    setStep('stay');
    setReached(0);
    setErrors({});
    setSubmitError('');
    setProblem(false);
    setAgreed(false);
    setResult(null);
  }, [open]);

  useEffect(() => {
    if (!open || !listing?.slug) return undefined;
    let cancelled = false;
    api
      .getListingOccupancy(listing.slug)
      .then((data) => {
        if (!cancelled && Array.isArray(data?.occupancies)) setLiveOccupancies(normalizeOccupancies(data.occupancies));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, listing?.slug]);

  useEffect(() => {
    if (!open || !scenarios.length) return;
    setStay((current) => {
      const next = clampParty(scenarios, current.adults, current.children, maxGuests);
      if (next.adults === current.adults && next.children === current.children) return current;
      return { ...current, adults: next.adults, children: next.children };
    });
  }, [open, scenarios, maxGuests]);

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
          reservationCountry: 'EG',
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
        .then((q) => !cancelled && setServerQuote({ key: quoteKey, plans: q?.ratePlans || [], available: q?.available !== false }))
        .catch(() => {});
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, quoteKey, listing?.slug]);

  useEffect(() => {
    if (!serverQuote || serverQuote.key !== quoteKey) return;
    if (serverQuote.available === false) {
      setErrors((prev) => ({ ...prev, arrivalDate: 'bm.err.soldOut' }));
      setStep('stay');
      return;
    }
    setErrors((prev) => (prev.arrivalDate === 'bm.err.soldOut' ? { ...prev, arrivalDate: undefined } : prev));
  }, [serverQuote, quoteKey]);

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
                dailyPrices: calendarPrices,
                fallbackNightly: listing?.pricePerNight,
                plan,
              }),
        };
      })
        .filter((quote) => (serverQuote?.key === quoteKey ? quote.price.rateAmount > 0 : true)),
    [plans, nights, stay.arrivalDate, stay.departureDate, calendarPrices, listing, serverQuote, quoteKey]
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
  const price = selected?.price || (nights ? priceStay({ ...stay, dailyPrices: calendarPrices, fallbackNightly: listing?.pricePerNight }) : null);

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
    if (step === 'stay') {
      stepErrors = validateStay(stay, maxGuests, brandMinNights, scenarios);
      if (!stepErrors.arrivalDate && serverQuote?.key === quoteKey && serverQuote.available === false) {
        stepErrors = { ...stepErrors, arrivalDate: 'bm.err.soldOut' };
      }
    }
    if (step === 'rate') stepErrors = validateRate(plan, nights);
    if (step === 'guests') stepErrors = validateGuest(guest, stay);
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
        checkInTime: '15:00',
        checkOutTime: '12:00',
        ratePlanCode,
        brandMinNights,
        primaryGuestName: cleanName(guest.primaryGuestName),
        otherGuestNames: guest.otherGuestNames
          .slice(0, Math.max(0, stay.adults + stay.children - 1))
          .map(cleanName)
          .filter(Boolean),
        nationality: guest.nationality,
        reservationCountry: 'EG',
        email: guest.email.trim(),
        phone: guest.phone.trim(),
        notes: guest.notes.trim(),
        locale,
      });
      setResult(res);
      setProblem(false);
      setReached(STEPS.length - 1);
      setStep('pay');
    } catch (err) {
      const fields = err.data?.fields || {};
      if (err.data?.code === 'kwentra_rejected') {
        if (err.data.conflict) onDatesTaken?.();
        setProblem(true);
        return;
      }
      if (Object.keys(fields).length) {
        setErrors(fields);
        const firstStep = STEPS.find((s) => Object.keys(fields).some((f) => STEP_OF_FIELD[f] === s));
        if (firstStep) setStep(firstStep);
      }
      if (err.status === 409) {
        onDatesTaken?.();
        setSubmitError('bm.err.soldOut');
      } else {
        setSubmitError(err.message || 'bm.err.generic');
      }
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
      lede: t('bm.payLedeSimple'),
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
      ? t('bm.confirmPay', { amount: format(price.rateAmount) })
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
        className="relative flex h-dvh-100 w-full flex-col overflow-hidden bg-prime-sand shadow-premium-lg outline-none animate-[primeModalIn_0.45s_var(--prime-ease)_both] sm:h-dvh-modal sm:max-w-[48rem] sm:rounded-2xl sm:border sm:border-prime-line/70 lg:max-w-[76rem] lg:flex-row"
      >
        <SummaryPanel {...summaryProps} className={cn('hidden w-[24rem] shrink-0 lg:flex', problem && '!hidden')} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-prime-surface">
          <header className="shrink-0 border-b border-prime-line/70 px-5 pb-4 pt-5 sm:px-8 sm:pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-prime-gold-deep">{t('bm.eyebrow')}</p>
                <h2 id="bm-title" className="mt-1.5 truncate font-display text-2xl font-bold tracking-[-0.03em] text-prime-ink">
                  {term(listing.title)}
                </h2>
              </div>
              <button
                type="button"
                onClick={requestClose}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-prime-line text-prime-ink transition duration-300 hover:border-prime-ink hover:bg-prime-mist active:scale-95"
                aria-label={t('common.close')}
              >
                <X size={17} strokeWidth={1.5} />
              </button>
            </div>

            <div className={cn('relative mt-5', problem && 'hidden')} aria-label={t('bm.progress')}>
              <div className="absolute start-4 end-4 top-[15px] h-[2px] bg-prime-line" aria-hidden />
              <div
                className="absolute start-4 top-[15px] h-[2px] origin-left bg-prime-gold transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ width: `calc(${(stepIndex / Math.max(1, STEPS.length - 1)) * 100}% - 0rem)` }}
                aria-hidden
              />
              <ol className="relative flex items-start justify-between gap-1">
                {STEPS.map((s, i) => {
                  const done = i < stepIndex || (s === 'pay' && result?.booking?.paymentStatus === 'paid');
                  const current = i === stepIndex;
                  const clickable = i <= reached && step !== 'pay' && !current;
                  return (
                    <li key={s} className="flex min-w-0 flex-1 flex-col items-center">
                      <button
                        type="button"
                        disabled={!clickable}
                        onClick={() => goTo(s)}
                        aria-current={current ? 'step' : undefined}
                        className="group flex flex-col items-center gap-1.5 disabled:cursor-default"
                      >
                        <span
                          className={cn(
                            'grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold tabular-nums shadow-sm transition duration-400',
                            current && 'scale-110 bg-prime-ink text-prime-sand ring-4 ring-prime-ink/15',
                            done && !current && 'bg-prime-gold text-white',
                            !done && !current && 'border border-prime-line bg-prime-surface text-prime-muted',
                            clickable && 'group-hover:border-prime-gold group-hover:text-prime-ink'
                          )}
                        >
                          {done && !current ? <Check size={13} strokeWidth={2.5} /> : i + 1}
                        </span>
                        <span
                          className={cn(
                            'hidden max-w-[4.5rem] truncate text-center text-[10px] font-semibold uppercase tracking-[0.14em] sm:block',
                            current ? 'text-prime-ink' : 'text-prime-muted'
                          )}
                        >
                          {t(`bm.step.${s}`)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </header>

          <MobileSummary {...summaryProps} className={cn('shrink-0 lg:hidden', problem && 'hidden')} />

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8">
            {problem ? (
              <section className="mx-auto max-w-md py-8 text-center">
                <h3 className="font-display text-[1.65rem] font-bold leading-tight tracking-[-0.03em] text-prime-ink sm:text-3xl">
                  {t('bm.problemTitle')}
                </h3>
                <p className="mt-3 text-[15px] font-light leading-relaxed text-prime-muted">{t('bm.problemBody')}</p>
                <a
                  href={whatsappHref(
                    t('bm.problemWhatsappMsg', {
                      title: listing.title,
                      arrival: stay.arrivalDate,
                      departure: stay.departureDate,
                    })
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="prime-btn mt-8 inline-flex min-h-[48px] items-center gap-2 rounded-full px-7"
                >
                  <MessageCircle size={16} aria-hidden />
                  {t('bm.problemWhatsapp')}
                </a>
              </section>
            ) : (
            <div key={step} className="animate-[primeStepSlide_0.4s_var(--prime-ease)_both]">
              {step === 'stay' && (
                <StayStep
                  stay={stayView}
                  setStay={setStay}
                  guest={guest}
                  setGuest={setGuest}
                  errors={errors}
                  listing={{ ...listing, occupancies: scenarios.length ? scenarios : listing?.occupancies }}
                  config={config}
                  blockedDates={blockedDates}
                  checkoutDates={checkoutDates}
                  dailyPrices={calendarPrices}
                  minNights={brandMinNights}
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
                  <div className="mb-6 border border-prime-line px-5 py-4">
                    <p className="text-[13px] text-prime-muted">{t('bm.heldNote')}</p>
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
            )}
          </div>

          {!problem && step !== 'pay' && (
            <footer className="flex shrink-0 items-center gap-3 border-t border-prime-line bg-prime-sand/80 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:px-8">
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep(STEPS[stepIndex - 1])}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-full border border-prime-line px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted transition hover:border-prime-ink hover:text-prime-ink"
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
                className="prime-btn ms-auto min-h-[48px] rounded-full px-7 disabled:cursor-not-allowed disabled:opacity-50 sm:px-10"
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
