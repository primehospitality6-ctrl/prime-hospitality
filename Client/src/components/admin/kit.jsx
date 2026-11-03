import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Search, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export const labelCls = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted';

/* ——— Toasts ——— */
const ToastContext = createContext({ success: () => {}, error: () => {} });

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((tone, message) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-3), { id, tone, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), tone === 'error' ? 6000 : 3500);
  }, []);
  const api = useRef({ success: (m) => push('success', m), error: (m) => push('error', m) });

  return (
    <ToastContext.Provider value={api.current}>
      {children}
      <div className="pointer-events-none fixed bottom-5 end-5 z-[400] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 border bg-prime-surface px-4 py-3 text-sm shadow-premium',
              t.tone === 'error' ? 'border-red-200 text-red-800' : 'border-emerald-200 text-emerald-900'
            )}
            style={{ animation: 'primeFadeIn 0.25s var(--prime-ease) both' }}
          >
            {t.tone === 'error' ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* ——— Overlays ——— */
function useOverlay(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
}

/** Side panel editor (Shopify-style) — keeps the list visible behind it */
export function Drawer({ open, onClose, title, subtitle, footer, children, wide = false }) {
  useOverlay(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[300] flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-prime-band/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn('relative flex h-full w-full flex-col bg-prime-sand shadow-2xl', wide ? 'max-w-3xl' : 'max-w-xl')}
        style={{ animation: 'primeDrawerIn 0.3s var(--prime-ease) both' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-prime-line bg-prime-surface px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate font-display text-xl font-bold text-prime-ink">{title}</h2>
            {subtitle ? <p className="mt-0.5 truncate text-xs text-prime-muted">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center border border-prime-line" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
        {footer ? <div className="border-t border-prime-line bg-prime-surface px-5 py-3 sm:px-6">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({ open, title, message, confirmText = 'Confirm', danger = false, busy = false, onConfirm, onClose }) {
  useOverlay(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[320] grid place-items-center p-4" role="alertdialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-prime-band/60" onClick={onClose} />
      <div className="relative w-full max-w-md border border-prime-line bg-prime-surface p-6 shadow-2xl">
        <h2 className="font-display text-xl font-bold text-prime-ink">{title}</h2>
        {message ? <p className="mt-2 text-sm leading-relaxed text-prime-muted">{message}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="border border-prime-line px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={cn(
              'px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] disabled:opacity-50',
              danger ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-prime-ink text-prime-sand hover:bg-prime-gold'
            )}
          >
            {busy ? 'Working…' : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ——— Small building blocks ——— */
const BADGE_TONES = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  gray: 'border-prime-line bg-prime-mist text-prime-muted',
  gold: 'border-prime-gold/40 bg-prime-gold/10 text-prime-gold-deep',
  red: 'border-red-200 bg-red-50 text-red-700',
  blue: 'border-sky-200 bg-sky-50 text-sky-800',
};

export function Badge({ tone = 'gray', children, className }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap border px-2 py-0.5 text-[11px] font-semibold', BADGE_TONES[tone], className)}>
      {children}
    </span>
  );
}

/** Filter chips with counts — All / Published / Hidden … */
export function StatusChips({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'inline-flex items-center gap-1.5 border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition',
            value === o.id ? 'border-prime-ink bg-prime-ink text-prime-sand' : 'border-prime-line bg-prime-surface hover:border-prime-ink'
          )}
        >
          {o.label}
          {o.count != null ? <span className="tabular-nums opacity-70">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <label className={cn('relative block', className)}>
      <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-prime-muted" />
      <input type="search" className="prime-input ps-9" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="grid place-items-center border border-dashed border-prime-line bg-prime-surface px-6 py-14 text-center">
      {Icon ? <Icon size={28} strokeWidth={1.4} className="text-prime-muted" /> : null}
      <p className="mt-3 font-display text-lg font-bold text-prime-ink">{title}</p>
      {subtitle ? <p className="mt-1 max-w-sm text-sm text-prime-muted">{subtitle}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Card({ title, description, actions, children, className }) {
  return (
    <section className={cn('border border-prime-line bg-prime-surface', className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-prime-line px-5 py-4">
          <div>
            {title ? <h2 className="font-display text-lg font-bold text-prime-ink">{title}</h2> : null}
            {description ? <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-prime-muted">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={cn('block', className)}>
      {label ? <span className={labelCls}>{label}</span> : null}
      {children}
      {hint ? <span className="mt-1 block text-[11px] leading-relaxed text-prime-muted">{hint}</span> : null}
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-50')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition', checked ? 'bg-prime-ink' : 'bg-prime-line')}
      >
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'start-[1.125rem]' : 'start-0.5')} />
      </button>
      <span>
        <span className="block text-sm text-prime-ink">{label}</span>
        {hint ? <span className="block text-[11px] text-prime-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

/** English + Arabic side by side */
export function BilingualField({ label, hint, value = {}, onChange, multiline = false, rows = 3, placeholder = {} }) {
  const Input = multiline ? 'textarea' : 'input';
  return (
    <div>
      {label ? <span className={labelCls}>{label}</span> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          ['en', 'EN', 'ltr'],
          ['ar', 'AR', 'rtl'],
        ].map(([locale, tag, dir]) => (
          <div key={locale} className="relative">
            <span className="pointer-events-none absolute end-2 top-2 text-[11px] font-bold tracking-wider text-prime-muted">{tag}</span>
            <Input
              dir={dir}
              rows={multiline ? rows : undefined}
              className={cn('prime-input pe-8', multiline && 'min-h-[80px]')}
              value={value[locale] || ''}
              placeholder={placeholder[locale] || ''}
              onChange={(e) => onChange({ ...value, [locale]: e.target.value })}
            />
          </div>
        ))}
      </div>
      {hint ? <span className="mt-1 block text-[11px] leading-relaxed text-prime-muted">{hint}</span> : null}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-6 flex gap-6 overflow-x-auto border-b border-prime-line">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            '-mb-px whitespace-nowrap border-b-2 pb-3 text-[11px] font-semibold uppercase tracking-[0.16em] transition',
            value === id ? 'border-prime-ink text-prime-ink' : 'border-transparent text-prime-muted hover:text-prime-ink'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Warn before leaving the page with unsaved edits */
export function useUnsavedGuard(dirty) {
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}

/** Contextual save bar — appears when a page has unsaved edits */
export function SaveBar({ dirty, saving, onSave, onDiscard, message = 'Unsaved changes' }) {
  useUnsavedGuard(dirty);
  if (!dirty) return null;
  return (
    <div className="sticky bottom-0 z-40 -mx-4 mt-8 border-t border-prime-line bg-prime-surface px-4 py-3 text-prime-ink shadow-[0_-12px_32px_-20px_rgba(0,0,0,0.35)] sm:-mx-8 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm">{message}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="border border-prime-line px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] hover:border-prime-ink"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="bg-prime-gold px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white hover:bg-prime-gold-deep disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Load a whole site section, edit a draft, save it back — shared by the Website/Marketing/Settings pages */
export function useSiteSection(api, sectionKeys, onSaved) {
  const keys = Array.isArray(sectionKeys) ? sectionKeys : [sectionKeys];
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const keyStr = keys.join(',');

  useEffect(() => {
    api
      .adminGetSite()
      .then((res) => {
        const picked = Object.fromEntries(keyStr.split(',').map((k) => [k, res.site[k]]));
        setSaved(picked);
        setDraft(structuredClone(picked));
      })
      .catch((err) => setError(err.message));
  }, [api, keyStr]);

  const dirty = saved != null && JSON.stringify(saved) !== JSON.stringify(draft);

  async function save() {
    setSaving(true);
    setError('');
    try {
      const res = await api.adminSaveSite(draft);
      const picked = Object.fromEntries(keyStr.split(',').map((k) => [k, res.site[k]]));
      setSaved(picked);
      setDraft(structuredClone(picked));
      onSaved?.(res.site);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setDraft(structuredClone(saved));
  }

  return { draft, setDraft, dirty, saving, error, save, discard, loaded: draft != null };
}
