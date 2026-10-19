import { createContext, useContext, useMemo } from 'react';

const CurrencyContext = createContext(null);

/** Website currency is fixed to USD — no guest switcher. */
export function CurrencyProvider({ children }) {
  const value = useMemo(() => ({ currency: 'USD', setCurrency: () => {} }), []);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
