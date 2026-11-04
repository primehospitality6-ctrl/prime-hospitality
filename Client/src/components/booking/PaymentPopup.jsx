import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, Lock, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { cn } from '../../utils/cn';

const CARD_MARKS = ['Visa', 'Mastercard', 'Meeza'];

/** Placeholder card form shown while Paymob's iframe loads. */
function FormSkeleton() {
  const bar = 'rounded-lg bg-prime-line/70 animate-pulse';
  return (
    <div className="absolute inset-0 space-y-5 bg-white p-6" aria-hidden>
      <div className={cn(bar, 'h-3 w-24')} />
      <div className={cn(bar, 'h-12 w-full')} />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className={cn(bar, 'h-3 w-16')} />
          <div className={cn(bar, 'h-12')} />
        </div>
        <div className="space-y-2">
          <div className={cn(bar, 'h-3 w-12')} />
          <div className={cn(bar, 'h-12')} />
        </div>
      </div>
      <div className={cn(bar, 'h-3 w-28')} />
      <div className={cn(bar, 'h-12 w-full')} />
      <div className={cn(bar, 'mt-8 h-12 w-full')} />
    </div>
  );
}

function StatusIcon({ tone, children }) {
  return (
    <span
      className={cn(
        'grid h-16 w-16 place-items-center rounded-full animate-[primeModalIn_0.5s_var(--prime-ease)_both]',
        tone === 'ok' && 'bg-prime-gold text-white shadow-[0_12px_32px_-8px_var(--prime-gold)]',
        tone === 'bad' && 'bg-red-50 text-red-600 ring-1 ring-red-200 dark:bg-red-950/40 dark:ring-red-900'
      )}
    >
      {children}
    </span>
  );
}

/**
 * The card payment popup. Paymob's card form loads inside it, so the guest never leaves the site.
 * phase: 'form' (card form), 'checking' (waiting for the server to confirm), 'paid', 'declined'.
 */
