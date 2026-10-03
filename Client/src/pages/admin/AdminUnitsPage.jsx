import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bath, BedDouble, Eye, EyeOff, Globe, Home, LayoutGrid, Layers, List, Pencil, Plus, RefreshCw, Ruler, Star, Users } from 'lucide-react';
import api from '../../api/client';
import { AdminPageHeader, MoveButtons, reorderList } from '../../components/admin/AdminUi';
import { Badge, ConfirmDialog, EmptyState, SearchInput, StatusChips, Tabs, useToast } from '../../components/admin/kit';
import UnitEditor, { kwentraMessage } from '../../components/admin/UnitEditor';
import { cn } from '../../utils/cn';

const isComplete = (u) => u.completeness?.complete !== false;
const missingLabels = (u) => (u.completeness?.missing || []).map((m) => m.label);

const STATUS = {
  all: () => true,
  live: (u) => u.published !== false && isComplete(u),
  incomplete: (u) => !isComplete(u),
  hidden: (u) => u.published === false,
  featured: (u) => u.featured,
  linked: (u) => Boolean(u.kwentraRoomTypeId),
  unlinked: (u) => !u.kwentraRoomTypeId,
};

const STATUS_LABELS = [
  ['all', 'All'],
  ['live', 'Live'],
  ['incomplete', 'Incomplete'],
  ['hidden', 'Hidden'],
  ['featured', 'Featured'],
  ['linked', 'Kwentra'],
  ['unlinked', 'Website only'],
];

const LAYOUT_KEY = 'prime.admin.units.layout';

function statusBadge(u) {
  if (u.published === false) return <Badge tone="gray">Hidden</Badge>;
  return isComplete(u) ? <Badge tone="green">Live</Badge> : <Badge tone="gray">Published</Badge>;
}

