import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FolderCog,
  Image as ImageIcon,
  Loader2,
  Monitor,
  MousePointer2,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  RotateCw,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import api from '../../api/client';
import { ImageUploadField, reorderList } from '../../components/admin/AdminUi';
import { ConfirmDialog, EmbeddedAdminContext, ToastProvider, useSiteSection, useToast, useUnsavedGuard } from '../../components/admin/kit';
import CopyFields, { setCopyValue } from '../../components/admin/CopyFields';
import { AddMenu, BLOCK_TYPES, BlockFields, LayoutFields, PAGES, blockSummary } from '../../components/pageBuilder/editorParts';
import { blockDomId, localText, newBlock, newBlockId, pageBlocks } from '../../components/pageBuilder/layout';
import { defaultCopy } from '../../context/LocaleContext';
import { useSite } from '../../context/SiteContext';
import { cn } from '../../utils/cn';

const AdminSlideshowPage = lazy(() => import('./AdminSlideshowPage'));
const AdminBrandsPage = lazy(() => import('./AdminBrandsPage'));
const AdminContentListsPage = lazy(() => import('./AdminContentListsPage'));
const AdminPagesPage = lazy(() => import('./AdminPagesPage'));

/** Pages without a block layout: their words are still edited by clicking them in the preview. */
const TEXT_PAGES = {
  search: { label: 'Stays (search)', path: '/search' },
  wishlist: { label: 'Wishlist', path: '/wishlist' },
  terms: { label: 'Terms', path: '/terms' },
  privacy: { label: 'Privacy', path: '/privacy' },
  refund: { label: 'Refund policy', path: '/refund-policy' },
};
const ALL_PAGES = { ...Object.fromEntries(Object.entries(PAGES).map(([id, p]) => [id, { label: p.label, path: p.path }])), ...TEXT_PAGES };
const pageForPath = (path) => Object.entries(ALL_PAGES).find(([, p]) => p.path === path)?.[0] || '';

const PANELS = [
  ['slideshow', 'Hero slideshow', AdminSlideshowPage],
  ['brands', 'Brands', AdminBrandsPage],
  ['lists', 'FAQs & lists', AdminContentListsPage],
  ['texts', 'All texts & legal pages', AdminPagesPage],
];
/** Old admin links → the matching drawer panel */
const PANEL_LINKS = { '/admin/slideshow': 'slideshow', '/admin/brands': 'brands', '/admin/content': 'lists', '/admin/pages': 'texts' };

const DEVICES = { desktop: 1280, tablet: 834, mobile: 390 };
const SECTIONS = ['layouts', 'home', 'pages', 'copy'];

function setPath(obj, path, value) {
  const [head, ...rest] = String(path).split('.');
  const copy = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  copy[head] = rest.length ? setPath(copy[head], rest.join('.'), value) : value;
  return copy;
}
const getPath = (obj, path) => String(path).split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);

function Segment({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-lg border border-prime-line bg-prime-surface p-0.5">
      {options.map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          title={label}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition',
            value === id ? 'bg-prime-ink text-prime-sand' : 'text-prime-muted hover:text-prime-ink'
          )}
        >
          {Icon ? <Icon size={14} /> : null}
          {Icon ? <span className="sr-only">{label}</span> : label}
        </button>
      ))}
    </div>
  );
}

function IconButton({ label, onClick, disabled, children, active }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'grid h-9 w-9 place-items-center rounded-lg border border-prime-line text-prime-ink transition hover:border-prime-ink disabled:cursor-not-allowed disabled:opacity-35',
        active && 'border-prime-ink bg-prime-ink text-prime-sand'
      )}
    >
      {children}
    </button>
  );
}

function PanelLink({ link, onOpenPanel }) {
  if (!link) return null;
  const panel = PANEL_LINKS[link[0]];
  if (panel) {
    return (
      <button type="button" onClick={() => onOpenPanel(panel)} className="prime-link inline-flex items-center gap-1 text-xs">
        {link[1]} →
      </button>
    );
  }
  return (
    <Link to={link[0]} className="prime-link inline-flex items-center gap-1 text-xs">
      {link[1]} →
    </Link>
  );
}

