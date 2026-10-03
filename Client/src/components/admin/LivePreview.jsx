import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Monitor, RotateCw, Smartphone } from 'lucide-react';
import { cn } from '../../utils/cn';

const DEVICE_WIDTH = { desktop: 1280, mobile: 390 };

function Toggle({ value, onChange, options }) {
  return (
    <div className="inline-flex border border-prime-line bg-prime-surface p-0.5">
      {options.map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          title={typeof label === 'string' ? label : undefined}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition',
            value === id ? 'bg-prime-night text-prime-sand' : 'text-prime-muted hover:text-prime-ink'
          )}
        >
          {Icon ? <Icon size={13} /> : label}
        </button>
      ))}
    </div>
  );
}

/**
 * The real website in a scaled iframe. `site` (a partial site document, e.g. the unsaved draft)
 * is pushed into the frame on every change, so edits show before saving.
 * `focus` = { id, at } scrolls the frame to the element with that id and highlights it.
 */
export default function LivePreview({ path = '/', site, focus, reloadKey = 0, className, height = 'calc(100vh - 8.5rem)' }) {
  const frameRef = useRef(null);
  const boxRef = useRef(null);
  const siteRef = useRef(site);
  const focusRef = useRef(focus);
  const [device, setDevice] = useState('desktop');
  const [locale, setLocale] = useState('en');
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [nonce, setNonce] = useState(0);
  siteRef.current = site;
  focusRef.current = focus;

  const post = useCallback((message) => {
    frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
  }, []);

  const sendDraft = useCallback(() => {
    if (siteRef.current) post({ type: 'prime:preview', site: siteRef.current });
  }, [post]);

  useEffect(() => {
    function onMessage(event) {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type !== 'prime:preview-ready') return;
      sendDraft();
      if (focusRef.current?.id) setTimeout(() => post({ type: 'prime:scroll', target: focusRef.current.id }), 600);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [sendDraft, post]);

  useEffect(() => {
    const timer = setTimeout(sendDraft, 120);
    return () => clearTimeout(timer);
  }, [site, sendDraft]);

  const focusId = focus?.id;
  const focusAt = focus?.at;
  useEffect(() => {
    if (focusId) post({ type: 'prime:scroll', target: focusId });
  }, [focusId, focusAt, post]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const mobile = device === 'mobile';
  const frameWidth = DEVICE_WIDTH[device];
  const available = Math.max(0, box.width - (mobile ? 24 : 0));
  const scale = available ? Math.min(1, available / frameWidth) : 1;
  const frameHeight = box.height ? (box.height - (mobile ? 24 : 0)) / scale : 800;
  const sep = path.includes('?') ? '&' : '?';
  const src = `${path}${sep}__preview=1${locale === 'ar' ? '&lang=ar' : ''}`;

  return (
    <div className={cn('flex flex-col border border-prime-line bg-prime-mist', className)} style={{ height }}>
      <div className="flex flex-wrap items-center gap-2 border-b border-prime-line bg-prime-surface px-3 py-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-prime-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live preview
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-prime-muted" title="Unsaved changes appear here first">
          {path}
        </span>
        <Toggle
          value={device}
          onChange={setDevice}
          options={[
            ['desktop', 'Desktop', Monitor],
            ['mobile', 'Mobile', Smartphone],
          ]}
        />
        <Toggle
          value={locale}
          onChange={setLocale}
          options={[
            ['en', 'EN'],
            ['ar', 'AR'],
          ]}
        />
        <button type="button" onClick={() => setNonce((n) => n + 1)} className="grid h-7 w-7 place-items-center text-prime-muted hover:text-prime-ink" title="Reload preview">
          <RotateCw size={14} />
        </button>
        <a href={path} target="_blank" rel="noreferrer" className="grid h-7 w-7 place-items-center text-prime-muted hover:text-prime-ink" title="Open the live page (saved version)">
          <ExternalLink size={14} />
        </a>
      </div>
      <div ref={boxRef} className={cn('relative min-h-0 flex-1 overflow-hidden', mobile && 'flex justify-center p-3')}>
        <div
          className={cn('overflow-hidden bg-white', mobile && 'rounded-[22px] border-[5px] border-prime-night shadow-xl')}
          style={{ width: frameWidth * scale + (mobile ? 10 : 0), height: mobile ? box.height - 24 : '100%' }}
        >
          <iframe
            key={`${src}#${reloadKey}#${nonce}`}
            ref={frameRef}
            src={src}
            title="Website preview"
            className="block origin-top-left border-0"
            style={{ width: frameWidth, height: frameHeight, transform: `scale(${scale})` }}
          />
        </div>
      </div>
    </div>
  );
}
