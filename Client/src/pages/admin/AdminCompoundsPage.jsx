import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, Pencil, Plus } from 'lucide-react';
import api from '../../api/client';
import { AdminPageHeader, ImageUploadField, MoveButtons, reorderList } from '../../components/admin/AdminUi';
import { Badge, ConfirmDialog, Drawer, EmptyState, Field, SearchInput, StatusChips, Toggle, useToast } from '../../components/admin/kit';

const BRANDS = ['Inn', 'Residence', 'Select'];

const DETAIL_FIELDS = [
  ['address', 'Address', 'e.g. Building No.176, South 90th St, New Cairo'],
  ['buildingNumber', 'Building number', 'e.g. 176'],
  ['phone', 'Reception phone (staff only)', '+20…'],
  ['mapsUrl', 'Google Maps link', 'https://maps.app.goo.gl/…'],
  ['driveFolderUrl', 'Photos — Google Drive folder (staff only)', 'https://drive.google.com/drive/folders/…'],
  ['factSheetUrl', 'Fact sheet link (staff only)', 'https://…'],
];

const BASIC_KEYS = ['name', 'destinationId', 'brand', 'city', 'image', 'showOnHome', 'published', 'kwentraProjectId', 'kwentraTenantId'];

const EMPTY = {
  name: '',
  destinationId: '',
  brand: '',
  city: '',
  image: '',
  showOnHome: true,
  published: true,
  kwentraProjectId: '',
  kwentraTenantId: '',
  description: '',
  facilities: '',
  ...Object.fromEntries(DETAIL_FIELDS.map(([key]) => [key, ''])),
};

function toForm(c) {
  if (!c) return EMPTY;
  const form = { ...EMPTY };
  for (const key of [...BASIC_KEYS, 'description', ...DETAIL_FIELDS.map(([k]) => k)]) {
    if (c[key] !== undefined && c[key] !== null) form[key] = c[key];
  }
  form.facilities = (c.facilities || []).join('\n');
  return form;
}

function detailsFilled(c) {
  return DETAIL_FIELDS.filter(([key]) => c[key]).length + (c.facilities?.length ? 1 : 0) + (c.description ? 1 : 0);
}
const DETAIL_TOTAL = DETAIL_FIELDS.length + 2;

const STATUS = {
  all: () => true,
  published: (c) => c.published !== false,
  hidden: (c) => c.published === false,
  home: (c) => c.showOnHome !== false,
  incomplete: (c) => !c.image || detailsFilled(c) < DETAIL_TOTAL,
};