function UnitCard({ unit: u, selected, onSelect, onEdit, onToggle }) {
  const units = u.roomCount ?? u.unitNumbers?.length ?? 0;
  const live = u.published !== false && isComplete(u);
  const stats = [
    [BedDouble, u.bedrooms === 0 ? 'Studio' : u.bedrooms != null ? `${u.bedrooms} bed` : null],
    [Bath, u.bathrooms ? `${u.bathrooms} bath` : null],
    [Users, u.maxGuests ? `${u.maxGuests} guests` : null],
    [Ruler, u.areaSqm ? `${u.areaSqm} m²` : null],
  ].filter(([, label]) => label);

  return (
    <div className={cn('group flex flex-col border bg-prime-surface transition hover:shadow-md', selected ? 'border-prime-gold ring-1 ring-prime-gold' : 'border-prime-line')}>
      <div className="relative aspect-[4/3] overflow-hidden bg-prime-mist">
        <button type="button" className="absolute inset-0" onClick={onEdit} aria-label={`Edit ${u.title}`}>
          {u.images?.[0] ? (
            <img src={u.images[0]} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" referrerPolicy="no-referrer" loading="lazy" />
          ) : (
            <span className="grid h-full place-items-center text-prime-muted">
              <Home size={28} />
            </span>
          )}
        </button>
        <label className="absolute start-3 top-3 grid h-7 w-7 cursor-pointer place-items-center bg-white/90 shadow-sm">
          <input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Select ${u.title}`} />
        </label>
        <div className="pointer-events-none absolute end-3 top-3 flex flex-col items-end gap-1">
          {statusBadge(u)}
          {u.featured ? <Badge tone="gold">Featured</Badge> : null}
        </div>
        {u.images?.length > 1 ? (
          <span className="pointer-events-none absolute bottom-3 end-3 bg-black/60 px-2 py-0.5 text-[11px] text-white">{u.images.length} photos</span>
        ) : null}
        {!isComplete(u) ? (
          <button
            type="button"
            onClick={onEdit}
            title={`Missing: ${missingLabels(u).join(', ')}`}
            className="absolute inset-x-0 bottom-0 bg-red-600/90 px-3 py-1.5 text-start text-[11px] font-semibold text-white"
          >
            Incomplete · missing {missingLabels(u).join(', ')}
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <button type="button" onClick={onEdit} className="block max-w-full truncate text-start font-display text-lg font-bold text-prime-ink hover:underline">
              {u.title}
            </button>
            <p className="truncate text-sm text-prime-muted">{[u.compound, u.destination || u.region].filter(Boolean).join(' · ') || '—'}</p>
          </div>
          {u.unitType ? <span className="shrink-0 border border-prime-line px-2 py-0.5 text-[11px] font-semibold text-prime-ink">{u.unitType}</span> : null}
        </div>

        {stats.length ? (
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm text-prime-muted">
            {stats.map(([Icon, label]) => (
              <span key={label} className="flex items-center gap-1.5">
                <Icon size={15} className="shrink-0 opacity-70" />
                {label}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-prime-muted">
          {units ? (
            <span className="flex items-center gap-1" title={(u.unitNumbers || []).join(', ')}>
              <Layers size={13} /> {units} unit{units === 1 ? '' : 's'}
            </span>
          ) : null}
          {u.floor ? <span>Floor {u.floor}</span> : null}
          {u.kwentraRoomTypeId ? <Badge tone="blue">Kwentra #{u.kwentraRoomTypeId}</Badge> : <Badge>Website only</Badge>}
        </div>

        <p className="mt-3 text-sm">
          {u.pricePerNight ? (
            <>
              <span className="text-prime-muted">From </span>
              <span className="font-semibold tabular-nums text-prime-ink">
                {Number(u.pricePerNight).toLocaleString()} {u.currency}
              </span>
              <span className="text-prime-muted"> / night</span>
            </>
          ) : (
            <span className="text-prime-muted">No price yet</span>
          )}
        </p>

        <div className="min-h-4 flex-1" />
        <div className="flex items-center justify-between gap-2 border-t border-prime-line pt-3">
          {live && u.slug ? (
            <a
              href={`/listings/${encodeURIComponent(u.slug)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 border border-prime-line px-2 py-1 text-[11px] font-semibold text-prime-ink hover:border-prime-ink"
              title="Open the guest page"
            >
              <Globe size={13} /> Guest page
            </a>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggle({ published: u.published === false })}
              className={cn(
                'inline-flex items-center gap-1 border px-2 py-1 text-[11px] font-semibold',
                u.published === false ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
              )}
              title={u.published === false ? 'Show on the website' : 'Hide from the website'}
            >
              {u.published === false ? <Eye size={13} /> : <EyeOff size={13} />}
              {u.published === false ? 'Publish' : 'Hide'}
            </button>
            <button
              type="button"
              onClick={() => onToggle({ featured: !u.featured })}
              className={cn('grid h-7 w-7 place-items-center border', u.featured ? 'border-prime-gold bg-prime-gold/10 text-prime-gold-deep' : 'border-prime-line text-prime-muted hover:border-prime-ink')}
              title={u.featured ? 'Remove from homepage' : 'Feature on homepage'}
              aria-label={u.featured ? 'Unfeature' : 'Feature'}
            >
              <Star size={13} fill={u.featured ? 'currentColor' : 'none'} />
            </button>
            <button type="button" onClick={onEdit} className="grid h-7 w-7 place-items-center border border-prime-line hover:border-prime-ink" aria-label={`Edit ${u.title}`}>
              <Pencil size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminUnitsPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [home, setHome] = useState([]);
  const [compounds, setCompounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');
  const [layout, setLayout] = useState(() => localStorage.getItem(LAYOUT_KEY) || 'grid');
  const [status, setStatus] = useState('all');
  const [params] = useSearchParams();
  const [propertyFilter, setPropertyFilter] = useState(() => params.get('property') || '');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [editor, setEditor] = useState({ open: false, unit: null });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load() {
    const [unitsData, compoundsData] = await Promise.all([api.adminGetUnits(), api.adminGetCompounds()]);
    setItems(unitsData.items || []);
    setHome(unitsData.home || []);
    setCompounds(compoundsData.items || []);
  }

  useEffect(() => {
    load()
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [toast]);

  const compoundGroups = useMemo(() => {
    const groups = new Map();
    for (const c of compounds) {
      const key = c.region || 'No destination';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    return [...groups.entries()];
  }, [compounds]);

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((u) => {
      if (propertyFilter && u.compoundId !== propertyFilter) return false;
      if (!q) return true;
      return [u.title, u.compound, u.destination, u.unitType, u.slug, ...(u.unitNumbers || [])].join(' ').toLowerCase().includes(q);
    });
  }, [items, propertyFilter, query]);

  const filtered = useMemo(() => scoped.filter(STATUS[status]), [scoped, status]);
  const canReorder = view === 'order' && !propertyFilter && !query.trim() && status === 'all';
  const editorDefaults = useMemo(() => (propertyFilter ? { compoundId: propertyFilter } : {}), [propertyFilter]);

  const allSelected = filtered.length > 0 && filtered.every((u) => selected.has(u.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map((u) => u.id)));
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulk(patch, label) {
    setBulkBusy(true);
    try {
      const res = await api.adminBulkUpdateUnits([...selected], patch);
      toast.success(`${res.updated} unit type(s) ${label}.`);
      setSelected(new Set());
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBulkBusy(false);
    }
  }

  async function quickToggle(unit, patch) {
    try {
      await api.adminBulkUpdateUnits([unit.id], patch);
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function moveSearch(index, dir) {
    const next = reorderList(items, index, index + dir);
    setItems(next);
    try {
      await api.adminReorderSearchUnits(next.map((u) => u.id));
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function moveHome(index, dir) {
    const next = reorderList(home, index, index + dir);
    setHome(next);
    try {
      await api.adminReorderHomeUnits(next.map((u) => u.id));
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function onSaved(item, kw, photoWarning) {
    const [tone, message] = kwentraMessage(kw);
    toast[tone](message);
    if (photoWarning) toast.error(photoWarning);
    if (item && item.completeness?.complete === false) {
      toast.error(`Saved, but hidden from guests until filled: ${missingLabels(item).join(', ')}.`);
    }
    setEditor({ open: false, unit: null });
    await load();
  }

  async function doDelete() {
    try {
      await api.adminDeleteUnit(confirmDelete.id);
      toast.success(`Deleted “${confirmDelete.title}”.`);
      setConfirmDelete(null);
      setEditor({ open: false, unit: null });
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Unit types"
        lede={`${items.length} unit types · ${items.filter(STATUS.live).length} live · ${items.filter(STATUS.incomplete).length} incomplete (hidden until every field is filled). Details come from Kwentra; photos, visibility and ordering are website-only.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/sync" className="prime-btn-outline">
              <RefreshCw size={14} /> Kwentra sync
            </Link>
            <button type="button" className="prime-btn" onClick={() => setEditor({ open: true, unit: null })}>
              <Plus size={14} /> Add unit type
            </button>
          </div>
        }
      />

      <Tabs
        tabs={[
          ['list', 'All unit types'],
          ['order', 'Search order'],
          ['home', `Homepage featured (${home.length})`],
        ]}
        value={view}
        onChange={(v) => {
          setView(v);
          setSelected(new Set());
        }}
      />

      {view === 'home' ? (
        <div className="space-y-2">
          <p className="mb-3 text-sm text-prime-muted">Order of the “Featured stays” carousel on the homepage. Feature a unit type from its editor or with bulk actions.</p>
          {home.map((u, index) => (
            <div key={u.id} className="flex items-center justify-between gap-3 border border-prime-line bg-prime-surface px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-6 text-xs tabular-nums text-prime-muted">{index + 1}</span>
                {u.images?.[0] ? <img src={u.images[0]} alt="" className="h-12 w-16 object-cover" referrerPolicy="no-referrer" /> : null}
                <div className="min-w-0">
                  <p className="truncate font-medium">{u.title}</p>
                  <p className="truncate text-xs text-prime-muted">{u.compound}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" className="text-xs font-semibold text-prime-muted hover:text-red-600" onClick={() => quickToggle(u, { featured: false })}>
                  Remove
                </button>
                <MoveButtons disableUp={index === 0} disableDown={index === home.length - 1} onUp={() => moveHome(index, -1)} onDown={() => moveHome(index, 1)} />
              </div>
            </div>
          ))}
          {!home.length ? <EmptyState icon={Star} title="No featured unit types" subtitle="Select unit types in the list and choose “Feature”." /> : null}
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3">
            <StatusChips
              value={status}
              onChange={setStatus}
              options={STATUS_LABELS.map(([id, label]) => ({ id, label, count: scoped.filter(STATUS[id]).length }))}
            />
            <div className="flex flex-wrap items-center gap-3">
              <select className="prime-input w-auto min-w-[220px]" value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)}>
                <option value="">All properties</option>
                {compoundGroups.map(([destination, list]) => (
                  <optgroup key={destination} label={destination}>
                    {list.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <SearchInput value={query} onChange={setQuery} placeholder="Search title, type, slug or unit number…" className="min-w-[220px] flex-1" />
              {view === 'order' && !canReorder ? <span className="text-xs text-prime-muted">Clear filters to reorder.</span> : null}
              {view === 'list' ? (
                <div className="flex border border-prime-line bg-prime-surface p-0.5" role="group" aria-label="Layout">
                  {[
                    ['grid', 'Grid', LayoutGrid],
                    ['table', 'Table', List],
                  ].map(([id, label, Icon]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setLayout(id);
                        localStorage.setItem(LAYOUT_KEY, id);
                      }}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition',
                        layout === id ? 'bg-prime-night text-prime-sand' : 'text-prime-muted hover:text-prime-ink',
                      )}
                      aria-pressed={layout === id}
                    >
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {view === 'list' && layout === 'grid' && filtered.length ? (
              <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-prime-muted">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                Select all {filtered.length}
              </label>
            ) : null}
          </div>

          {selected.size ? (
            <div className="sticky top-14 z-20 mb-3 flex flex-wrap items-center gap-2 border border-prime-night bg-prime-night px-4 py-2.5 text-prime-sand">
              <span className="me-2 text-sm">{selected.size} selected</span>
              {[
                [{ published: true }, 'Publish', 'published'],
                [{ published: false }, 'Hide', 'hidden'],
                [{ featured: true }, 'Feature', 'featured'],
                [{ featured: false }, 'Unfeature', 'removed from the homepage'],
              ].map(([patch, label, done]) => (
                <button
                  key={label}
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => bulk(patch, done)}
                  className="border border-white/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] hover:border-white disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
              <button type="button" className="ms-auto text-xs underline underline-offset-4" onClick={() => setSelected(new Set())}>
                Clear
              </button>
            </div>
          ) : null}

          {loading ? (
            <p className="text-sm text-prime-muted">Loading…</p>
          ) : filtered.length && view === 'list' && layout === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((u) => (
                <UnitCard
                  key={u.id}
                  unit={u}
                  selected={selected.has(u.id)}
                  onSelect={() => toggleOne(u.id)}
                  onEdit={() => setEditor({ open: true, unit: u })}
                  onToggle={(patch) => quickToggle(u, patch)}
                />
              ))}
            </div>
          ) : filtered.length ? (
            <div className="overflow-x-auto border border-prime-line bg-prime-surface">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-prime-line text-[11px] uppercase tracking-[0.16em] text-prime-muted">
                  <tr>
                    <th className="w-10 px-3 py-3">
                      {view === 'order' ? null : <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />}
                    </th>
                    <th className="px-3 py-3">Unit type</th>
                    <th className="px-3 py-3">Property</th>
                    <th className="px-3 py-3">Units</th>
                    <th className="px-3 py-3">From price</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => {
                    const index = items.indexOf(u);
                    return (
                      <tr key={u.id} className={cn('border-b border-prime-line/70 hover:bg-prime-mist/50', selected.has(u.id) && 'bg-prime-gold/5')}>
                        <td className="px-3 py-3">
                          {view === 'order' ? (
                            canReorder ? (
                              <MoveButtons
                                disableUp={index === 0}
                                disableDown={index === items.length - 1}
                                onUp={() => moveSearch(index, -1)}
                                onDown={() => moveSearch(index, 1)}
                              />
                            ) : (
                              <span className="text-xs tabular-nums text-prime-muted">{index + 1}</span>
                            )
                          ) : (
                            <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} aria-label={`Select ${u.title}`} />
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <button type="button" className="flex items-center gap-3 text-start" onClick={() => setEditor({ open: true, unit: u })}>
                            <span className="h-11 w-14 shrink-0 overflow-hidden border border-prime-line bg-prime-mist">
                              {u.images?.[0] ? <img src={u.images[0]} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" loading="lazy" /> : null}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-medium hover:underline">{u.title}</span>
                              <span className="block text-xs text-prime-muted">
                                {[u.unitType, u.areaSqm ? `${u.areaSqm} m²` : '', u.maxGuests ? `${u.maxGuests} guests` : '', u.bedType].filter(Boolean).join(' · ')}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-3 text-prime-muted">
                          <span className="block text-prime-ink">{u.compound || '—'}</span>
                          <span className="text-xs">{u.destination || u.region}</span>
                        </td>
                        <td className="px-3 py-3 tabular-nums" title={(u.unitNumbers || []).join(', ')}>
                          {u.roomCount ?? (u.unitNumbers?.length || '—')}
                        </td>
                        <td className="px-3 py-3 tabular-nums">{u.pricePerNight ? `${Number(u.pricePerNight).toLocaleString()} ${u.currency}` : '—'}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            <button type="button" onClick={() => quickToggle(u, { published: u.published === false })} title="Toggle visibility">
                              <Badge tone={u.published === false ? 'gray' : isComplete(u) ? 'green' : 'gray'}>
                                {u.published === false ? 'Hidden' : isComplete(u) ? 'Live' : 'Published'}
                              </Badge>
                            </button>
                            {!isComplete(u) ? (
                              <button type="button" onClick={() => setEditor({ open: true, unit: u })} title={`Missing: ${missingLabels(u).join(', ')}`}>
                                <Badge tone="red">Incomplete · {missingLabels(u).length} missing</Badge>
                              </button>
                            ) : null}
                            {u.featured ? <Badge tone="gold">Featured</Badge> : null}
                            {u.kwentraRoomTypeId ? <Badge tone="blue">Kwentra #{u.kwentraRoomTypeId}</Badge> : <Badge>Website only</Badge>}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-end">
                          <button
                            type="button"
                            className="inline-grid h-8 w-8 place-items-center border border-prime-line hover:border-prime-ink"
                            onClick={() => setEditor({ open: true, unit: u })}
                            aria-label={`Edit ${u.title}`}
                          >
                            <Pencil size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Home}
              title={items.length ? 'No unit types match' : 'No unit types yet'}
              subtitle={items.length ? 'Try another filter or search.' : 'Add units in Kwentra and they appear here automatically, or add one by hand.'}
              action={
                <button type="button" className="prime-btn" onClick={() => setEditor({ open: true, unit: null })}>
                  <Plus size={14} /> Add unit type
                </button>
              }
            />
          )}
        </>
      )}

      <UnitEditor
        open={editor.open}
        unit={editor.unit}
        compounds={compounds}
        compoundGroups={compoundGroups}
        defaults={editorDefaults}
        onClose={() => setEditor({ open: false, unit: null })}
        onSaved={onSaved}
        onDelete={(u) => setConfirmDelete(u)}
      />
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        danger
        title="Delete unit type?"
        message={confirmDelete ? `“${confirmDelete.title}” will be removed from the website. It is not deleted in Kwentra — a later sync may bring it back; hide it instead to keep it off the site.` : ''}
        confirmText="Delete"
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
