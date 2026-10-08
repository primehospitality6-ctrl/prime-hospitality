import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, MapPin, Minus, Plus } from 'lucide-react';
import DateRangePicker from '../ui/DateRangePicker';
import { useLocale } from '../../context/LocaleContext';
import api from '../../api/client';
import { cn } from '../../utils/cn';

const isAfterDay = (a, b) => {
  const sa = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const sb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return sa > sb;
};

function placeMenu(anchorEl, { align = 'start', minWidth = 240, maxWidth = 360 } = {}) {
  if (!anchorEl) return null;
  const rect = anchorEl.getBoundingClientRect();
  const width = Math.min(maxWidth, Math.max(rect.width, minWidth), window.innerWidth - 24);
  let left = align === 'end' ? rect.right - width : rect.left;
  if (left + width > window.innerWidth - 12) left = Math.max(12, window.innerWidth - width - 12);
  left = Math.max(12, left);
  const below = window.innerHeight - rect.bottom;
  const openUp = below < 320 && rect.top > below;
  return {
    position: 'fixed',
    ...(openUp ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
    left,
    width,
    maxHeight: Math.max(220, (openUp ? rect.top : below) - 24),
    zIndex: 400,
  };
}

function useFloating(open, anchorRef, options) {
  const [style, setStyle] = useState(null);
  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return undefined;
    }
    const update = () => setStyle(placeMenu(anchorRef.current, options));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
    // options are static per call site
  }, [open]);
  return style;
}

const fieldBtn =
  'group flex h-full w-full items-center gap-3 px-5 py-4 text-start transition-colors hover:bg-prime-mist/60 md:px-6 md:py-5';
const labelCls = 'flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-prime-muted';
const valueCls = 'mt-2 block truncate text-[15px] font-normal leading-none tracking-[-0.01em] md:text-[16px]';