function PropertyEditor({ open, property, destinations, unitCount, defaults, onClose, onSaved, onDelete }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setForm(property ? toForm(property) : { ...EMPTY, ...defaults });
  }, [open, property, defaults]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    if (!form.name.trim()) return toast.error('Give the property a name.');
    if (!form.destinationId) return toast.error('Choose a destination.');
    setBusy(true);
    try {
      const body = {
        ...form,
        facilities: form.facilities
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      if (property) await api.adminUpdateCompound(property.id, body);
      else await api.adminCreateCompound(body);
      onSaved(property ? 'Property saved.' : 'Property created.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const hasPin = property?.latitude != null && property?.longitude != null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={property ? property.name : 'New property'}
      subtitle={property ? `${property.region || 'No destination'} · ${unitCount} unit types${hasPin ? ' · map pin set' : ''}` : 'Middle level: Destination › Property › Unit type'}
      footer={
        <div className="flex items-center justify-between gap-3">
          {property ? (
            <button
              type="button"
              className="text-xs font-semibold text-red-600 disabled:opacity-40"
              disabled={unitCount > 0}
              title={unitCount > 0 ? 'Delete or move its unit types first' : undefined}
              onClick={() => onDelete(property)}
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="prime-btn" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : property ? 'Save changes' : 'Create property'}
          </button>
        </div>
      }
    >
      <div className="space-y-8">
        <section>
          <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em]">Visibility</h3>
          <div className="flex flex-wrap gap-6">
            <Toggle checked={form.published} onChange={(published) => set({ published })} label="Published" hint="Its unit types can appear on the site" />
            <Toggle checked={form.showOnHome} onChange={(showOnHome) => set({ showOnHome })} label="Show on homepage" hint="Properties section" />
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] sm:col-span-2">Basics</h3>
          <Field label="Name" className="sm:col-span-2">
            <input className="prime-input" value={form.name} placeholder="e.g. Prime Residence Mivida" onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Destination">
            <select className="prime-input" value={form.destinationId || ''} onChange={(e) => set({ destinationId: e.target.value })}>
              <option value="">Select destination…</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Brand">
            <select className="prime-input" value={form.brand || ''} onChange={(e) => set({ brand: e.target.value })}>
              <option value="">From name</option>
              {BRANDS.map((b) => (
                <option key={b} value={b}>
                  Prime {b}
                </option>
              ))}
            </select>
          </Field>
          <Field label="City / area">
            <input className="prime-input" value={form.city || ''} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label="Kwentra tenant ID" hint="The Kwentra hotel this property lives in. Its unit types, availability and bookings use this tenant.">
            <input className="prime-input font-mono" value={form.kwentraTenantId || ''} placeholder="from Kwentra" onChange={(e) => set({ kwentraTenantId: e.target.value.trim() })} />
          </Field>
          <Field label="Kwentra project ID" hint="Only needed if Kwentra exposes properties as records.">
            <input className="prime-input" value={form.kwentraProjectId || ''} placeholder="optional" onChange={(e) => set({ kwentraProjectId: e.target.value })} />
          </Field>
          <ImageUploadField
            className="sm:col-span-2"
            label="Cover photo"
            value={form.image}
            folder="compounds"
            ratio="4:3 or 3:2"
            size="1200×900"
            onChange={(image) => set({ image })}
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em]">Property details</h3>
            <p className="mt-1 text-xs text-prime-muted">
              Shown on every unit page of this property. The map pin is read from the Google Maps link; staff-only fields are never shown on the website.
            </p>
          </div>
          <Field label="Description" className="sm:col-span-2">
            <textarea className="prime-input min-h-[90px]" value={form.description || ''} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          {DETAIL_FIELDS.map(([key, label, placeholder]) => (
            <Field key={key} label={label}>
              <input className="prime-input" value={form[key] || ''} placeholder={placeholder} onChange={(e) => set({ [key]: e.target.value })} />
            </Field>
          ))}
          <Field label="Building facilities" hint="One per line." className="sm:col-span-2">
            <textarea
              className="prime-input min-h-[120px]"
              value={form.facilities}
              placeholder={'Reception 24/7\nFree parking\nFree gym'}
              onChange={(e) => set({ facilities: e.target.value })}
            />
          </Field>
        </section>
      </div>
    </Drawer>
  );
}

