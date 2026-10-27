import { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { kwentraApi } from '../../services/api';
import { useCurrency } from '../../context/CurrencyContext';
import { useLocale } from '../../context/LocaleContext';

/**
 * Embedded payment — Paymob iframe / Stripe Elements / mock.
 * STRICT: never window.location.assign to an external checkout.
 */
export default function PaymentPanel({ payment, booking, amount, currency: _currency = 'USD', onPaid }) {
  const { t } = useLocale();
  const { format } = useCurrency();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(false);
  const isMock = payment?.mode === 'embedded_mock' || payment?.provider === 'mock';
  const stayAmount = payment?.displayAmount ?? amount;
  const stayLabel = format(stayAmount);

  useEffect(() => {
    if (!payment?.merchantOrderId || isMock) return undefined;
    setPolling(true);
    const id = setInterval(async () => {
      try {
        const status = await kwentraApi.paymentStatus(payment.merchantOrderId);
        if (status.paymentStatus === 'paid') {
          clearInterval(id);
          setPolling(false);
          onPaid?.({ bookingId: status.bookingId || booking?.id, merchantOrderId: payment.merchantOrderId });
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => {
      clearInterval(id);
      setPolling(false);
    };
  }, [payment, booking, onPaid, isMock]);

  if (!payment) {
    return <p className="text-sm text-prime-muted">{t('bm.payUnavailable')}</p>;
  }

  async function payMock() {
    setBusy(true);
    setError('');
    try {
      const res = await kwentraApi.confirmMockPayment({
        merchantOrderId: payment.merchantOrderId,
        bookingId: booking?.id,
      });
      onPaid?.({ bookingId: res.booking?.id || booking?.id, merchantOrderId: payment.merchantOrderId });
    } catch (err) {
      setError(err.message || t('bm.payFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-prime-line">
      <div className="flex items-center justify-between gap-3 border-b border-prime-line bg-prime-mist/60 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-prime-muted">
          <Lock size={13} strokeWidth={2} aria-hidden />
          {t('bm.securePayment')}
        </span>
        <span className="text-end font-display text-lg font-bold tabular-nums text-prime-ink">
          {t('bm.stayTotal', { amount: stayLabel })}
        </span>
      </div>

      <div className="p-4">
        {payment.mode === 'embedded_iframe' && payment.iframeSrc ? (
          <iframe title={t('bm.cardPayment')} src={payment.iframeSrc} className="h-[520px] w-full border-0" allow="payment *" />
        ) : null}

        {payment.mode === 'embedded_elements' ? (
          <div className="space-y-3 py-6 text-sm text-prime-muted">
            <p>Stripe PaymentIntent ready (client secret issued).</p>
            <p className="text-xs">
              Mount Stripe Elements with <code>clientSecret</code> here when Stripe.js is added.
            </p>
          </div>
        ) : null}

        {isMock ? (
          <div className="space-y-4 py-6 text-center">
            <p className="text-sm text-prime-muted">{t('bm.mockGateway')}</p>
            <button type="button" className="prime-btn" disabled={busy} onClick={payMock}>
              {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
              {busy ? t('bm.confirming') : t('bm.payNow', { amount: stayLabel })}
            </button>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {polling ? <p className="mt-3 text-center text-xs text-prime-muted">{t('bm.waitingPayment')}</p> : null}
      </div>
    </div>
  );
}
