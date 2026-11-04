/**
 * Runs inside the Website Builder's preview iframe (?__preview&__builder).
 * Turns the real site into an editor: hover outlines, click-to-edit text typed in place,
 * click a photo to change it, and section toolbars. Every change is sent to the admin
 * window (window.parent), which owns the draft and sends it back as the new preview.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { defaultCopy, useLocale } from '../../context/LocaleContext';
import { isPreviewFrame, useSite } from '../../context/SiteContext';
import { pageBlocks } from './layout';

export function isBuilderFrame() {
  return isPreviewFrame() && new URLSearchParams(window.location.search).has('__builder');
}

const BuilderContext = createContext({ editing: false, selectedId: '', names: {}, post: () => {} });
export const useBuilder = () => useContext(BuilderContext);

function post(message) {
  window.parent.postMessage(message, window.location.origin);
}

const GOLD = '#b8955a';

function getPath(obj, path) {
  return String(path)
    .split('.')
    .reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

/** Text-key groups that belong to each page, used when the same words appear under several keys */
const PAGE_KEY_GROUPS = {
  '': ['home'],
  compounds: ['properties'],
  terms: ['legal'],
  privacy: ['legal'],
  'refund-policy': ['legal'],
  search: ['search', 'filters'],
  listings: ['listing', 'booking', 'bm'],
};
const SHARED_GROUPS = ['nav', 'footer', 'common'];

/**
 * Text shown on the page → the copy key it came from, for the current language.
 * When two keys show the same words, the key belonging to the current page wins, then the header/footer.
 */
function useCopyIndex(locale, overrides, pathname) {
  return useMemo(() => {
    const segment = pathname.split('/')[1] || '';
    const pageGroups = PAGE_KEY_GROUPS[segment] || [segment];
    const rank = (key) => {
      const group = key.split('.')[0];
      if (pageGroups.includes(group)) return 0;
      if (SHARED_GROUPS.includes(group)) return 1;
      return 2;
    };
    const map = new Map();
    for (const key of Object.keys(defaultCopy.en)) {
      const value = overrides?.[locale]?.[key] || defaultCopy[locale]?.[key] || overrides?.en?.[key] || defaultCopy.en[key];
      if (!value || value.includes('{')) continue;
      const text = value.trim();
      if (!text) continue;
      const current = map.get(text);
      if (!current || rank(key) < rank(current)) map.set(text, key);
    }
    return map;
  }, [locale, overrides, pathname]);
}

const isUi = (el) => Boolean(el?.closest?.('[data-builder-ui],[data-builder-editor]'));

/** What a click or hover on `target` would edit */
function findEditable(target, copyIndex) {
  if (!target || !(target instanceof Element) || isUi(target)) return null;
  const fieldEl = target.closest('[data-edit-field]');
  if (fieldEl) {
    const blockEl = fieldEl.closest('[data-builder-block]');
    if (blockEl) {
      return {
        kind: 'field',
        el: fieldEl,
        blockId: blockEl.dataset.builderBlock,
        page: blockEl.dataset.builderPage,
        field: fieldEl.dataset.editField,
        multiline: fieldEl.dataset.editMultiline === '1',
      };
    }
  }
  let el = target;
  for (let depth = 0; el && depth < 4; depth += 1, el = el.parentElement) {
    if (el.matches('[data-builder-block],main,body,header,footer,section')) break;
    const text = (el.textContent || '').trim();
    if (!text || text.length > 2000) break;
    const key = copyIndex.get(text);
    if (key) return { kind: 'copy', el, key, multiline: text.length > 80 };
  }
  const imageEl = target.closest('[data-edit-image]');
  if (imageEl) {
    const blockEl = imageEl.closest('[data-builder-block]');
    return { kind: 'image', el: imageEl, target: imageEl.dataset.editImage, blockId: blockEl?.dataset.builderBlock || '' };
  }
  return null;
}

function backgroundBehind(el) {
  for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
    const bg = getComputedStyle(node).backgroundColor;
    if (bg && bg !== 'transparent' && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(bg)) return bg;
  }
  return getComputedStyle(document.body).backgroundColor || '#fff';
}

/** The text being typed over: an editable box laid exactly on top of the original words */
function InlineEditor({ edit, onDone }) {
  const ref = useRef(null);
  const [rect, setRect] = useState(() => edit.el.getBoundingClientRect());
  const style = useMemo(() => {
    const cs = getComputedStyle(edit.el);
    return {
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle,
      letterSpacing: cs.letterSpacing,
      lineHeight: cs.lineHeight,
      textTransform: cs.textTransform,
      textAlign: cs.textAlign,
      color: cs.color,
      direction: cs.direction,
      background: backgroundBehind(edit.el),
    };
  }, [edit.el]);

  useEffect(() => {
    const el = edit.el;
    const prev = el.style.visibility;
    el.style.visibility = 'hidden';
    const node = ref.current;
    node.textContent = edit.value;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const place = () => setRect(el.getBoundingClientRect());
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      el.style.visibility = prev;
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [edit]);

  const finish = useCallback(
    (save) => {
      const value = (ref.current?.innerText || '').replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      onDone(save && value !== edit.value.trim() ? value : null);
    },
    [edit.value, onDone]
  );

  return createPortal(
    <>
      <div
        ref={ref}
        data-builder-editor
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        spellCheck
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            finish(false);
          } else if (e.key === 'Enter' && (!edit.multiline || e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            finish(true);
          }
        }}
        style={{
          ...style,
          position: 'fixed',
          zIndex: 2147483000,
          left: rect.left - 6,
          top: rect.top - 4,
          width: Math.max(rect.width, 140) + 12,
          minHeight: rect.height + 8,
          padding: '4px 6px',
          outline: `2px solid ${GOLD}`,
          borderRadius: 6,
          whiteSpace: 'pre-wrap',
          boxShadow: '0 12px 32px -12px rgba(0,0,0,0.35)',
          cursor: 'text',
        }}
      />
      <div
        data-builder-ui
        style={{ position: 'fixed', zIndex: 2147483001, left: rect.left - 6, top: Math.max(4, rect.top - 30) }}
        className="rounded-md bg-[#1f1d1c] px-2 py-1 font-sans text-[11px] font-medium tracking-normal text-white shadow"
      >
        {edit.multiline ? 'Ctrl + Enter or click away to save · Esc to cancel' : 'Enter or click away to save · Esc to cancel'}
      </div>
    </>,
    document.body
  );
}

