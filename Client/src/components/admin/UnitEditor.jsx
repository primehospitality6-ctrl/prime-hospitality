import { useEffect, useState } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import api from '../../api/client';
import { reorderList } from './AdminUi';
import { Badge, Drawer, Field, Toggle, labelCls } from './kit';

export const UNIT_TYPES = ['Studio', '1 BDR', '2 BDR', '3 BDR', '4 BDR'];

/** Sensible defaults when an admin picks a unit type — every field stays editable */
const UNIT_TYPE_DEFAULTS = {
  Studio: { bedrooms: 0, bathrooms: 1, areaSqm: 45, maxGuests: 2 },
  '1 BDR': { bedrooms: 1, bathrooms: 1, areaSqm: 75, maxGuests: 3 },
  '2 BDR': { bedrooms: 2, bathrooms: 2, areaSqm: 125, maxGuests: 5 },
  '3 BDR': { bedrooms: 3, bathrooms: 3, areaSqm: 175, maxGuests: 7 },
  '4 BDR': { bedrooms: 4, bathrooms: 4, areaSqm: 240, maxGuests: 9 },
};

const EMPTY = {
  title: '',
  slug: '',
  compoundId: '',
  city: '',
  unitType: '2 BDR',
  propertyType: 'Apartment',
  bedrooms: 2,
  bathrooms: 2,
  areaSqm: 100,
  maxGuests: 4,
  pricePerNight: 0,
  currency: 'EGP',
  featured: false,
  published: true,
  description: '',
  amenities: '',
  facilities: '',
  roomCount: '',
  unitNumbers: '',
  floor: '',
  bedType: '',
  images: [],
  driveFolderUrl: '',
  kwentraRoomTypeId: '',
};

/** One item per line; a single comma-separated line also works */
function toLines(text) {
  const raw = String(text || '');
  const parts = raw.includes('\n') ? raw.split('\n') : raw.split(',');
  return parts.map((s) => s.trim()).filter(Boolean);
}

function formFromUnit(u, defaults = {}) {
  if (!u) return { ...EMPTY, ...defaults };
  return {
    title: u.title || '',
    slug: u.slug || '',
    compoundId: u.compoundId || '',
    city: u.city || '',
    unitType: u.unitType || '',
    propertyType: u.propertyType || 'Apartment',
    bedrooms: u.bedrooms ?? 1,
    bathrooms: u.bathrooms || 1,
    areaSqm: u.areaSqm || 0,
    maxGuests: u.maxGuests || 2,
    pricePerNight: u.pricePerNight || 0,
    currency: u.currency || 'EGP',
    featured: Boolean(u.featured),
    published: u.published !== false,
    description: u.description || '',
    amenities: (u.amenities || []).join('\n'),
    facilities: (u.facilities || []).join('\n'),
    roomCount: u.roomCount ?? '',
    unitNumbers: (u.unitNumbers || []).join(', '),
    floor: u.floor || '',
    bedType: u.bedType || '',
    images: u.images || [],
    driveFolderUrl: u.driveFolderUrl || '',
    kwentraRoomTypeId: u.kwentraRoomTypeId || '',
  };
}

function payloadFromForm(form) {
  return {
    ...form,
    amenities: toLines(form.amenities),
    facilities: toLines(form.facilities),
    unitNumbers: String(form.unitNumbers || '')
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    roomCount: form.roomCount === '' ? null : Number(form.roomCount),
    images: form.images || [],
  };
}

export function kwentraMessage(kw = {}) {
  if (kw.pushed) return ['success', 'Saved on the website and sent to Kwentra.'];
  if (kw.reason === 'missing_kwentraRoomTypeId') return ['success', 'Saved on the website. Add the Kwentra room type ID to send changes to the PMS.'];
  if (kw.reason === 'not_configured') return ['success', 'Saved on the website (Kwentra is not connected yet).'];
  if (kw.reason === 'website_only') return ['success', 'Saved on the website. Kwentra keeps its own room type details.'];
  return ['error', `Saved on the website, but Kwentra did not accept the update${kw.error ? `: ${kw.error}` : ''}.`];
}

