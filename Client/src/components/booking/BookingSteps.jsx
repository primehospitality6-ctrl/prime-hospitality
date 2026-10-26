import { useMemo } from 'react';
import { Check, Loader2, MapPin, Minus, Pencil, Plus } from 'lucide-react';
import ListingDatePicker, { isoToLocalDate, localDateToIso } from '../listing/ListingDatePicker';
import { useCurrency } from '../../context/CurrencyContext';
import { useLocale } from '../../context/LocaleContext';
import { cn } from '../../utils/cn';
import { countryName, countryOptions } from '../../utils/countries';
import { formatIsoDate, formatTime, normalizeOccupancies, stepParty } from './bookingUtils';

const labelCls = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-prime-muted';

export function StepHeading({ index, total, title, lede }) {
  const { t } = useLocale();
  return (
    <div className="mb-7">
      <div className="mb-3 flex items-center gap-3">
        <span className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-prime-gold/20 px-2 text-[11px] font-bold tabular-nums text-prime-gold-deep">
          {index + 1}/{total}
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-prime-gold/50 to-transparent" aria-hidden />
      </div>
      <h3 className="font-display text-[1.65rem] font-bold leading-tight tracking-[-0.03em] text-prime-ink sm:text-3xl" tabIndex={-1} data-step-heading>
        {title}
      </h3>
      {lede && <p className="mt-2 max-w-lg text-[15px] font-light leading-relaxed text-prime-muted">{lede}</p>}
      <span className="sr-only">{t('bm.stepOf', { n: index + 1, total })}</span>
    </div>
  );
}

function Tag({ children }) {
  return <span className="ms-1.5 normal-case tracking-normal text-prime-muted/80">({children})</span>;
}

