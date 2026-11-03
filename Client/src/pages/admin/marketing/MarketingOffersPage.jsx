import { useEffect, useMemo, useState } from 'react';
import { BadgePercent, Check, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../../../api/client';
import { AdminPageHeader, ImageUploadField, MoveButtons, reorderList } from '../../../components/admin/AdminUi';
import {
  Badge,
  BilingualField,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Field,
  SaveBar,
  SearchInput,
  Toggle,
  useSiteSection,
  useToast,
} from '../../../components/admin/kit';
import { offerHref, useSite } from '../../../context/SiteContext';
import { cn } from '../../../utils/cn';
import MarketingNav from './MarketingNav';

const newId = () => `offer-${Math.random().toString(36).slice(2, 10)}`;

const BLANK = () => ({
  id: newId(),
  enabled: true,
  name: { en: '', ar: '' },
  text: { en: '', ar: '' },
  image: '',
  percent: 10,
  unitIds: [],
  compoundIds: [],
  showPopup: true,
  startsAt: '',
  endsAt: '',
});

export function offerStatus(offer, today = new Date().toISOString().slice(0, 10)) {
  if (offer.enabled === false) return ['Off', 'gray'];
  if (offer.startsAt && today < offer.startsAt) return ['Scheduled', 'gold'];
  if (offer.endsAt && today > offer.endsAt) return ['Ended', 'red'];
  return ['Live', 'green'];
}

function toggleId(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function CopyLink({ id }) {
  const [copied, setCopied] = useState(false);
  const path = offerHref(id);
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the path is visible to copy by hand */
    }
  }
  return (
    <button type="button" onClick={copy} className="inline-flex max-w-full items-center gap-1.5 text-[11px] text-prime-muted transition hover:text-prime-ink" title="Copy the guest link">
      {copied ? <Check size={12} className="text-green-700" /> : <Copy size={12} />}
      <span className="truncate font-mono">{path}</span>
    </button>
  );
}

