import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);
/** A guest's manual pick from the header toggle; it only lasts for the current tab */
const OVERRIDE_KEY = 'prime_theme_override';
const QUERY = '(prefers-color-scheme: dark)';

function systemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia(QUERY).matches ? 'dark' : 'light';
}

function readOverride() {
  try {
    const v = sessionStorage.getItem(OVERRIDE_KEY);
    return v === 'dark' || v === 'light' ? v : '';
  } catch {
    return '';
  }
}

function writeOverride(value) {
  try {
    if (value) sessionStorage.setItem(OVERRIDE_KEY, value);
    else sessionStorage.removeItem(OVERRIDE_KEY);
  } catch {
    /* private mode */
  }
}

/**
 * The site follows the device's light/dark setting, live. The header toggle can flip it for the
 * current visit; the device changing its own setting always wins again.
 */
export function ThemeProvider({ children }) {
  const [system, setSystem] = useState(systemTheme);
  const [override, setOverride] = useState(readOverride);
  const theme = override || system;

  useEffect(() => {
    try {
      localStorage.removeItem('prime_theme'); // picks saved by older versions no longer stick
    } catch {
      /* ignore */
    }
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(QUERY);
    const onChange = (e) => {
      setSystem(e.matches ? 'dark' : 'light');
      setOverride('');
      writeOverride('');
    };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback(
    (next) => {
      const value = next === system ? '' : next;
      setOverride(value);
      writeOverride(value);
    },
    [system]
  );

  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [setTheme, theme]);

  const value = useMemo(
    () => ({ theme, isDark: theme === 'dark', setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