/* ——— The editor ——— */

function Builder() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { replace } = useSite();
  const { draft, setDraft, dirty, saving, error, save, discard, reload, loaded } = useSiteSection(api, SECTIONS, replace);
  useUnsavedGuard(dirty);

  const [page, setPage] = useState('home');
  const [framePath, setFramePath] = useState('/');
  const [device, setDevice] = useState('desktop');
  const [locale, setLocale] = useState('en');
  const [mode, setMode] = useState('edit');
  const [nonce, setNonce] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [inspector, setInspector] = useState(null);
  const [showInspector, setShowInspector] = useState(true);
  const [addAt, setAddAt] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [panel, setPanel] = useState(params.get('panel') || '');
  const [box, setBox] = useState({ width: 0, height: 0 });
  const frameRef = useRef(null);
  const canvasRef = useRef(null);

  /* ——— Undo / redo ——— */
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const history = useRef({ past: [], future: [], at: 0 });
  const [, setHistoryTick] = useState(0);
  const change = useCallback(
    (updater) => {
      const now = Date.now();
      const h = history.current;
      if (draftRef.current && now - h.at > 700) h.past.push(draftRef.current);
      if (h.past.length > 100) h.past.shift();
      h.at = now;
      h.future = [];
      setDraft((d) => updater(d));
      setHistoryTick((n) => n + 1);
    },
    [setDraft]
  );
  const undo = useCallback(() => {
    const h = history.current;
    if (!h.past.length) return;
    h.future.push(draftRef.current);
    setDraft(h.past.pop());
    h.at = 0;
    setHistoryTick((n) => n + 1);
  }, [setDraft]);
  const redo = useCallback(() => {
    const h = history.current;
    if (!h.future.length) return;
    h.past.push(draftRef.current);
    setDraft(h.future.pop());
    h.at = 0;
    setHistoryTick((n) => n + 1);
  }, [setDraft]);
  const resetHistory = () => {
    history.current = { past: [], future: [], at: 0 };
    setHistoryTick((n) => n + 1);
  };

  /* ——— Page data ——— */
  const def = PAGES[page];
  const blocks = useMemo(() => (draft && def ? pageBlocks(draft, page) : []), [draft, page, def]);

  const blocksOf = useCallback((p) => (draftRef.current ? pageBlocks(draftRef.current, p) : []), []);
  const setBlocksOf = useCallback(
    (p, next) =>
      change((d) => {
        const layouts = { ...(d.layouts || {}), [p]: { blocks: next } };
        const home = p === 'home' ? { ...d.home, sections: next.filter((b) => b.type === 'section').map((b) => ({ id: b.key, enabled: !b.hidden })) } : d.home;
        return { ...d, layouts, home };
      }),
    [change]
  );

  const names = useMemo(() => {
    if (!def) return {};
    return Object.fromEntries(
      blocks.map((b) => [b.id, b.type === 'section' ? def.sections[b.key]?.name || b.key : `${BLOCK_TYPES[b.type]?.name || 'Block'}${localText(b.title, 'en') ? ` · ${localText(b.title, 'en')}` : ''}`])
    );
  }, [blocks, def]);

  /* ——— Talking to the preview ——— */
  const post = useCallback((message) => frameRef.current?.contentWindow?.postMessage(message, window.location.origin), []);
  const sendDraft = useCallback(() => {
    const d = draftRef.current;
    if (d) post({ type: 'prime:preview', site: Object.fromEntries(SECTIONS.map((k) => [k, d[k]])) });
  }, [post]);
  const stateRef = useRef({});
  stateRef.current = { mode, selectedId, names };
  const sendState = useCallback(() => post({ type: 'builder:state', state: stateRef.current }), [post]);

  useEffect(() => {
    const t = setTimeout(sendDraft, 60);
    return () => clearTimeout(t);
  }, [draft, sendDraft]);
  useEffect(sendState, [mode, selectedId, names, sendState]);

  const scrollTo = useCallback((p, block) => setTimeout(() => post({ type: 'prime:scroll', target: blockDomId(p, block) }), 350), [post]);

  const openPanel = useCallback((id) => setPanel(id), []);

  const handlers = useRef({});
  handlers.current = {
    publish() {
      if (dirty && !saving) onPublish();
    },
    select(blockId) {
      setSelectedId(blockId || '');
      setInspector(blockId ? { kind: 'block', id: blockId } : null);
      if (blockId) setShowInspector(true);
    },
    action({ page: p, blockId, action }) {
      const list = blocksOf(p);
      const index = list.findIndex((b) => b.id === blockId);
      if (index < 0) return;
      const block = list[index];
      if (action === 'up' || action === 'down') {
        const to = action === 'up' ? index - 1 : index + 1;
        setBlocksOf(p, reorderList(list, index, to));
        scrollTo(p, block);
      } else if (action === 'hide' || action === 'show') {
        setBlocksOf(p, list.map((b) => (b.id === blockId ? { ...b, hidden: action === 'hide' } : b)));
      } else if (action === 'duplicate') {
        const copy = { ...structuredClone(block), id: newBlockId() };
        const next = [...list];
        next.splice(index + 1, 0, copy);
        setBlocksOf(p, next);
        handlers.current.select(copy.id);
        scrollTo(p, copy);
      } else if (action === 'delete') {
        setConfirmDelete({ page: p, block });
      } else if (action === 'settings') {
        handlers.current.select(blockId);
      }
    },
    copy({ key, value }) {
      change((d) => {
        const current = { en: d.copy?.en?.[key] || '', ar: d.copy?.ar?.[key] || '' };
        const fallback = defaultCopy[locale]?.[key] || '';
        current[locale] = value.trim() === fallback.trim() ? '' : value;
        return { ...d, copy: setCopyValue(d.copy, key, current) };
      });
    },
    field({ page: p, blockId, field, value }) {
      const list = blocksOf(p);
      setBlocksOf(
        p,
        list.map((b) => (b.id === blockId ? setPath(b, field, { ...(getPath(b, field) || { en: '', ar: '' }), [locale]: value }) : b))
      );
    },
    image({ target, blockId }) {
      if (target === 'slideshow') return openPanel('slideshow');
      if (String(target).startsWith('page:')) {
        setSelectedId('');
        setInspector({ kind: 'pageImage', path: target.slice(5).split('.') });
        setShowInspector(true);
        return;
      }
      if (blockId) handlers.current.select(blockId);
    },
    navigate({ path }) {
      setFramePath(path);
      const id = pageForPath(path);
      setPage(id || 'other');
      setSelectedId('');
      setInspector(null);
    },
  };

  useEffect(() => {
    function onMessage(event) {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      const data = event.data || {};
      const h = handlers.current;
      switch (data.type) {
        case 'prime:preview-ready':
        case 'builder:hello':
          sendDraft();
          sendState();
          break;
        case 'builder:select':
          h.select(data.blockId);
          break;
        case 'builder:action':
          h.action(data);
          break;
        case 'builder:add':
          setAddAt({ page: data.page, index: data.index });
          break;
        case 'builder:copy':
          h.copy(data);
          break;
        case 'builder:field':
          h.field(data);
          break;
        case 'builder:image':
          h.image(data);
          break;
        case 'builder:navigate':
          h.navigate(data);
          break;
        case 'builder:history':
          if (data.action === 'redo') redo();
          else if (data.action === 'save') h.publish();
          else undo();
          break;
        default:
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [sendDraft, sendState, undo, redo]);

  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if (typing || !(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (k === 'y') {
        e.preventDefault();
        redo();
      } else if (k === 's') {
        e.preventDefault();
        if (dirty) onPublish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ——— Canvas size ——— */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, [loaded]);

  const frameWidth = DEVICES[device];
  const framed = device !== 'desktop';
  const available = Math.max(0, box.width - (framed ? 48 : 0));
  const scale = available ? Math.min(1, available / frameWidth) : 1;
  const frameHeight = box.height ? (box.height - (framed ? 32 : 0)) / scale : 800;
  const [frameSrc, setFrameSrc] = useState('/?__preview=1&__builder=1');
  // Only explicit page / language switches reload the frame (navigation inside it is reported back instead).
  const choosePage = (id) => {
    setPage(id);
    setSelectedId('');
    setInspector(null);
    setFramePath(ALL_PAGES[id].path);
    setFrameSrc(`${ALL_PAGES[id].path}?__preview=1&__builder=1${locale === 'ar' ? '&lang=ar' : ''}`);
  };
  const chooseLocale = (l) => {
    setLocale(l);
    setFrameSrc(`${framePath}?__preview=1&__builder=1${l === 'ar' ? '&lang=ar' : ''}`);
  };

  /* ——— Actions ——— */
  async function onPublish() {
    if (await save()) {
      toast.success('Published — the website now shows your changes.');
      resetHistory();
    }
  }
  function onDiscard() {
    discard();
    resetHistory();
  }
  function addBlock(type) {
    if (!addAt) return;
    const list = blocksOf(addAt.page);
    const block = newBlock(type);
    const next = [...list];
    next.splice(addAt.index, 0, block);
    setBlocksOf(addAt.page, next);
    setAddAt(null);
    handlers.current.select(block.id);
    scrollTo(addAt.page, block);
  }
  function closePanel() {
    setPanel('');
    if (params.get('panel')) setParams({}, { replace: true });
    // Slideshow, brands, lists and texts may have changed: reload them into the builder and the preview.
    if (!dirty) reload();
    setNonce((n) => n + 1);
  }
  function leave() {
    if (dirty && !window.confirm('You have unpublished changes. Leave without publishing?')) return;
    navigate('/admin');
  }

  /* ——— Inspector ——— */
  const selected = inspector?.kind === 'block' ? blocks.find((b) => b.id === inspector.id) : null;
  const selectedIndex = selected ? blocks.findIndex((b) => b.id === selected.id) : -1;
  const updateSelected = (patch) => setBlocksOf(page, blocks.map((b) => (b.id === selected.id ? { ...b, ...patch } : b)));
  const setPageImage = (path, value) => change((d) => ({ ...d, pages: setPath(d.pages || {}, path.join('.'), value) }));
  const setCopy = (copy) => change((d) => ({ ...d, copy }));

  const sectionEditor = (info) => (
    <div className="space-y-5">
      {info.about ? <p className="text-xs leading-relaxed text-prime-muted">{info.about}</p> : null}
      {info.image ? (
        <ImageUploadField label="Photo" value={getPath(draft.pages, info.image.join('.')) || ''} onChange={(v) => setPageImage(info.image, v)} folder="pages" />
      ) : null}
      {info.keys?.length ? <CopyFields keys={info.keys} copy={draft.copy} onChange={setCopy} /> : null}
      <PanelLink link={info.link} onOpenPanel={openPanel} />
    </div>
  );

  let inspectorBody;
  if (selected) {
    const isSection = selected.type === 'section';
    const info = isSection ? def.sections[selected.key] || { name: selected.key, keys: [] } : BLOCK_TYPES[selected.type];
    inspectorBody = (
      <>
        <div className="border-b border-prime-line px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-prime-gold-deep">{isSection ? 'Built-in section' : 'Section'}</p>
          <h2 className="mt-1 font-display text-lg font-bold text-prime-ink">{info.name}</h2>
          {!isSection ? <p className="truncate text-xs text-prime-muted">{blockSummary(selected)}</p> : null}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <IconButton label="Move up" disabled={selectedIndex <= 0} onClick={() => handlers.current.action({ page, blockId: selected.id, action: 'up' })}>
              <ArrowUp size={15} />
            </IconButton>
            <IconButton label="Move down" disabled={selectedIndex >= blocks.length - 1} onClick={() => handlers.current.action({ page, blockId: selected.id, action: 'down' })}>
              <ArrowDown size={15} />
            </IconButton>
            {!isSection ? (
              <IconButton label="Duplicate" onClick={() => handlers.current.action({ page, blockId: selected.id, action: 'duplicate' })}>
                <Copy size={15} />
              </IconButton>
            ) : null}
            <IconButton label={selected.hidden ? 'Show' : 'Hide'} onClick={() => handlers.current.action({ page, blockId: selected.id, action: selected.hidden ? 'show' : 'hide' })}>
              {selected.hidden ? <Eye size={15} /> : <EyeOff size={15} />}
            </IconButton>
            {!isSection ? (
              <IconButton label="Delete" onClick={() => setConfirmDelete({ page, block: selected })}>
                <Trash2 size={15} className="text-red-600" />
              </IconButton>
            ) : null}
          </div>
        </div>
        <div className="space-y-5 px-5 py-5">
          {isSection ? (
            sectionEditor(info)
          ) : (
            <>
              <BlockFields block={selected} set={updateSelected} />
              <LayoutFields block={selected} set={updateSelected} />
            </>
          )}
        </div>
      </>
    );
  } else if (inspector?.kind === 'pageImage') {
    inspectorBody = (
      <div className="space-y-4 px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-prime-gold-deep">Photo</p>
        <ImageUploadField label="Photo" value={getPath(draft.pages, inspector.path.join('.')) || ''} onChange={(v) => setPageImage(inspector.path, v)} folder="pages" ratio="16:9" />
        <p className="text-xs text-prime-muted">Leave empty to use the built-in photo.</p>
      </div>
    );
  } else {
    inspectorBody = (
      <div className="space-y-6 px-5 py-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-prime-gold-deep">{def ? 'Page' : 'Text-only page'}</p>
          <h2 className="mt-1 font-display text-lg font-bold text-prime-ink">{ALL_PAGES[page]?.label || framePath}</h2>
        </div>
        <ul className="space-y-2.5 text-[13px] leading-relaxed text-prime-ink">
          <li className="flex gap-2.5">
            <MousePointer2 size={15} className="mt-0.5 shrink-0 text-prime-gold-deep" />
            <span>
              <strong>Click any text</strong> on the page to type over it. Enter saves, Esc cancels.
            </span>
          </li>
          <li className="flex gap-2.5">
            <ImageIcon size={15} className="mt-0.5 shrink-0 text-prime-gold-deep" />
            <span>
              <strong>Click a photo</strong> to change it.
            </span>
          </li>
          {def ? (
            <>
              <li className="flex gap-2.5">
                <FolderCog size={15} className="mt-0.5 shrink-0 text-prime-gold-deep" />
                <span>
                  <strong>Hover a section</strong> for its toolbar: move, duplicate, hide, delete or open its settings.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-0.5 grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full bg-prime-gold text-[11px] font-bold leading-none text-white">+</span>
                <span>
                  <strong>Hover between two sections</strong> and press “Add section”, or use the button at the bottom of the page.
                </span>
              </li>
            </>
          ) : (
            <li className="text-xs text-prime-muted">This page has no sections to arrange, but every word on it can be edited in place.</li>
          )}
          <li className="text-xs text-prime-muted">Switch EN / AR at the top to edit the Arabic words. Ctrl+Z undoes, Ctrl+S publishes.</li>
        </ul>
        {def ? (
          <div className="space-y-5 border-t border-prime-line pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-ink">Top of the page</p>
            {def.hero.image ? (
              <ImageUploadField label="Hero photo" value={getPath(draft.pages, def.hero.image.join('.')) || ''} onChange={(v) => setPageImage(def.hero.image, v)} folder="pages" ratio="16:9" />
            ) : null}
            <PanelLink link={def.hero.link} onOpenPanel={openPanel} />
          </div>
        ) : null}
      </div>
    );
  }

  const h = history.current;

  return (
    <div className="flex h-dvh-100 flex-col bg-prime-mist text-prime-ink">
      {/* Top bar */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-prime-line bg-prime-surface px-3 py-2 sm:px-4">
        <button type="button" onClick={leave} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[12px] font-semibold text-prime-muted hover:text-prime-ink">
          <ArrowLeft size={15} /> Admin
        </button>
        <span className="hidden h-6 w-px bg-prime-line sm:block" />
        <span className="hidden font-display text-[15px] font-bold lg:block">Website Builder</span>
        <label className="ms-1">
          <span className="sr-only">Page</span>
          <select value={ALL_PAGES[page] ? page : ''} onChange={(e) => choosePage(e.target.value)} className="prime-input h-9 min-w-[11rem] py-0 text-[13px] font-semibold">
            {page === 'other' ? <option value="">Other page — {framePath}</option> : null}
            <optgroup label="Pages with sections">
              {Object.entries(PAGES).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Text-only pages">
              {Object.entries(TEXT_PAGES).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <div className="mx-auto flex flex-wrap items-center gap-2">
          <Segment
            value={mode}
            onChange={setMode}
            options={[
              ['edit', 'Edit'],
              ['preview', 'Preview'],
            ]}
          />
          <Segment
            value={device}
            onChange={setDevice}
            options={[
              ['desktop', 'Desktop', Monitor],
              ['tablet', 'Tablet', Tablet],
              ['mobile', 'Mobile', Smartphone],
            ]}
          />
          <Segment
            value={locale}
            onChange={chooseLocale}
            options={[
              ['en', 'EN'],
              ['ar', 'AR'],
            ]}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <IconButton label="Undo (Ctrl+Z)" onClick={undo} disabled={!h.past.length}>
            <Undo2 size={15} />
          </IconButton>
          <IconButton label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!h.future.length}>
            <Redo2 size={15} />
          </IconButton>
          <IconButton label="Reload preview" onClick={() => setNonce((n) => n + 1)}>
            <RotateCw size={15} />
          </IconButton>
          <a href={framePath} target="_blank" rel="noreferrer" title="Open the published page" className="grid h-9 w-9 place-items-center rounded-lg border border-prime-line hover:border-prime-ink">
            <ExternalLink size={15} />
          </a>
          <button type="button" onClick={() => openPanel('slideshow')} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-prime-line px-3 text-[12px] font-semibold hover:border-prime-ink">
            <FolderCog size={15} /> Site content
          </button>
          <IconButton label={showInspector ? 'Hide settings' : 'Show settings'} onClick={() => setShowInspector((v) => !v)} active={showInspector}>
            {showInspector ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </IconButton>
          <span className="mx-1 hidden h-6 w-px bg-prime-line sm:block" />
          {dirty ? (
            <button type="button" onClick={onDiscard} className="h-9 rounded-lg px-3 text-[12px] font-semibold text-prime-muted hover:text-prime-ink">
              Discard
            </button>
          ) : null}
          <button
            type="button"
            onClick={onPublish}
            disabled={!dirty || saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-prime-ink px-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-prime-sand transition hover:bg-brand-gold disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {dirty ? 'Publish' : 'Published'}
          </button>
        </div>
      </header>
      {error ? <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

      {!loaded ? (
        <div className="grid flex-1 place-items-center text-sm text-prime-muted">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Canvas */}
          <div ref={canvasRef} className={cn('relative min-w-0 flex-1 overflow-hidden', framed && 'flex justify-center py-4')}>
            <div
              className={cn('overflow-hidden bg-white', framed ? 'rounded-[26px] border-[6px] border-prime-night shadow-2xl' : 'h-full')}
              style={{ width: frameWidth * scale + (framed ? 12 : 0), height: framed ? box.height - 32 : '100%' }}
            >
              <iframe
                key={`${frameSrc}#${nonce}`}
                ref={frameRef}
                src={frameSrc}
                title="Website preview"
                className="block origin-top-left border-0"
                style={{ width: frameWidth, height: frameHeight, transform: `scale(${scale})` }}
              />
            </div>
            {mode === 'preview' ? (
              <span className="pointer-events-none absolute start-3 top-3 rounded-full bg-prime-ink/85 px-3 py-1 text-[11px] font-semibold text-prime-sand">
                Preview mode — links work, editing is off
              </span>
            ) : null}
          </div>

          {/* Inspector */}
          {showInspector ? (
            <aside className="flex w-[22rem] shrink-0 flex-col border-s border-prime-line bg-prime-surface">
              <div className="flex items-center justify-between border-b border-prime-line px-5 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted">Settings</span>
                {inspector ? (
                  <button
                    type="button"
                    onClick={() => {
                      setInspector(null);
                      setSelectedId('');
                    }}
                    className="text-[11px] font-semibold text-prime-muted hover:text-prime-ink"
                  >
                    Done
                  </button>
                ) : null}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{inspectorBody}</div>
            </aside>
          ) : null}
        </div>
      )}

      {/* Add a section */}
      {addAt ? (
        <div className="fixed inset-0 z-[300] grid place-items-center bg-prime-band/50 p-4 backdrop-blur-[2px]" onClick={() => setAddAt(null)}>
          <div className="w-full max-w-xl overflow-hidden rounded-xl bg-prime-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pb-1 pt-5">
              <p className="font-display text-lg font-bold text-prime-ink">Add a section</p>
              <p className="text-xs text-prime-muted">Pick what to add. You can edit it right on the page afterwards.</p>
            </div>
            <div className="p-2 [&>div]:border-0">
              <AddMenu onAdd={addBlock} onClose={() => setAddAt(null)} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Site content drawer */}
      {panel ? (
        <div className="fixed inset-0 z-[260] flex justify-end bg-prime-band/40" onClick={closePanel}>
          <div className="flex h-full w-full max-w-[980px] flex-col bg-prime-sand shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-prime-line bg-prime-surface px-4">
              {PANELS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPanel(id)}
                  className={cn(
                    '-mb-px whitespace-nowrap border-b-2 px-3 py-3.5 text-[11px] font-semibold uppercase tracking-[0.14em]',
                    panel === id ? 'border-prime-ink text-prime-ink' : 'border-transparent text-prime-muted hover:text-prime-ink'
                  )}
                >
                  {label}
                </button>
              ))}
              <button type="button" onClick={closePanel} className="ms-auto grid h-9 w-9 shrink-0 place-items-center text-prime-muted hover:text-prime-ink" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
              {panel === 'texts' && dirty ? (
                <div className="mx-auto max-w-md border border-prime-line bg-prime-surface p-6 text-center">
                  <p className="font-display text-lg font-bold">Publish your page changes first</p>
                  <p className="mt-2 text-sm text-prime-muted">The text list edits the same words as the builder. Publish or discard what you changed on the page, then open it.</p>
                  <div className="mt-5 flex justify-center gap-2">
                    <button type="button" className="prime-btn-outline" onClick={onDiscard}>
                      Discard
                    </button>
                    <button type="button" className="prime-btn" onClick={onPublish}>
                      Publish
                    </button>
                  </div>
                </div>
              ) : (
                <EmbeddedAdminContext.Provider value>
                  <Suspense fallback={<Loader2 className="mx-auto animate-spin" />}>
                    {PANELS.filter(([id]) => id === panel).map(([id, , Screen]) => (
                      <Screen key={id} />
                    ))}
                  </Suspense>
                </EmbeddedAdminContext.Provider>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete this section?"
        message="It is removed from the page when you publish. You can undo with Ctrl+Z."
        confirmText="Delete"
        danger
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          const { page: p, block } = confirmDelete;
          setBlocksOf(p, blocksOf(p).filter((b) => b.id !== block.id));
          if (selectedId === block.id) {
            setSelectedId('');
            setInspector(null);
          }
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}

export default function WebsiteBuilderPage() {
  return (
    <ToastProvider>
      <Builder />
    </ToastProvider>
  );
}