export function Field({ label, required, optional, error, hint, htmlFor, children, className }) {
  const { t } = useLocale();
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={labelCls}>
        {label}
        {required && <span className="ms-0.5 text-prime-gold-deep">*</span>}
        {optional && <Tag>{t('bm.optional')}</Tag>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[12px] font-medium text-red-600" role="alert">
          {t(error)}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[11px] text-prime-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function inputCls(error) {
  return cn('prime-input', error && 'border-red-500 focus:border-red-500');
}

function Counter({ label, hint, value, min, max, onChange, onDecrease, onIncrease, decreaseDisabled, increaseDisabled, decLabel, incLabel }) {
  const decOff = decreaseDisabled ?? value <= min;
  const incOff = increaseDisabled ?? value >= max;
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-prime-mist/60 px-4 py-4">
      <div>
        <p className="text-sm font-semibold text-prime-ink">{label}</p>
        <p className="mt-0.5 text-[12px] text-prime-muted">{hint}</p>
      </div>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          aria-label={decLabel}
          disabled={decOff}
          onClick={() => (onDecrease ? onDecrease() : onChange(value - 1))}
          className="grid h-11 w-11 place-items-center rounded-full border border-prime-line bg-prime-surface text-prime-ink transition hover:border-prime-gold active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Minus size={16} strokeWidth={1.75} />
        </button>
        <span className="min-w-[2rem] text-center font-display text-2xl font-bold tabular-nums text-prime-ink" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          aria-label={incLabel}
          disabled={incOff}
          onClick={() => (onIncrease ? onIncrease() : onChange(value + 1))}
          className="grid h-11 w-11 place-items-center rounded-full border border-prime-line bg-prime-surface text-prime-ink transition hover:border-prime-gold active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Plus size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

function CountrySelect({ id, value, onChange, error, placeholder }) {
  const { t, localeTag } = useLocale();
  const { top, rest } = useMemo(() => countryOptions(localeTag), [localeTag]);
  return (
    <select id={id} className={inputCls(error)} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      <optgroup label={t('bm.popularCountries')}>
        {top.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </optgroup>
      <optgroup label={t('bm.allCountries')}>
        {rest.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

/* ─── Step 1 · Stay ─── */

export function StayStep({
  stay,
  setStay,
  guest,
  setGuest,
  errors,
  listing,
  config,
  blockedDates,
  checkoutDates,
  dailyPrices,
  minNights = 1,
  heading,
}) {
  const { t, term, localeTag } = useLocale();
  const scenarios = normalizeOccupancies(listing.occupancies);
  const limited = scenarios.length > 0;
  const maxGuests = limited
    ? Math.max(...scenarios.map((row) => row.adults + row.children))
    : listing.maxGuests || 8;
  const fewerAdults = stepParty(scenarios, stay.adults, stay.children, 'adults', -1, maxGuests);
  const moreAdults = stepParty(scenarios, stay.adults, stay.children, 'adults', 1, maxGuests);
  const fewerChildren = stepParty(scenarios, stay.adults, stay.children, 'children', -1, maxGuests);
  const moreChildren = stepParty(scenarios, stay.adults, stay.children, 'children', 1, maxGuests);
  const brandMin = Math.max(1, Number(minNights) || 1);
  const checkIn = config?.standardCheckIn || '15:00';
  const checkOut = config?.standardCheckOut || '12:00';
  const range = useMemo(
    () => ({ start: isoToLocalDate(stay.arrivalDate), end: isoToLocalDate(stay.departureDate) }),
    [stay.arrivalDate, stay.departureDate]
  );

  return (
    <section>
      {heading}

      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        <div
          className={cn(
            'rounded-2xl border px-3 py-3.5 sm:px-4',
            errors.arrivalDate ? 'border-red-400 bg-red-50' : 'border-prime-line bg-prime-mist/50'
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-prime-muted">{t('bm.arrival')}</p>
          <p className={cn('mt-1.5 text-sm font-semibold', stay.arrivalDate ? 'text-prime-ink' : 'text-prime-muted')}>
            {stay.arrivalDate
              ? formatIsoDate(stay.arrivalDate, localeTag, { weekday: 'short', month: 'short', day: 'numeric' })
              : t('common.addDate')}
          </p>
        </div>
        <div
          className={cn(
            'rounded-2xl border px-3 py-3.5 sm:px-4',
            errors.departureDate ? 'border-red-400 bg-red-50' : 'border-prime-line bg-prime-mist/50'
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-prime-muted">{t('bm.departure')}</p>
          <p className={cn('mt-1.5 text-sm font-semibold', stay.departureDate ? 'text-prime-ink' : 'text-prime-muted')}>
            {stay.departureDate
              ? formatIsoDate(stay.departureDate, localeTag, { weekday: 'short', month: 'short', day: 'numeric' })
              : t('common.addDate')}
          </p>
        </div>
        <div className="rounded-2xl border border-prime-gold/35 bg-prime-gold/10 px-3 py-3.5 sm:px-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-prime-gold-deep">{t('bm.nights')}</p>
          <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-prime-ink">{stay.nights || '—'}</p>
        </div>
      </div>
      {(errors.arrivalDate || errors.departureDate) && (
        <p className="mb-3 text-[12px] font-medium text-red-600" role="alert">
          {t(errors.arrivalDate || errors.departureDate, { count: brandMin })}
        </p>
      )}
      {brandMin > 1 && !errors.departureDate && (
        <p className="mb-3 text-[12px] text-prime-muted">{t('bm.brandMinStay', { count: brandMin })}</p>
      )}

      <div className="overflow-hidden rounded-2xl bg-prime-sand/80 p-3 ring-1 ring-prime-line/80 sm:p-5">
        <ListingDatePicker
          inline
          months={2}
          value={range}
          onChange={({ start, end }) =>
            setStay((s) => ({ ...s, arrivalDate: localDateToIso(start), departureDate: localDateToIso(end) }))
          }
          blockedDates={blockedDates}
          checkoutDates={checkoutDates}
          dailyPrices={dailyPrices}
          minNights={brandMin}
        />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <h4 className={labelCls}>
            {t('bm.whoComing')}
            <span className="ms-0.5 text-prime-gold-deep">*</span>
          </h4>
          <div className="mt-2 space-y-2.5">
            <Counter
              label={t('bm.adults')}
              hint={t('bm.adultsHint')}
              value={stay.adults}
              min={1}
              max={maxGuests}
              decreaseDisabled={fewerAdults.adults === stay.adults}
              increaseDisabled={moreAdults.adults === stay.adults}
              onDecrease={() => setStay((s) => ({ ...s, ...stepParty(scenarios, s.adults, s.children, 'adults', -1, maxGuests) }))}
              onIncrease={() => setStay((s) => ({ ...s, ...stepParty(scenarios, s.adults, s.children, 'adults', 1, maxGuests) }))}
              decLabel={t('bm.decrease', { what: t('bm.adults') })}
              incLabel={t('bm.increase', { what: t('bm.adults') })}
            />
            <Counter
              label={t('bm.children')}
              hint={t('bm.childrenHint')}
              value={stay.children}
              min={0}
              max={maxGuests}
              decreaseDisabled={fewerChildren.children === stay.children}
              increaseDisabled={moreChildren.children === stay.children}
              onDecrease={() => setStay((s) => ({ ...s, ...stepParty(scenarios, s.adults, s.children, 'children', -1, maxGuests) }))}
              onIncrease={() => setStay((s) => ({ ...s, ...stepParty(scenarios, s.adults, s.children, 'children', 1, maxGuests) }))}
              decLabel={t('bm.decrease', { what: t('bm.children') })}
              incLabel={t('bm.increase', { what: t('bm.children') })}
            />
          </div>
          <p className={cn('mt-2.5 text-[11px]', errors.adults ? 'font-medium text-red-600' : 'text-prime-muted')}>
            {errors.adults
              ? t(errors.adults, { count: maxGuests })
              : limited
                ? t('bm.occupancyLead')
                : t('bm.sleepsUpTo', { count: maxGuests, type: term(listing.unitType) || '' })}
          </p>
          {limited && scenarios.length <= 18 ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {scenarios.map((row) => {
                const active = stay.adults === row.adults && stay.children === row.children;
                return (
                  <button
                    key={`${row.adults}-${row.children}`}
                    type="button"
                    onClick={() => setStay((s) => ({ ...s, adults: row.adults, children: row.children }))}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                      active
                        ? 'border-prime-gold bg-prime-gold/15 text-prime-ink'
                        : 'border-prime-line bg-prime-surface text-prime-muted hover:border-prime-gold'
                    )}
                  >
                    {row.adults} {t('bm.adults')} · {row.children} {t('bm.children')}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div>
          <h4 className={labelCls}>{t('bm.times')}</h4>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-prime-line bg-prime-mist/50 px-4 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-prime-muted">{t('bm.checkInTime')}</p>
              <p className="mt-1.5 text-sm font-semibold text-prime-ink">{formatTime(checkIn, localeTag)}</p>
            </div>
            <div className="rounded-2xl border border-prime-line bg-prime-mist/50 px-4 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-prime-muted">{t('bm.checkOutTime')}</p>
              <p className="mt-1.5 text-sm font-semibold text-prime-ink">{formatTime(checkOut, localeTag)}</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-prime-muted">{t('bm.timesFixed')}</p>
          <p className="mt-1 text-[11px] font-medium text-prime-ink/80">{t('bm.lateCharges')}</p>
        </div>
      </div>

      <div className="mt-8">
        <Field label={t('bm.requests')} optional htmlFor="bm-notes" hint={t('bm.requestsHint')}>
          <textarea
            id="bm-notes"
            className="prime-input min-h-[88px] resize-y"
            value={guest?.notes || ''}
            onChange={(e) => setGuest((g) => ({ ...g, notes: e.target.value }))}
            maxLength={1000}
            placeholder={t('bm.requestsPlaceholder')}
          />
        </Field>
      </div>
    </section>
  );
}

/* ─── Step 2 · Rate plan ─── */

export function RateStep({ quotes, selected, onSelect, error, currency: _currency, loading, planName, planDescription, heading }) {
  const { t } = useLocale();
  const { format } = useCurrency();
  if (loading) {
    return (
      <section>
        {heading}
        <p className="flex items-center gap-2 text-sm text-prime-muted">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          {t('bm.loadingRates')}
        </p>
      </section>
    );
  }
  return (
    <section>
      {heading}
      <div role="radiogroup" aria-label={t('bm.ratePlan')} className="space-y-3">
        {quotes.map(({ plan, eligible, price }) => {
          const active = selected === plan.code;
          return (
            <label
              key={plan.code}
              className={cn(
                'relative flex gap-4 overflow-hidden rounded-2xl border p-4 transition duration-300 sm:p-5',
                eligible ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
                active
                  ? 'border-prime-ink bg-prime-sand shadow-[0_12px_40px_rgba(34,31,32,0.08)] ring-1 ring-prime-ink'
                  : 'border-prime-line bg-prime-surface hover:border-prime-gold hover:bg-prime-mist/40'
              )}
            >
              {active && (
                <span className="absolute inset-y-0 start-0 w-1 bg-prime-gold animate-[primeFadeIn_0.3s_ease_both]" aria-hidden />
              )}
              <input
                type="radio"
                name="bm-rate"
                className="sr-only"
                value={plan.code}
                checked={active}
                disabled={!eligible}
                onChange={() => onSelect(plan.code)}
              />
              <span
                className={cn(
                  'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border transition duration-300',
                  active ? 'scale-110 border-prime-ink bg-prime-ink text-prime-sand' : 'border-prime-line'
                )}
                aria-hidden
              >
                {active && <Check size={13} strokeWidth={2.5} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <span className="font-semibold text-prime-ink">{planName(plan)}</span>
                  <span className="text-end">
                    {price.discount > 0 && (
                      <span className="me-2 text-xs tabular-nums text-prime-muted line-through">
                        {format(price.baseTotal)}
                      </span>
                    )}
                    <span className="font-display text-2xl font-bold tabular-nums tracking-[-0.03em] text-prime-ink">
                      {format(price.rateAmount)}
                    </span>
                  </span>
                </span>
                <span className="mt-1.5 block text-[13px] leading-relaxed text-prime-muted">{planDescription(plan)}</span>
                <span className="mt-3.5 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em]',
                      plan.refundable ? 'border-emerald-600/30 text-emerald-700 dark:text-emerald-400' : 'border-prime-line text-prime-muted'
                    )}
                  >
                    {plan.refundable ? t('bm.refundable') : t('bm.nonRefundable')}
                  </span>
                  {plan.adjustmentPct < 0 && (
                    <span className="rounded-full bg-prime-gold/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-prime-gold-deep">
                      {t('bm.savePct', { pct: Math.abs(plan.adjustmentPct) })}
                    </span>
                  )}
                  {!eligible && (
                    <span className="text-[11px] font-medium text-prime-ink">{t('bm.minNights', { count: plan.minNights })}</span>
                  )}
                  {eligible && price.nights > 0 && (
                    <span className="ms-auto text-[11px] text-prime-muted">
                      {t('bm.avgNight', { amount: format(price.averageNightlyRate) })}
                    </span>
                  )}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p className="mt-2 text-[12px] font-medium text-red-600" role="alert">
          {t(error)}
        </p>
      )}
      <p className="mt-4 text-[11px] text-prime-muted">{t('bm.ratesInclude')}</p>
    </section>
  );
}

/* ─── Step 3 · Guest details ─── */

export function GuestStep({ guest, setGuest, stay, errors, autoCountry, heading }) {
  const { t } = useLocale();
  const extra = Math.max(0, stay.adults + stay.children - 1);
  const set = (key) => (e) => setGuest((g) => ({ ...g, [key]: e.target.value }));
  const autoHint = autoCountry ? (
    <span className="inline-flex items-center gap-1">
      <MapPin size={11} aria-hidden />
      {t('bm.autoDetected')}
    </span>
  ) : null;

  return (
    <section>
      {heading}
      <div className="grid gap-5">
        <Field
          label={t('bm.primaryGuest')}
          required
          htmlFor="bm-name"
          error={errors.primaryGuestName}
          hint={t('bm.primaryGuestHint')}
        >
          <input
            id="bm-name"
            className={inputCls(errors.primaryGuestName)}
            value={guest.primaryGuestName}
            onChange={set('primaryGuestName')}
            autoComplete="name"
            placeholder={t('bm.namePlaceholder')}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('bm.email')} required htmlFor="bm-email" error={errors.email} hint={t('bm.emailHint')}>
            <input
              id="bm-email"
              type="email"
              className={inputCls(errors.email)}
              value={guest.email}
              onChange={set('email')}
              autoComplete="email"
              placeholder="name@example.com"
            />
          </Field>
          <Field label={t('bm.phone')} required htmlFor="bm-phone" error={errors.phone}>
            <input
              id="bm-phone"
              type="tel"
              dir="ltr"
              className={cn(inputCls(errors.phone), 'rtl:text-end')}
              value={guest.phone}
              onChange={set('phone')}
              autoComplete="tel"
              placeholder="+20 100 000 0000"
            />
          </Field>
        </div>

        <Field
          label={t('bm.nationality')}
          optional
          htmlFor="bm-nat"
          error={errors.nationality}
          hint={autoCountry && guest.nationality === autoCountry ? autoHint : null}
        >
          <CountrySelect
            id="bm-nat"
            value={guest.nationality}
            onChange={(nationality) => setGuest((g) => ({ ...g, nationality }))}
            error={errors.nationality}
            placeholder={t('bm.selectCountry')}
          />
        </Field>

        {extra > 0 && (
          <fieldset className="border border-prime-line p-4 sm:p-5">
            <legend className="px-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-prime-muted">
              {t('bm.otherGuests')}
            </legend>
            <p className="mb-4 text-[12px] text-prime-muted">{t('bm.otherGuestsHint')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: extra }, (_, i) => {
                const isChild = i + 1 >= stay.adults;
                return (
                  <div key={i}>
                    <label htmlFor={`bm-other-${i}`} className="mb-1 block text-[11px] text-prime-muted">
                      {t('bm.guestN', { n: i + 2 })} · {isChild ? t('bm.child') : t('bm.adult')}
                    </label>
                    <input
                      id={`bm-other-${i}`}
                      className={inputCls(errors.otherGuestNames && guest.otherGuestNames[i])}
                      value={guest.otherGuestNames[i] || ''}
                      onChange={(e) =>
                        setGuest((g) => {
                          const next = [...g.otherGuestNames];
                          next[i] = e.target.value;
                          return { ...g, otherGuestNames: next };
                        })
                      }
                      placeholder={t('bm.namePlaceholder')}
                    />
                  </div>
                );
              })}
            </div>
            {errors.otherGuestNames && (
              <p className="mt-2 text-[12px] font-medium text-red-600" role="alert">
                {t(errors.otherGuestNames)}
              </p>
            )}
          </fieldset>
        )}
      </div>
    </section>
  );
}

/* ─── Step 4 · Review ─── */

function ReviewGroup({ title, onEdit, rows }) {
  const { t } = useLocale();
  return (
    <div className="border border-prime-line">
      <div className="flex items-center justify-between border-b border-prime-line bg-prime-mist/50 px-4 py-2.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-prime-ink">{title}</h4>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-prime-gold-deep underline-offset-4 hover:underline"
          >
            <Pencil size={11} aria-hidden />
            {t('bm.edit')}
          </button>
        )}
      </div>
      <dl className="grid px-4 sm:grid-cols-2 sm:gap-x-8">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-prime-line/70 py-2.5 text-[13px]">
            <dt className="shrink-0 text-prime-muted">{row.label}</dt>
            <dd className="m-0 min-w-0 break-words text-end font-medium text-prime-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ReviewStep({ listing, stay, guest, plan, planName, price, config, goTo, agreed, setAgreed, error, heading }) {
  const { format } = useCurrency();
  const { t, term, localeTag } = useLocale();
  const none = <span className="text-prime-muted">—</span>;
  const others = guest.otherGuestNames.map((n) => n.trim()).filter(Boolean);
  const country = (code) => (code ? `${countryName(code, localeTag)} (${code})` : none);
  const checkIn = formatTime(config?.standardCheckIn || '15:00', localeTag);
  const checkOut = formatTime(config?.standardCheckOut || '12:00', localeTag);
  const requestText = guest.notes?.trim();

  return (
    <section>
      {heading}
      <div className="space-y-4">
        <ReviewGroup
          title={t('bm.groupStay')}
          onEdit={() => goTo('stay')}
          rows={[
            { label: t('bm.arrivalDate'), value: formatIsoDate(stay.arrivalDate, localeTag) },
            { label: t('bm.departureDate'), value: formatIsoDate(stay.departureDate, localeTag) },
            { label: t('bm.nights'), value: stay.nights },
            { label: t('bm.checkInTime'), value: checkIn },
            { label: t('bm.checkOutTime'), value: checkOut },
            { label: t('bm.adults'), value: stay.adults },
            { label: t('bm.children'), value: stay.children },
            ...(requestText ? [{ label: t('bm.requests'), value: requestText }] : []),
          ]}
        />
        <ReviewGroup
          title={t('bm.groupGuests')}
          onEdit={() => goTo('guests')}
          rows={[
            { label: t('bm.primaryGuest'), value: guest.primaryGuestName.trim() },
            { label: t('bm.otherGuests'), value: others.length ? others.join(', ') : none },
            { label: t('bm.nationality'), value: country(guest.nationality) },
            { label: t('bm.email'), value: guest.email.trim() },
            { label: t('bm.phone'), value: <span dir="ltr">{guest.phone.trim()}</span> },
          ]}
        />
        <ReviewGroup
          title={t('bm.groupRoom')}
          onEdit={() => goTo('rate')}
          rows={[
            { label: t('bm.destination'), value: term(listing.destination || listing.region) || none },
            { label: t('bm.property'), value: term(listing.compound) || none },
            { label: t('bm.roomType'), value: term(listing.unitType || listing.propertyType) || none },
            { label: t('bm.ratePlan'), value: plan ? planName(plan) : none },
            { label: t('bm.rateAmount'), value: format(price?.rateAmount) },
            { label: t('bm.rateCurrency'), value: 'USD' },
          ]}
        />
      </div>

      <label className="mt-6 flex cursor-pointer items-start gap-3 text-[13px] text-prime-ink">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--prime-gold)]"
        />
        <span>
          {t('bm.agree')}{' '}
          <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-4">
            {t('bm.terms')}
          </a>
          {plan && !plan.refundable ? ` ${t('bm.agreeNonRefundable')}` : ''}
        </span>
      </label>
      {error && (
        <p className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" role="alert">
          {t(error)}
        </p>
      )}
    </section>
  );
}