function Section({ title, hint, children }) {
  return (
    <section className="border-b border-prime-line pb-6 pt-1 last:border-b-0">
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-ink">{title}</h3>
      {hint ? <p className="mb-4 text-xs leading-relaxed text-prime-muted">{hint}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}

/** Create / edit a unit type in a side drawer */
export default function UnitEditor({ open, unit, compounds, compoundGroups, defaults, onClose, onSaved, onDelete }) {
  const [form, setForm] = useState(() => formFromUnit(unit, defaults));
  const [busy, setBusy] = useState(false);
  const [driveBusy, setDriveBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(formFromUnit(unit, defaults));
      setError('');
    }
  }, [open, unit, defaults]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const property = compounds.find((c) => c.id === form.compoundId);

  async function save() {
    if (!form.title.trim()) return setError('Give the unit type a title.');
    if (!form.compoundId) return setError('Choose the property it belongs to.');
    setBusy(true);
    setError('');
    try {
      const body = payloadFromForm(form);
      const res = unit ? await api.adminUpdateUnit(unit.id, body) : await api.adminCreateUnit(body);
      onSaved(res.item, res.kwentra, res.photoWarning);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadDriveFolder() {
    const url = String(form.driveFolderUrl || property?.driveFolderUrl || '').trim();
    if (!url) return setError('Paste a Google Drive folder link first.');
    setDriveBusy(true);
    setError('');
    try {
      const data = await api.adminDriveFolderImages(url);
      set({ driveFolderUrl: url, images: data.urls || (data.images || []).map((i) => i.url) });
    } catch (err) {
      setError(err.message || 'Could not load the Drive folder');
    } finally {
      setDriveBusy(false);
    }
  }

  const num = (key, label) => (
    <Field key={key} label={label}>
      <input className="prime-input" type="number" min="0" value={form[key]} onChange={(e) => set({ [key]: e.target.value === '' ? '' : Number(e.target.value) })} />
    </Field>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={unit ? unit.title : 'New unit type'}
      subtitle={unit ? [unit.compound, unit.destination].filter(Boolean).join(' · ') : 'Add a bookable unit type to a property'}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          {unit ? (
            <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600" onClick={() => onDelete(unit)}>
              <Trash2 size={14} /> Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {error ? <span className="max-w-xs text-xs text-red-600">{error}</span> : null}
            {unit ? (
              <a href={`/listings/${unit.slug}`} target="_blank" rel="noreferrer" className="prime-btn-outline">
                View <ExternalLink size={13} />
              </a>
            ) : null}
            <button type="button" className="prime-btn" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : unit ? 'Save changes' : 'Create unit type'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <Section title="Visibility">
          {unit?.completeness && !unit.completeness.complete ? (
            <div className="mb-4 border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
              <p className="font-semibold">Hidden from guests until every field is filled</p>
              <p className="mt-1 text-xs">Missing: {unit.completeness.missing.map((m) => m.label).join(', ')}.</p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-6">
            <Toggle checked={form.published} onChange={(published) => set({ published })} label="Published" hint="Bookable and visible in search" />
            <Toggle checked={form.featured} onChange={(featured) => set({ featured })} label="Featured on homepage" hint="Shown in the Featured stays carousel" />
          </div>
        </Section>

        <Section title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2">
              <input className="prime-input" value={form.title} onChange={(e) => set({ title: e.target.value })} />
            </Field>
            <Field label="Property">
              <select className="prime-input" value={form.compoundId} onChange={(e) => set({ compoundId: e.target.value })}>
                <option value="">Select…</option>
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
            </Field>
            <Field label="Unit type">
              <select
                className="prime-input"
                value={form.unitType}
                onChange={(e) => set({ unitType: e.target.value, ...(unit ? {} : UNIT_TYPE_DEFAULTS[e.target.value]) })}
              >
                <option value="">Select…</option>
                {UNIT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Web address (slug)" hint={form.slug ? `/listings/${form.slug}` : 'Created from the title'}>
              <input className="prime-input" value={form.slug} placeholder="auto" onChange={(e) => set({ slug: e.target.value })} />
            </Field>
            <Field label="City / area">
              <input className="prime-input" value={form.city} placeholder={property?.city || ''} onChange={(e) => set({ city: e.target.value })} />
            </Field>
          </div>
        </Section>

        <Section title="Details" hint="Synced from Kwentra when linked. Changes here are sent back to Kwentra when a room type ID is set.">
          <div className="grid gap-4 sm:grid-cols-4">
            {num('bedrooms', 'Bedrooms')}
            {num('bathrooms', 'Bathrooms')}
            {num('areaSqm', 'Area m²')}
            {num('maxGuests', 'Max guests')}
            <Field label="Beds" className="sm:col-span-2">
              <input className="prime-input" value={form.bedType} placeholder="King bed" onChange={(e) => set({ bedType: e.target.value })} />
            </Field>
            <Field label="Floor">
              <input className="prime-input" value={form.floor} placeholder="1st – 4th" onChange={(e) => set({ floor: e.target.value })} />
            </Field>
            {num('roomCount', 'Units of this type')}
            <Field label="Unit numbers (staff only)" className="sm:col-span-4" hint="Never shown to guests.">
              <input className="prime-input" value={form.unitNumbers} placeholder="101, 102, 205" onChange={(e) => set({ unitNumbers: e.target.value })} />
            </Field>
          </div>
        </Section>

        <Section title="Price shown on the website" hint="The “from” price on cards. Real nightly rates and totals come from Kwentra at booking time.">
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <Field label="From price per night">
              <input className="prime-input" type="number" min="0" value={form.pricePerNight} onChange={(e) => set({ pricePerNight: Number(e.target.value) })} />
            </Field>
            <Field label="Currency">
              <input className="prime-input" value={form.currency} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} />
            </Field>
          </div>
        </Section>

        <Section title="Description & amenities">
          <div className="space-y-4">
            <Field label="Description">
              <textarea className="prime-input min-h-[120px]" value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amenities (one per line)">
                <textarea className="prime-input min-h-[150px]" value={form.amenities} onChange={(e) => set({ amenities: e.target.value })} />
              </Field>
              <Field label="Extra facilities (one per line)" hint="Empty = the building’s facilities are shown.">
                <textarea className="prime-input min-h-[150px]" value={form.facilities} onChange={(e) => set({ facilities: e.target.value })} />
              </Field>
            </div>
          </div>
        </Section>

        <Section title="Photos" hint="Required — the unit stays hidden until it has photos. Share a Google Drive folder as “Anyone with the link” and paste it; saving loads the photos automatically, or use Load photos to preview. The first photo is the card cover.">
          <div className="flex flex-wrap gap-2">
            <input
              className="prime-input min-w-[240px] flex-1"
              value={form.driveFolderUrl}
              placeholder={property?.driveFolderUrl || 'https://drive.google.com/drive/folders/…'}
              onChange={(e) => set({ driveFolderUrl: e.target.value })}
            />
            <button type="button" className="prime-btn-outline" disabled={driveBusy} onClick={loadDriveFolder}>
              {driveBusy ? 'Loading…' : 'Load photos'}
            </button>
          </div>
          {form.images.length ? (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {form.images.map((src, i) => (
                <div key={`${src}-${i}`} className="group relative aspect-[4/3] overflow-hidden border border-prime-line bg-prime-mist">
                  <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                  {i === 0 ? <Badge tone="gold" className="absolute start-1 top-1">Cover</Badge> : null}
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 px-1 py-0.5 text-[11px] text-white opacity-0 transition group-hover:opacity-100">
                    <button type="button" disabled={i === 0} className="px-1 disabled:opacity-30" onClick={() => set({ images: reorderList(form.images, i, i - 1) })}>
                      ←
                    </button>
                    <button type="button" className="px-1" onClick={() => set({ images: form.images.filter((_, j) => j !== i) })}>
                      Remove
                    </button>
                    <button
                      type="button"
                      disabled={i === form.images.length - 1}
                      className="px-1 disabled:opacity-30"
                      onClick={() => set({ images: reorderList(form.images, i, i + 1) })}
                    >
                      →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-prime-muted">No photos yet.</p>
          )}
        </Section>

        <Section title="Kwentra link">
          <Field label="Kwentra room type ID" hint="Links availability, rates and bookings to the PMS. Filled automatically by Kwentra sync.">
            <input className="prime-input max-w-xs" value={form.kwentraRoomTypeId} placeholder="e.g. 301" onChange={(e) => set({ kwentraRoomTypeId: e.target.value })} />
          </Field>
          <p className={`${labelCls} mt-3 normal-case tracking-normal`}>
            {form.kwentraRoomTypeId ? 'Linked — edits to details are sent to Kwentra on save.' : 'Not linked — this unit type exists on the website only.'}
          </p>
        </Section>
      </div>
    </Drawer>
  );
}
