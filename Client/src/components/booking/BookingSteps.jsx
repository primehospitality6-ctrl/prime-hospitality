import { useMemo } from 'react';
import { Check, Loader2, MapPin, Minus, Pencil, Plus } from 'lucide-react';
import ListingDatePicker, { isoToLocalDate, localDateToIso } from '../listing/ListingDatePicker';
import { formatMoney } from '../../theme/brand';
import { useLocale } from '../../context/LocaleContext';
import { cn } from '../../utils/cn';
import { countryName, countryOptions } from '../../utils/countries';
import { formatIsoDate, formatTime } from './bookingUtils';

const labelCls = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-prime-muted';

export function StepHeading({ index, total, title, lede }) {
  const { t } = useLocale();
  return (
    <div className="mb-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-prime-gold-deep">
        {t('bm.stepOf', { n: index + 1, total })}
      </p>
      <h3 className="mt-1.5 font-display text-2xl font-bold tracking-[-0.02em] text-prime-ink" tabIndex={-1} data-step-heading>
        {title}
      </h3>
      {lede && <p className="mt-1.5 text-sm text-prime-muted">{lede}</p>}
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

function Counter({ label, hint, value, min, max, onChange, decLabel, incLabel }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div>
        <p className="text-sm font-semibold text-prime-ink">{label}</p>
        <p className="text-[12px] text-prime-muted">{hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={decLabel}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="grid h-9 w-9 place-items-center border border-prime-line text-prime-ink transition hover:border-prime-gold disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Minus size={15} strokeWidth={1.75} />
        </button>
        <span className="min-w-[1.5rem] text-center font-display text-lg font-bold tabular-nums text-prime-ink" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          aria-label={incLabel}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="grid h-9 w-9 place-items-center border border-prime-line text-prime-ink transition hover:border-prime-gold disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Plus size={15} strokeWidth={1.75} />
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

export function StayStep({ stay, setStay, errors, listing, config, blockedDates, checkoutDates, dailyPrices, heading }) {
  const { t, term, localeTag } = useLocale();
  const maxGuests = listing.maxGuests || 8;
  const range = useMemo(
    () => ({ start: isoToLocalDate(stay.arrivalDate), end: isoToLocalDate(stay.departureDate) }),
    [stay.arrivalDate, stay.departureDate]
  );

  const dateCell = (label, iso, error) => (
    <div className={cn('px-4 py-3', error && 'bg-red-50 dark:bg-red-950/30')}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted">{label}</p>
      <p className={cn('mt-1 text-sm font-semibold', iso ? 'text-prime-ink' : 'text-prime-muted')}>
        {iso ? formatIsoDate(iso, localeTag, { weekday: 'short', month: 'short', day: 'numeric' }) : t('common.addDate')}
      </p>
    </div>
  );

  return (
    <section>
      {heading}
      <div className="border border-prime-line p-4 sm:p-5">
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
          minNights={1}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 divide-x divide-prime-line border border-prime-line rtl:divide-x-reverse">
        {dateCell(t('bm.arrival'), stay.arrivalDate, errors.arrivalDate)}
        {dateCell(t('bm.departure'), stay.departureDate, errors.departureDate)}
        <div className="bg-prime-mist/60 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted">{t('bm.nights')}</p>
          <p className="mt-1 text-sm font-semibold text-prime-ink">
            {stay.nights || '—'}
            <span className="ms-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-prime-muted">{t('bm.auto')}</span>
          </p>
        </div>
      </div>
      {(errors.arrivalDate || errors.departureDate) && (
        <p className="mt-1.5 text-[12px] font-medium text-red-600" role="alert">
          {t(errors.arrivalDate || errors.departureDate)}
        </p>
      )}

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h4 className={labelCls}>
            {t('bm.whoComing')}
            <span className="ms-0.5 text-prime-gold-deep">*</span>
          </h4>
          <div className="divide-y divide-prime-line border-y border-prime-line">
            <Counter
              label={t('bm.adults')}
              hint={t('bm.adultsHint')}
              value={stay.adults}
              min={1}
              max={maxGuests - stay.children}
              onChange={(adults) => setStay((s) => ({ ...s, adults }))}
              decLabel={t('bm.decrease', { what: t('bm.adults') })}
              incLabel={t('bm.increase', { what: t('bm.adults') })}
            />
            <Counter
              label={t('bm.children')}
              hint={t('bm.childrenHint')}
              value={stay.children}
              min={0}
              max={maxGuests - stay.adults}
              onChange={(children) => setStay((s) => ({ ...s, children }))}
              decLabel={t('bm.decrease', { what: t('bm.children') })}
              incLabel={t('bm.increase', { what: t('bm.children') })}
            />
          </div>
          <p className={cn('mt-2 text-[11px]', errors.adults ? 'font-medium text-red-600' : 'text-prime-muted')}>
            {errors.adults ? t(errors.adults, { count: maxGuests }) : t('bm.sleepsUpTo', { count: maxGuests, type: term(listing.unitType) || '' })}
          </p>
        </div>

        <div>
          <h4 className={labelCls}>
            {t('bm.times')}
            <Tag>{t('bm.optional')}</Tag>
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('bm.checkInTime')} htmlFor="bm-cin" error={errors.checkInTime}>
              <select
                id="bm-cin"
                className="prime-input"
                value={stay.checkInTime}
                onChange={(e) => setStay((s) => ({ ...s, checkInTime: e.target.value }))}
              >
                <option value="">
                  {t('bm.standardTime', { time: formatTime(config?.standardCheckIn || '15:00', localeTag) })}
                </option>
                {(config?.checkInTimes || []).map((tm) => (
                  <option key={tm} value={tm}>
                    {formatTime(tm, localeTag)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('bm.checkOutTime')} htmlFor="bm-cout" error={errors.checkOutTime}>
              <select
                id="bm-cout"
                className="prime-input"
                value={stay.checkOutTime}
                onChange={(e) => setStay((s) => ({ ...s, checkOutTime: e.target.value }))}
              >
                <option value="">
                  {t('bm.standardTime', { time: formatTime(config?.standardCheckOut || '12:00', localeTag) })}
                </option>
                {(config?.checkOutTimes || []).map((tm) => (
                  <option key={tm} value={tm}>
                    {formatTime(tm, localeTag)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="mt-2 text-[11px] text-prime-muted">{t('bm.timesHint')}</p>
        </div>
      </div>
    </section>
  );
}

/* ─── Step 2 · Rate plan ─── */

export function RateStep({ quotes, selected, onSelect, error, currency, loading, planName, planDescription, heading }) {
  const { t } = useLocale();
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
                'relative flex gap-4 border p-4 transition sm:p-5',
                eligible ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
                active ? 'border-prime-ink bg-prime-sand ring-1 ring-prime-ink' : 'border-prime-line hover:border-prime-gold'
              )}
            >
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
                  'mt-0.5 grid h-5 w-5 shrink-0 place-items-center border transition',
                  active ? 'border-prime-ink bg-prime-ink text-prime-sand' : 'border-prime-line'
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
                        {formatMoney(price.baseTotal, currency)}
                      </span>
                    )}
                    <span className="font-display text-xl font-bold tabular-nums tracking-[-0.02em] text-prime-ink">
                      {formatMoney(price.rateAmount, currency)}
                    </span>
                  </span>
                </span>
                <span className="mt-1 block text-[13px] leading-relaxed text-prime-muted">{planDescription(plan)}</span>
                <span className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em]',
                      plan.refundable ? 'border-emerald-600/30 text-emerald-700 dark:text-emerald-400' : 'border-prime-line text-prime-muted'
                    )}
                  >
                    {plan.refundable ? t('bm.refundable') : t('bm.nonRefundable')}
                  </span>
                  {plan.adjustmentPct < 0 && (
                    <span className="bg-prime-gold/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-prime-gold-deep">
                      {t('bm.savePct', { pct: Math.abs(plan.adjustmentPct) })}
                    </span>
                  )}
                  {!eligible && (
                    <span className="text-[11px] font-medium text-prime-ink">{t('bm.minNights', { count: plan.minNights })}</span>
                  )}
                  {eligible && price.nights > 0 && (
                    <span className="ms-auto text-[11px] text-prime-muted">
                      {t('bm.avgNight', { amount: formatMoney(price.averageNightlyRate, currency) })}
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

        <div className="grid gap-5 sm:grid-cols-2">
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
          <Field
            label={t('bm.reservationCountry')}
            required
            htmlFor="bm-country"
            error={errors.reservationCountry}
            hint={
              autoCountry && guest.reservationCountry === autoCountry ? autoHint : t('bm.reservationCountryHint')
            }
          >
            <CountrySelect
              id="bm-country"
              value={guest.reservationCountry}
              onChange={(reservationCountry) => setGuest((g) => ({ ...g, reservationCountry }))}
              error={errors.reservationCountry}
              placeholder={t('bm.selectCountry')}
            />
          </Field>
        </div>

        {extra > 0 && (
          <fieldset className="border border-prime-line p-4 sm:p-5">
            <legend className="px-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-prime-muted">
              {t('bm.otherGuests')}
              <Tag>{t('bm.optional')}</Tag>
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

        <Field label={t('bm.requests')} optional htmlFor="bm-notes">
          <textarea
            id="bm-notes"
            className="prime-input min-h-[88px] resize-y"
            value={guest.notes}
            onChange={set('notes')}
            maxLength={1000}
            placeholder={t('bm.requestsPlaceholder')}
          />
        </Field>
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
  const { t, term, localeTag } = useLocale();
  const none = <span className="text-prime-muted">—</span>;
  const others = guest.otherGuestNames.map((n) => n.trim()).filter(Boolean);
  const country = (code) => (code ? `${countryName(code, localeTag)} (${code})` : none);
  const time = (value, standard) =>
    value ? formatTime(value, localeTag) : t('bm.standardTime', { time: formatTime(standard, localeTag) });

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
            { label: t('bm.checkInTime'), value: time(stay.checkInTime, config?.standardCheckIn || '15:00') },
            { label: t('bm.checkOutTime'), value: time(stay.checkOutTime, config?.standardCheckOut || '12:00') },
            { label: t('bm.adults'), value: stay.adults },
            { label: t('bm.children'), value: stay.children },
          ]}
        />
        <ReviewGroup
          title={t('bm.groupGuests')}
          onEdit={() => goTo('guests')}
          rows={[
            { label: t('bm.primaryGuest'), value: guest.primaryGuestName.trim() },
            { label: t('bm.otherGuests'), value: others.length ? others.join(', ') : none },
            { label: t('bm.nationality'), value: country(guest.nationality) },
            { label: t('bm.reservationCountry'), value: country(guest.reservationCountry) },
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
            { label: t('bm.rateAmount'), value: formatMoney(price?.rateAmount, listing.currency) },
            { label: t('bm.rateCurrency'), value: listing.currency || 'EGP' },
          ]}
        />
        <ReviewGroup
          title={t('bm.groupReservation')}
          rows={[
            { label: t('bm.channel'), value: config?.channel || 'Website' },
            { label: t('bm.voucher'), value: <span className="text-prime-muted">{t('bm.voucherPending')}</span> },
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