/** Pick whole properties and/or single unit types */
function LinkedPicker({ offer, compounds, units, onChange }) {
  const [q, setQ] = useState('');
  const compoundName = useMemo(() => Object.fromEntries(compounds.map((c) => [c.id, c.name])), [compounds]);
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const map = new Map();
    for (const u of units) {
      const prop = compoundName[u.compoundId] || u.compound || 'Other';
      if (needle && !`${u.title} ${prop}`.toLowerCase().includes(needle)) continue;
      if (!map.has(prop)) map.set(prop, []);
      map.get(prop).push(u);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [units, compoundName, q]);

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted">
          Whole properties <span className="text-prime-ink">({offer.compoundIds.length})</span>
        </p>
        <p className="mb-3 text-[11px] text-prime-muted">Every unit type in a ticked property is included, including ones added later.</p>
        <div className="flex flex-wrap gap-2">
          {compounds.map((c) => {
            const on = offer.compoundIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ compoundIds: toggleId(offer.compoundIds, c.id) })}
                className={cn(
                  'inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition',
                  on ? 'border-prime-night bg-prime-night text-prime-sand' : 'border-prime-line hover:border-prime-ink'
                )}
              >
                {on ? <Check size={12} /> : null}
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted">
          Single unit types <span className="text-prime-ink">({offer.unitIds.length})</span>
        </p>
        <SearchInput value={q} onChange={setQ} placeholder="Search unit types or properties…" className="mb-3" />
        <div className="max-h-[22rem] space-y-4 overflow-y-auto border border-prime-line p-3">
          {groups.length ? (
            groups.map(([prop, list]) => {
              const whole = list.some((u) => offer.compoundIds.includes(u.compoundId));
              return (
                <div key={prop}>
                  <p className="mb-1.5 text-xs font-semibold text-prime-ink">
                    {prop}
                    {whole ? <span className="ms-2 font-normal text-green-700">· whole property included</span> : null}
                  </p>
                  <ul className="space-y-1">
                    {list.map((u) => (
                      <li key={u.id}>
                        <label className={cn('flex cursor-pointer items-center gap-2.5 text-sm', whole && 'opacity-50')}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[#231f20]"
                            checked={whole || offer.unitIds.includes(u.id)}
                            disabled={whole}
                            onChange={() => onChange({ unitIds: toggleId(offer.unitIds, u.id) })}
                          />
                          <span className="min-w-0 truncate">{u.title}</span>
                          {u.published === false ? <Badge>Unpublished</Badge> : null}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-prime-muted">No unit types match.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function OfferDrawer({ offer, compounds, units, onClose, onDone }) {
  const [form, setForm] = useState(offer);
  useEffect(() => setForm(offer), [offer]);
  if (!form) return <Drawer open={false} onClose={onClose} title="" />;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const linked = form.unitIds.length + form.compoundIds.length;
  const canSave = (form.name.en || form.name.ar) && linked > 0;

  return (
    <Drawer
      open={Boolean(offer)}
      onClose={onClose}
      wide
      title={form.name.en || form.name.ar || 'New offer'}
      subtitle="Changes apply when you press Save at the bottom of the page."
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-prime-muted">{canSave ? '' : 'Add a name and link at least one property or unit type.'}</p>
          <div className="flex gap-2">
            <button type="button" className="prime-btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="prime-btn" disabled={!canSave} onClick={() => onDone(form)}>
              Done
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <BilingualField label="Offer name" value={form.name} onChange={(name) => set({ name })} placeholder={{ en: 'Summer on the coast', ar: 'صيف على الساحل' }} />
        <BilingualField label="Short line (optional)" hint="Shown under the name on the offer page." value={form.text} onChange={(text) => set({ text })} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Discount %" hint="Shown as a badge on each stay.">
            <input
              type="number"
              min={0}
              max={100}
              className="prime-input"
              value={form.percent}
              onChange={(e) => set({ percent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
            />
          </Field>
          <Field label="Starts" hint="Optional">
            <input type="date" className="prime-input" value={form.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
          </Field>
          <Field label="Ends" hint="Optional">
            <input type="date" className="prime-input" min={form.startsAt || undefined} value={form.endsAt} onChange={(e) => set({ endsAt: e.target.value })} />
          </Field>
        </div>
        <ImageUploadField label="Offer photo" value={form.image} folder="site" ratio="4:5" size="1080×1350" onChange={(image) => set({ image })} />
        <div className="space-y-3">
          <Toggle checked={form.enabled !== false} onChange={(enabled) => set({ enabled })} label="Offer is on" hint="Turn off to hide the badge, pop-up and offer page without deleting it." />
          <Toggle
            checked={form.showPopup}
            disabled={!form.image}
            onChange={(showPopup) => set({ showPopup })}
            label="Show the photo as a pop-up"
            hint={form.image ? 'Guests tap the photo to see the stays in this offer. Shown once a day.' : 'Add a photo first.'}
          />
        </div>
        <LinkedPicker offer={form} compounds={compounds} units={units} onChange={set} />
      </div>
    </Drawer>
  );
}

export default function MarketingOffersPage() {
  const toast = useToast();
  const { replace } = useSite();
  const { draft, setDraft, dirty, saving, error, save, discard, loaded } = useSiteSection(api, 'offers', replace);
  const [compounds, setCompounds] = useState([]);
  const [units, setUnits] = useState([]);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    Promise.all([api.adminGetCompounds(), api.adminGetUnits()])
      .then(([c, u]) => {
        setCompounds(c.items || []);
        setUnits(u.items || []);
      })
      .catch((err) => toast.error(err.message));
  }, [toast]);

  const items = draft?.offers?.items || [];
  const setItems = (next) => setDraft((d) => ({ ...d, offers: { ...d.offers, items: next } }));

  function upsert(form) {
    setItems(items.some((o) => o.id === form.id) ? items.map((o) => (o.id === form.id ? form : o)) : [...items, form]);
    setEditing(null);
  }

  async function onSave() {
    if (await save()) toast.success('Offers saved — live on the website.');
  }

  const compoundName = Object.fromEntries(compounds.map((c) => [c.id, c.name]));

  return (
    <div>
      <MarketingNav />
      <AdminPageHeader
        title="Offers"
        lede="Group stays under a named discount. Each offer gets its own page of stays, a badge on its stays, and an optional photo pop-up. Link a hero slide to an offer from Hero slideshow."
        actions={
          <button type="button" className="prime-btn" onClick={() => setEditing(BLANK())}>
            <Plus size={14} /> Add offer
          </button>
        }
      />
      {error ? <p className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {!loaded ? (
        <p className="text-sm text-prime-muted">Loading…</p>
      ) : items.length ? (
        <ul className="space-y-3">
          {items.map((offer, i) => {
            const [status, tone] = offerStatus(offer);
            const props = offer.compoundIds.map((id) => compoundName[id]).filter(Boolean);
            return (
              <li key={offer.id} className="flex flex-col gap-4 border border-prime-line bg-prime-surface p-3 sm:flex-row sm:items-center">
                <button type="button" onClick={() => setEditing(offer)} className="relative h-24 w-full shrink-0 overflow-hidden bg-prime-mist sm:w-20">
                  {offer.image ? <img src={offer.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : null}
                  <span className="absolute start-1.5 top-1.5 bg-brand-gold px-1.5 py-0.5 text-[11px] font-bold text-white">−{offer.percent}%</span>
                </button>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-prime-ink">{offer.name.en || offer.name.ar}</p>
                    <Badge tone={tone}>{status}</Badge>
                    {offer.showPopup && offer.image ? <Badge>Pop-up</Badge> : null}
                  </div>
                  <p className="truncate text-xs text-prime-muted">
                    {[props.length ? props.join(', ') : null, offer.unitIds.length ? `${offer.unitIds.length} unit type${offer.unitIds.length === 1 ? '' : 's'}` : null]
                      .filter(Boolean)
                      .join(' + ') || 'Nothing linked yet'}
                    {offer.startsAt || offer.endsAt ? ` · ${offer.startsAt || '…'} → ${offer.endsAt || '…'}` : ''}
                  </p>
                  <CopyLink id={offer.id} />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Toggle checked={offer.enabled !== false} onChange={(enabled) => setItems(items.map((o) => (o.id === offer.id ? { ...o, enabled } : o)))} label="" />
                  <MoveButtons
                    disableUp={i === 0}
                    disableDown={i === items.length - 1}
                    onUp={() => setItems(reorderList(items, i, i - 1))}
                    onDown={() => setItems(reorderList(items, i, i + 1))}
                  />
                  <button type="button" onClick={() => setEditing(offer)} className="grid h-8 w-8 place-items-center border border-prime-line hover:border-prime-ink" aria-label="Edit offer">
                    <Pencil size={14} />
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(offer)} className="grid h-8 w-8 place-items-center border border-prime-line text-red-600 hover:border-red-600" aria-label="Delete offer">
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={BadgePercent}
          title="No offers yet"
          subtitle="Create one to show a discount badge, a photo pop-up and a page of the stays it covers."
          action={
            <button type="button" className="prime-btn" onClick={() => setEditing(BLANK())}>
              <Plus size={14} /> Add the first offer
            </button>
          }
        />
      )}
      <p className="mt-4 text-[11px] text-prime-muted">
        When several offers have a pop-up, guests see the first live one in this list. The percentage is shown to guests only. Make sure the PMS rates carry the same discount.
      </p>

      <OfferDrawer offer={editing} compounds={compounds} units={units} onClose={() => setEditing(null)} onDone={upsert} />
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        danger
        title="Delete this offer?"
        message="Its badge, pop-up and page are removed. Hero slides linked to it will lead to an empty page, so update them too. To keep it for later, switch it off instead."
        confirmText="Delete"
        onConfirm={() => {
          setItems(items.filter((o) => o.id !== confirmDelete.id));
          setConfirmDelete(null);
        }}
        onClose={() => setConfirmDelete(null)}
      />
      <SaveBar dirty={dirty} saving={saving} onSave={onSave} onDiscard={discard} />
    </div>
  );
}