export default function HeroSearch() {
  const navigate = useNavigate();
  const { t, term } = useLocale();
  const projectBtnRef = useRef(null);
  const guestBtnRef = useRef(null);
  const projectMenuRef = useRef(null);
  const guestMenuRef = useRef(null);
  const [destinations, setDestinations] = useState([]);
  const [criteria, setCriteria] = useState({
    project: '',
    destinationId: '',
    compoundId: '',
    checkin: '',
    checkout: '',
    guests: 2,
  });
  const [projectOpen, setProjectOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const projectStyle = useFloating(projectOpen, projectBtnRef, { minWidth: 280, maxWidth: 400 });
  const guestStyle = useFloating(guestOpen, guestBtnRef, { align: 'end', minWidth: 260, maxWidth: 300 });

  useEffect(() => {
    let cancelled = false;
    api
      .getDestinations()
      .then((res) => {
        if (!cancelled) setDestinations(res.items || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!projectOpen && !guestOpen) return undefined;
    const onOutside = (event) => {
      const target = event.target;
      if (!(projectBtnRef.current?.contains(target) || projectMenuRef.current?.contains(target))) setProjectOpen(false);
      if (!(guestBtnRef.current?.contains(target) || guestMenuRef.current?.contains(target))) setGuestOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setProjectOpen(false);
        setGuestOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [projectOpen, guestOpen]);

  const hasAnyProjects = useMemo(() => destinations.some((d) => d.projects?.length), [destinations]);

  function choose({ destinationId = '', compoundId = '', label = '' }) {
    setCriteria((c) => ({ ...c, destinationId, compoundId, project: label }));
    setProjectOpen(false);
  }

  const hasValidRange =
    criteria.checkin &&
    criteria.checkout &&
    isAfterDay(new Date(`${criteria.checkout}T00:00:00`), new Date(`${criteria.checkin}T00:00:00`));

  function handleSubmit(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (criteria.destinationId) params.set('destination', criteria.destinationId);
    if (criteria.compoundId) params.set('compound', criteria.compoundId);
    if (criteria.checkin) params.set('checkIn', criteria.checkin);
    if (criteria.checkout) params.set('checkOut', criteria.checkout);
    if (criteria.guests > 0) params.set('guests', String(criteria.guests));
    navigate(`/search?${params.toString()}`);
  }

  const menuShell = 'overflow-y-auto border border-prime-line bg-prime-surface p-1.5 text-prime-ink shadow-premium-lg';

  const projectMenu =
    projectOpen && projectStyle
      ? createPortal(
          <div ref={projectMenuRef} style={projectStyle} className={menuShell} role="listbox">
            <button
              type="button"
              onClick={() => choose({})}
              className="flex w-full items-center px-4 py-3 text-start text-[15px] transition hover:bg-prime-mist"
            >
              {t('home.anyProject')}
            </button>
            {destinations.map((d) => (
              <div key={d.id} className="border-t border-prime-line pt-1">
                <button
                  type="button"
                  onClick={() => choose({ destinationId: d.id, label: d.name })}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start transition hover:bg-prime-mist',
                    criteria.destinationId === d.id && !criteria.compoundId && 'bg-prime-mist'
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-prime-gold-deep">
                    <MapPin size={12} aria-hidden />
                    <span className="truncate">{term(d.name)}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-prime-muted">
                    {t('home.propertiesCount', { count: d.projectCount ?? d.projects?.length ?? 0 })}
                  </span>
                </button>
                {(d.projects || []).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => choose({ destinationId: d.id, compoundId: option.id, label: option.name })}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 py-2.5 pe-4 ps-9 text-start transition hover:bg-prime-mist',
                      criteria.compoundId === option.id && 'bg-prime-mist'
                    )}
                  >
                    <span className="block min-w-0 truncate text-[15px]">{term(option.name)}</span>
                    {option.brand ? (
                      <span className="shrink-0 text-[11px] uppercase tracking-[0.16em] text-prime-muted">{option.brand}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))}
            {!destinations.length || !hasAnyProjects ? (
              <p className="px-4 py-3 text-sm text-prime-muted">{t('home.noProjects')}</p>
            ) : null}
          </div>,
          document.body
        )
      : null;

  const guestMenu =
    guestOpen && guestStyle
      ? createPortal(
          <div ref={guestMenuRef} style={guestStyle} className={cn(menuShell, 'p-5')}>
            <p className="prime-label">{t('home.searchGuests')}</p>
            <div className="mt-4 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setCriteria((c) => ({ ...c, guests: Math.max(1, c.guests - 1) }))}
                disabled={criteria.guests <= 1}
                aria-label="Fewer guests"
                className="grid h-11 w-11 place-items-center rounded-full border border-prime-line transition hover:border-prime-ink disabled:opacity-40"
              >
                <Minus size={16} strokeWidth={1.5} />
              </button>
              <span className="font-display text-4xl font-extralight tabular-nums">{criteria.guests}</span>
              <button
                type="button"
                onClick={() => setCriteria((c) => ({ ...c, guests: Math.min(16, c.guests + 1) }))}
                aria-label="More guests"
                className="grid h-11 w-11 place-items-center rounded-full border border-prime-line transition hover:border-prime-ink"
              >
                <Plus size={16} strokeWidth={1.5} />
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <form
      onSubmit={handleSubmit}
      className="relative z-[60] w-full bg-prime-surface text-prime-ink shadow-[0_30px_80px_rgba(0,0,0,0.25)]"
    >
      <div className="grid divide-y divide-prime-line md:grid-cols-[1.25fr_1.5fr_0.9fr_auto] md:divide-x md:divide-y-0 rtl:md:divide-x-reverse">
        <div className="relative">
          <button
            ref={projectBtnRef}
            type="button"
            aria-expanded={projectOpen}
            aria-haspopup="listbox"
            onClick={() => {
              setProjectOpen((o) => !o);
              setGuestOpen(false);
            }}
            className={fieldBtn}
          >
            <span className="min-w-0 flex-1">
              <span className={labelCls}>
                {t('home.project')}
                <ChevronDown size={12} className={cn('transition', projectOpen && 'rotate-180')} />
              </span>
              <span className={cn(valueCls, !criteria.project && 'text-prime-muted/80')}>
                {criteria.project || t('home.whichProject')}
              </span>
            </span>
          </button>
          {projectMenu}
        </div>

        <div>
          <DateRangePicker
            variant="hero"
            checkin={criteria.checkin}
            checkout={criteria.checkout}
            onChange={({ checkin, checkout }) => setCriteria((c) => ({ ...c, checkin: checkin || '', checkout: checkout || '' }))}
            onOpenChange={(open) => {
              if (open) {
                setProjectOpen(false);
                setGuestOpen(false);
              }
            }}
          />
        </div>

        <div className="relative">
          <button
            ref={guestBtnRef}
            type="button"
            aria-expanded={guestOpen}
            onClick={() => {
              setGuestOpen((o) => !o);
              setProjectOpen(false);
            }}
            className={fieldBtn}
          >
            <span className="min-w-0 flex-1">
              <span className={labelCls}>{t('home.searchGuests')}</span>
              <span className={valueCls}>{t('common.guestsCount', { count: criteria.guests })}</span>
            </span>
          </button>
          {guestMenu}
        </div>

        <div className="flex p-2">
          <button
            type="submit"
            disabled={criteria.checkin && criteria.checkout ? !hasValidRange : false}
            className="group inline-flex min-h-[3.5rem] w-full items-center justify-center gap-3 rounded-btn bg-prime-ink px-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-prime-sand transition hover:bg-brand-gold disabled:cursor-not-allowed disabled:opacity-50 md:min-w-[180px]"
          >
            {t('home.searchStays')}
            <ArrowRight size={15} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
          </button>
        </div>
      </div>
    </form>
  );
}