/** Properties — middle level: Destination › Property › Unit type */
export default function AdminCompoundsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState({ open: false, property: null });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const destinationFilter = params.get('destination') || '';

  async function load() {
    const [c, d, u] = await Promise.all([api.adminGetCompounds(), api.adminGetDestinations(), api.adminGetUnits()]);
    setItems(c.items || []);
    setDestinations(d.items || []);
    setUnits(u.items || []);
  }

  useEffect(() => {
    load()
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [toast]);

  const unitCounts = useMemo(() => {
    const map = {};
    for (const u of units) map[u.compoundId] = (map[u.compoundId] || 0) + 1;
    return map;
  }, [units]);

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((c) => {
      if (destinationFilter && c.destinationId !== destinationFilter) return false;
      if (!q) return true;
      return [c.name, c.city, c.region, c.brand, c.address].join(' ').toLowerCase().includes(q);
    });
  }, [items, destinationFilter, query]);

  const filtered = useMemo(() => scoped.filter(STATUS[status]), [scoped, status]);
  const canReorder = !destinationFilter && !query.trim() && status === 'all';
  const editorDefaults = useMemo(() => (destinationFilter ? { destinationId: destinationFilter } : {}), [destinationFilter]);

  function setDestinationFilter(value) {
    const next = new URLSearchParams(params);
    if (value) next.set('destination', value);
    else next.delete('destination');
    setParams(next, { replace: true });
  }

  async function quickSave(c, patch) {
    setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
    try {
      await api.adminUpdateCompound(c.id, patch);
    } catch (err) {
      toast.error(err.message);
      await load();
    }
  }

  async function move(index, dir) {
    const next = reorderList(items, index, index + dir);
    setItems(next);
    try {
      await api.adminReorderCompounds(next.map((c) => c.id));
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function doDelete() {
    try {
      const data = await api.adminDeleteCompound(confirmDelete.id);
      setItems(data.items || []);
      toast.success(`Deleted “${confirmDelete.name}”.`);
      setConfirmDelete(null);
      setEditor({ open: false, property: null });
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Properties"
        lede={`${items.length} properties. Each belongs to a destination and carries a brand (Inn, Residence, Select); unit types live under Unit types.`}
        actions={
          <button type="button" className="prime-btn" onClick={() => setEditor({ open: true, property: null })}>
            <Plus size={14} /> Add property
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <StatusChips
          value={status}
          onChange={setStatus}
          options={[
            ['all', 'All'],
            ['published', 'Published'],
            ['hidden', 'Hidden'],
            ['home', 'On homepage'],
            ['incomplete', 'Missing details'],
          ].map(([id, label]) => ({ id, label, count: scoped.filter(STATUS[id]).length }))}
        />
        <div className="flex flex-wrap items-center gap-3">
          <select className="prime-input w-auto min-w-[200px]" value={destinationFilter} onChange={(e) => setDestinationFilter(e.target.value)}>
            <option value="">All destinations</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <SearchInput value={query} onChange={setQuery} placeholder="Search name, city, brand or address…" className="min-w-[220px] flex-1" />
          {!canReorder ? <span className="text-xs text-prime-muted">Clear filters to reorder.</span> : null}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-prime-muted">Loading…</p>
      ) : filtered.length ? (
        <div className="overflow-x-auto border border-prime-line bg-prime-surface">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-prime-line text-[11px] uppercase tracking-[0.16em] text-prime-muted">
              <tr>
                <th className="px-3 py-3">Order</th>
                <th className="px-3 py-3">Property</th>
                <th className="px-3 py-3">Destination</th>
                <th className="px-3 py-3">Unit types</th>
                <th className="px-3 py-3">Details</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const index = items.indexOf(c);
                const filled = detailsFilled(c);
                const count = unitCounts[c.id] || 0;
                return (
                  <tr key={c.id} className="border-b border-prime-line/70 hover:bg-prime-mist/50">
                    <td className="px-3 py-3">
                      {canReorder ? (
                        <MoveButtons disableUp={index === 0} disableDown={index === items.length - 1} onUp={() => move(index, -1)} onDown={() => move(index, 1)} />
                      ) : (
                        <span className="text-xs tabular-nums text-prime-muted">{index + 1}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <button type="button" className="flex items-center gap-3 text-start" onClick={() => setEditor({ open: true, property: c })}>
                        <span className="h-11 w-14 shrink-0 overflow-hidden border border-prime-line bg-prime-mist">
                          {c.image ? <img src={c.image} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium hover:underline">{c.name}</span>
                          <span className="block text-xs text-prime-muted">{[c.brand ? `Prime ${c.brand}` : '', c.city].filter(Boolean).join(' · ')}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-prime-muted">{c.region || '—'}</td>
                    <td className="px-3 py-3 tabular-nums">
                      <Link to={`/admin/units?property=${encodeURIComponent(c.id)}`} className="hover:underline">
                        {count}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden bg-prime-mist">
                          <span className="block h-full bg-prime-gold" style={{ width: `${(filled / DETAIL_TOTAL) * 100}%` }} />
                        </span>
                        <span className="text-xs tabular-nums text-prime-muted">
                          {filled}/{DETAIL_TOTAL}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" onClick={() => quickSave(c, { published: c.published === false })} title="Toggle visibility">
                          <Badge tone={c.published === false ? 'gray' : 'green'}>{c.published === false ? 'Hidden' : 'Published'}</Badge>
                        </button>
                        {c.showOnHome !== false ? <Badge tone="gold">Homepage</Badge> : null}
                        {c.kwentraTenantId ? <Badge tone="blue">Kwentra tenant {c.kwentraTenantId}</Badge> : null}
                        {!c.image ? <Badge tone="red">No photo</Badge> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-end">
                      <button
                        type="button"
                        className="inline-grid h-8 w-8 place-items-center border border-prime-line hover:border-prime-ink"
                        onClick={() => setEditor({ open: true, property: c })}
                        aria-label={`Edit ${c.name}`}
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
          icon={Building2}
          title={items.length ? 'No properties match' : 'No properties yet'}
          subtitle={items.length ? 'Try another filter or search.' : 'Sync from Kwentra or add your first property.'}
        />
      )}

      <PropertyEditor
        open={editor.open}
        property={editor.property}
        destinations={destinations}
        unitCount={editor.property ? unitCounts[editor.property.id] || 0 : 0}
        defaults={editorDefaults}
        onClose={() => setEditor({ open: false, property: null })}
        onSaved={async (msg) => {
          toast.success(msg);
          setEditor({ open: false, property: null });
          await load();
        }}
        onDelete={setConfirmDelete}
      />
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        danger
        title="Delete property?"
        message={confirmDelete ? `“${confirmDelete.name}” will be removed from the website. It is not deleted in Kwentra.` : ''}
        confirmText="Delete"
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
