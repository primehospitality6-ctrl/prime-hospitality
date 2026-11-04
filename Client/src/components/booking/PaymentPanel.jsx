import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { kwentraApi } from '../../services/api';
import { apiBase } from '../../api/client';
import { useCurrency } from '../../context/CurrencyContext';
import { useLocale } from '../../context/LocaleContext';
import PaymentPopup from './PaymentPopup';

const API_ORIGIN = (() => {
  const base = apiBase(import.meta.env.VITE_API_URL);
  try {
    return base ? new URL(base).origin : window.location.origin;
  } catch {
    return '';
  }
})();

/**
 * Embedded payment — the Paymob card form opens in a popup on the page (or the mock gateway).
 * STRICT: never window.location.assign to an external checkout.
 * The booking counts as paid only when the server says so (Paymob's callback reached it).
 */
export default function PaymentPanel({ payment, booking, amount, currency: _currency = 'USD', onPaid }) {
  const { t, locale } = useLocale();
  const { format } = useCurrency();
  const [open, setOpen] = useState(Boolean(payment));
  const [phase, setPhase] = useState('form');
  const [declineMessage, setDeclineMessage] = useState('');
  const [frameKey, setFrameKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const doneRef = useRef(false);
  const isMock = payment?.mode === 'embedded_mock' || payment?.provider === 'mock';
  const merchantOrderId = payment?.merchantOrderId;
  const stayLabel = format(payment?.displayAmount ?? amount);
  let chargeLabel = '';
  if (payment?.converted && payment?.chargeAmount && payment?.chargeCurrency) {
    try {
      chargeLabel = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
        style: 'currency',
        currency: payment.chargeCurrency,
      }).format(payment.chargeAmount);
    } catch {
      chargeLabel = `${payment.chargeAmount} ${payment.chargeCurrency}`;
    }
  }

  const finish = useCallback(
    (bookingId) => {
      if (doneRef.current) return;
      doneRef.current = true;
      setPhase('paid');
      setOpen(true);
      setTimeout(() => {
        setOpen(false);
        onPaid?.({ bookingId: bookingId || booking?.id, merchantOrderId });
      }, 1800);
    },
    [booking, merchantOrderId, onPaid]
  );

  const checkNow = useCallback(async () => {
    if (!merchantOrderId || doneRef.current) return;
    try {
      const status = await kwentraApi.paymentStatus(merchantOrderId);
      if (status.paymentStatus === 'paid') finish(status.bookingId);
    } catch {
      /* keep polling */
    }
  }, [merchantOrderId, finish]);

  // The server is the source of truth: poll it while a card payment is open.
  useEffect(() => {
    if (!merchantOrderId || isMock) return undefined;
    const id = setInterval(checkNow, 3000);
    return () => clearInterval(id);
  }, [merchantOrderId, isMock, checkNow]);

  // Paymob's result page inside the popup reports straight away; then confirm with the server.
  useEffect(() => {
    if (isMock) return undefined;
    const onMessage = (e) => {
      const data = e.data;
      if (!data || data.source !== 'prime-paymob' || data.merchantOrderId !== merchantOrderId) return;
      if (API_ORIGIN && e.origin !== API_ORIGIN) return;
      if (data.status === 'declined') {
        setDeclineMessage(data.message || '');
        setPhase('declined');
        return;
      }
      setPhase('checking');
      checkNow();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [merchantOrderId, isMock, checkNow]);

  if (!payment) {
    return <p className="text-sm text-prime-muted">{t('bm.payUnavailable')}</p>;
  }

  async function payMock() {
    setBusy(true);
    setError('');
    try {
      const res = await kwentraApi.confirmMockPayment({ merchantOrderId, bookingId: booking?.id });
      finish(res.booking?.id);
    } catch (err) {
      setError(err.message || t('bm.payFailed'));
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    setDeclineMessage('');
    setPhase('form');
    setFrameKey((k) => k + 1);
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-prime-line">
        <div className="flex items-center justify-between gap-3 bg-prime-mist/60 px-5 py-4">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-prime-muted">
            <Lock size={13} strokeWidth={2} aria-hidden />
            {t('bm.securePayment')}
          </span>
          <span className="text-end font-display text-lg font-bold tabular-nums text-prime-ink">
            {t('bm.stayTotal', { amount: stayLabel })}
          </span>
        </div>
        <div className="flex flex-col items-center gap-3 px-5 py-7 text-center">
          {phase === 'checking' ? (
            <p className="inline-flex items-center gap-2 text-[13px] text-prime-muted" role="status">
              <Loader2 size={14} className="animate-spin" aria-hidden />
              {t('bm.waitingPayment')}
            </p>
          ) : null}
          <button
            type="button"
            className="prime-btn min-h-[52px] w-full max-w-sm rounded-full px-8"
            onClick={() => setOpen(true)}
            disabled={phase === 'paid'}
          >
            <Lock size={14} aria-hidden />
            {t('pay.open', { amount: stayLabel })}
          </button>
          {chargeLabel ? <p className="max-w-sm text-[12px] text-prime-muted">{t('bm.fxNote')}</p> : null}
        </div>
      </div>

      <PaymentPopup
        open={open}
        onClose={() => setOpen(false)}
        payment={payment}
        amountLabel={stayLabel}
        chargeLabel={chargeLabel}
        phase={phase}
        declineMessage={declineMessage}
        frameKey={frameKey}
        onRetry={retry}
        isMock={isMock}
        onMockPay={payMock}
        mockBusy={busy}
        error={error}
      />
    </>
  );
}
