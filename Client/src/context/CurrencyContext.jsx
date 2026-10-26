import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { formatMoney } from '../theme/brand';

const CurrencyContext = createContext(null);
const STORAGE_KEY = 'prime_display_currency';

function preferredCurrency() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved.toUpperCase();
  } catch {
    /* private mode */
  }
  return 'USD';
}

/**
 * Display prices in the guest's currency using Kwentra's factors (EGP = 1).
 * The amount Paymob charges is calculated again on the server when the booking is created.
 */
export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(preferredCurrency);
  const [factors, setFactors] = useState({});

  const applyRows = useCallback((data) => {
    const next = {};
    for (const row of data?.currencies || []) {
      if (row?.code && Number(row.factor) > 0) next[String(row.code).toUpperCase()] = Number(row.factor);
    }
    if (Object.keys(next).length) setFactors(next);
  }, []);

  const refresh = useCallback((fresh = false) => {
    return api.getExchange({ fresh }).then(applyRows).catch(() => {});
  }, [applyRows]);

  useEffect(() => {
    refresh(false);
  }, [refresh]);

  const setCurrency = useCallback((code) => {
    const next = String(code || 'USD').toUpperCase();
    setCurrencyState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode */
    }
  }, []);

  const currencies = useMemo(() => Object.keys(factors).sort(), [factors]);

  useEffect(() => {
    if (currencies.length && !currencies.includes(currency)) setCurrency('USD');
  }, [currencies, currency, setCurrency]);

  const convert = useCallback((usdAmount) => {
    const n = Number(usdAmount);
    if (!Number.isFinite(n)) return 0;
    const usd = factors.USD;
    const quote = factors[currency];
    if (currency === 'USD' || !(usd > 0) || !(quote > 0)) return n;
    return Math.round((n * usd / quote) * 100) / 100;
  }, [currency, factors]);

  const format = useCallback((usdAmount) => {
    const shown = currency === 'USD' || !(factors.USD > 0) || !(factors[currency] > 0) ? 'USD' : currency;
    return formatMoney(convert(usdAmount), shown);
  }, [convert, currency, factors]);

  const value = useMemo(
    () => ({ currency, setCurrency, currencies, factors, convert, format, refresh }),
    [currency, setCurrency, currencies, factors, convert, format, refresh]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