export default function PaymentPopup({
  open,
  onClose,
  payment,
  amountLabel,
  chargeLabel,
  phase = 'form',
  declineMessage = '',
  frameKey = 0,
  onRetry,
  isMock = false,
  onMockPay,
  mockBusy = false,
  error = '',
}) {
  const { t } = useLocale();
  const dialogRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const closable = phase !== 'paid';

  useEffect(() => setLoaded(false), [frameKey, payment?.iframeSrc]);

  useEffect(() => {
    if (!open) return undefined;
    dialogRef.current?.focus({ preventScroll: true });
    // Capture phase so Escape closes only this popup, not the booking window behind it.
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (closable) onClose?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, closable, onClose]);

  if (!open || !payment || typeof document === 'undefined') return null;

  const showForm = !isMock && payment.iframeSrc && (phase === 'form' || phase === 'checking');

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-prime-band/70 backdrop-blur-[6px] animate-[primeFadeIn_0.25s_var(--prime-ease)_both]"
        onClick={closable ? onClose : undefined}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-title"
        tabIndex={-1}
        className="relative flex max-h-dvh-90 w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-prime-line/70 bg-prime-surface shadow-premium-lg outline-none animate-[primeModalIn_0.45s_var(--prime-ease)_both] sm:max-w-[31rem] sm:rounded-[1.75rem]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 px-6 pb-4 pt-6">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.26em] text-prime-gold-deep">
              <Lock size={12} strokeWidth={2.2} aria-hidden />
              {t('pay.secure')}
            </p>
            <h2 id="pay-title" className="mt-1.5 font-display text-[1.6rem] font-bold leading-tight tracking-[-0.03em] text-prime-ink">
              {t('pay.title')}
            </h2>
          </div>
          {closable ? (
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-prime-line text-prime-ink transition duration-300 hover:border-prime-ink hover:bg-prime-mist active:scale-95"
              aria-label={t('common.close')}
            >
              <X size={16} strokeWidth={1.6} />
            </button>
          ) : null}
        </header>

        <div className="mx-6 flex shrink-0 items-end justify-between gap-4 rounded-2xl bg-prime-mist/70 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted">{t('pay.total')}</p>
            {chargeLabel ? (
              <p className="mt-1 text-[12px] leading-snug text-prime-muted">{t('pay.chargedAs', { amount: chargeLabel })}</p>
            ) : null}
          </div>
          <p className="shrink-0 font-display text-[1.65rem] font-bold leading-none tabular-nums tracking-[-0.02em] text-prime-ink">
            {amountLabel}
          </p>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {showForm ? (
            <div className="relative overflow-hidden rounded-2xl border border-prime-line/70 bg-white">
              {!loaded ? <FormSkeleton /> : null}
              <iframe
                key={frameKey}
                title={t('bm.cardPayment')}
                src={payment.iframeSrc}
                onLoad={() => setLoaded(true)}
                className={cn('block h-[600px] w-full border-0 transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')}
                allow="payment *"
              />
              {phase === 'checking' ? (
                <div className="absolute inset-0 grid place-items-center bg-prime-surface/90 backdrop-blur-sm animate-[primeFadeIn_0.3s_var(--prime-ease)_both]">
                  <div className="flex flex-col items-center gap-3 px-6 text-center" role="status">
                    <Loader2 size={28} className="animate-spin text-prime-gold" aria-hidden />
                    <p className="font-display text-lg font-semibold text-prime-ink">{t('pay.checking')}</p>
                    <p className="max-w-xs text-[13px] text-prime-muted">{t('pay.checkingBody')}</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {isMock && phase !== 'paid' ? (
            <div className="flex flex-col items-center gap-5 px-4 py-10 text-center">
              <p className="max-w-xs text-sm text-prime-muted">{t('bm.mockGateway')}</p>
              <button type="button" className="prime-btn min-h-[48px] rounded-full px-8" disabled={mockBusy} onClick={onMockPay}>
                {mockBusy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Lock size={14} aria-hidden />}
                {mockBusy ? t('bm.confirming') : t('bm.payNow', { amount: amountLabel })}
              </button>
            </div>
          ) : null}

          {phase === 'paid' ? (
            <div className="flex flex-col items-center gap-4 px-6 py-12 text-center" role="status">
              <StatusIcon tone="ok">
                <Check size={30} strokeWidth={2.6} />
              </StatusIcon>
              <h3 className="font-display text-2xl font-bold tracking-[-0.03em] text-prime-ink">{t('pay.paidTitle')}</h3>
              <p className="max-w-xs text-[14px] leading-relaxed text-prime-muted">{t('pay.paidBody')}</p>
            </div>
          ) : null}

          {phase === 'declined' ? (
            <div className="flex flex-col items-center gap-4 px-6 py-12 text-center" role="alert">
              <StatusIcon tone="bad">
                <X size={28} strokeWidth={2.4} />
              </StatusIcon>
              <h3 className="font-display text-2xl font-bold tracking-[-0.03em] text-prime-ink">{t('pay.declinedTitle')}</h3>
              {declineMessage ? <p className="text-[13px] font-medium text-red-600">{declineMessage}</p> : null}
              <p className="max-w-xs text-[14px] leading-relaxed text-prime-muted">{t('pay.declinedBody')}</p>
              <button type="button" className="prime-btn mt-2 min-h-[48px] rounded-full px-8" onClick={onRetry}>
                <RotateCcw size={15} aria-hidden />
                {t('pay.retry')}
              </button>
            </div>
          ) : null}

          {error ? (
            <p className="mt-3 text-center text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-prime-line/70 bg-prime-sand/60 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-start gap-2 text-[11.5px] leading-snug text-prime-muted">
            <ShieldCheck size={15} className="mt-px shrink-0 text-prime-gold-deep" aria-hidden />
            {t('pay.privacy')}
          </p>
          <ul className="flex shrink-0 items-center gap-1.5" aria-label={t('pay.cardsAccepted')}>
            {CARD_MARKS.map((mark) => (
              <li
                key={mark}
                className="rounded-md border border-prime-line bg-prime-surface px-2 py-1 text-[10px] font-bold tracking-wide text-prime-ink"
              >
                {mark}
              </li>
            ))}
          </ul>
        </footer>
      </div>
    </div>,
    document.body
  );
}