/** Dashed outline that follows whatever text or photo the pointer is over */
function HoverBox({ hover }) {
  if (!hover) return null;
  const r = hover.el.getBoundingClientRect();
  const isImage = hover.kind === 'image';
  return createPortal(
    <div
      data-builder-ui
      style={{
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: 2147482000,
        left: r.left - 3,
        top: r.top - 2,
        width: r.width + 6,
        height: r.height + 4,
        outline: `1.5px dashed ${GOLD}`,
        borderRadius: 4,
      }}
    >
      <span
        className="absolute rounded bg-[#1f1d1c] px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-white"
        style={isImage ? { left: 8, top: 8 } : { left: -1, top: -20 }}
      >
        {isImage ? 'Click to change photo' : 'Click to edit'}
      </span>
    </div>,
    document.body
  );
}

export function BuilderProvider({ children }) {
  const active = isBuilderFrame();
  const [state, setState] = useState({ mode: 'edit', selectedId: '', names: {} });
  const [hover, setHover] = useState(null);
  const [edit, setEdit] = useState(null);
  const { locale } = useLocale();
  const { site } = useSite();
  const { pathname } = useLocation();
  const copyIndex = useCopyIndex(locale, site.copy, pathname);
  const editing = active && state.mode === 'edit';
  const live = useRef({});
  live.current = { copyIndex, site, locale, edit };

  useEffect(() => {
    if (!active) return undefined;
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const data = event.data || {};
      if (data.type === 'builder:state') setState((s) => ({ ...s, ...data.state }));
    };
    window.addEventListener('message', onMessage);
    post({ type: 'builder:hello' });
    return () => window.removeEventListener('message', onMessage);
  }, [active]);

  useEffect(() => {
    if (active) post({ type: 'builder:navigate', path: pathname });
  }, [active, pathname]);

  useEffect(() => {
    if (!editing) {
      setHover(null);
      setEdit(null);
      return undefined;
    }
    let frame = 0;
    const onMove = (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (live.current.edit) return setHover(null);
        const found = findEditable(e.target, live.current.copyIndex);
        setHover((prev) => (prev?.el === found?.el ? prev : found));
      });
    };
    const block = (e) => {
      if (isUi(e.target)) return;
      e.preventDefault();
    };
    const onClick = (e) => {
      if (isUi(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      if (live.current.edit) return;
      const found = findEditable(e.target, live.current.copyIndex);
      const blockEl = e.target.closest?.('[data-builder-block]');
      if (blockEl) post({ type: 'builder:select', blockId: blockEl.dataset.builderBlock });
      if (!found) {
        if (!blockEl) post({ type: 'builder:select', blockId: '' });
        return;
      }
      if (found.kind === 'image') {
        post({ type: 'builder:image', target: found.target, blockId: found.blockId });
        return;
      }
      const { site: s, locale: l } = live.current;
      let value = '';
      if (found.kind === 'copy') value = (found.el.textContent || '').trim();
      else {
        const blk = pageBlocks(s, found.page).find((b) => b.id === found.blockId);
        value = getPath(blk, found.field)?.[l] || '';
      }
      setHover(null);
      setEdit({ ...found, value });
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mousedown', block, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', block, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mousedown', block, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', block, true);
    };
  }, [editing]);

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (live.current.edit) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        post({ type: 'builder:history', action: e.shiftKey ? 'redo' : 'undo' });
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        post({ type: 'builder:history', action: 'redo' });
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        post({ type: 'builder:history', action: 'save' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const onDone = useCallback((value) => {
    const current = live.current.edit;
    setEdit(null);
    if (value == null || !current) return;
    if (current.kind === 'copy') post({ type: 'builder:copy', key: current.key, value });
    else post({ type: 'builder:field', blockId: current.blockId, page: current.page, field: current.field, value });
  }, []);

  const value = useMemo(
    () => ({ editing, selectedId: state.selectedId, names: state.names || {}, post }),
    [editing, state.selectedId, state.names]
  );

  return (
    <BuilderContext.Provider value={value}>
      {children}
      {editing ? (
        <>
          <style>{`[data-builder-block] a, [data-builder-block] button:not([data-builder-ui] *) { cursor: default; }`}</style>
          <HoverBox hover={hover} />
          {edit ? <InlineEditor edit={edit} onDone={onDone} /> : null}
        </>
      ) : null}
    </BuilderContext.Provider>
  );
}
