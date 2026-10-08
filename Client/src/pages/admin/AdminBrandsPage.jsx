import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../api/client';
import { AdminPageHeader, ImageUploadField, MoveButtons, reorderList } from '../../components/admin/AdminUi';
import { Card, ConfirmDialog, Field, SaveBar, useSiteSection, useToast } from '../../components/admin/kit';
import Wordmark from '../../components/ui/Wordmark';
import { useSite } from '../../context/SiteContext';

const NEW_BRAND = { name: '', nameAr: '', color: '#231F20', image: '', text: { en: '', ar: '' } };
const HEX = /^#[0-9a-f]{6}$/i;

/** The brand's home-page card in miniature */
function BrandPreview({ brand }) {
  const color = HEX.test(brand.color) ? brand.color : '#231F20';
  return (
    <div className="relative isolate aspect-[4/5] w-full overflow-hidden text-white" style={{ backgroundColor: color }}>
      {brand.image ? (
        <>
          <img src={brand.image} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
          <div className="absolute inset-0 -z-10 opacity-80 mix-blend-multiply" style={{ backgroundColor: color }} />
        </>
      ) : null}
      <Wordmark word={brand.name || 'Brand'} className="absolute start-[8%] top-[8%] text-[2.4rem] text-white/90" />
      <p className="absolute inset-x-[8%] bottom-[8%] text-[9px] font-semibold uppercase tracking-[0.36em]">
        Prime <span className="font-light">{brand.name || '…'}</span>
      </p>
    </div>
  );
}

function BrandEditor({ brand, index, count, onChange, onMove, onRemove }) {
  const set = (patch) => onChange({ ...brand, ...patch });
  const setText = (locale, value) => set({ text: { ...brand.text, [locale]: value } });
  return (
    <li className="border border-prime-line bg-prime-surface p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-prime-ink">{brand.name ? `Prime ${brand.name}` : `Brand ${index + 1}`}</span>
        <div className="flex items-center gap-2">
          <MoveButtons
            disableUp={index === 0}
            disableDown={index === count - 1}
            onUp={() => onMove(index - 1)}
            onDown={() => onMove(index + 1)}
          />
          <button type="button" className="grid h-8 w-8 place-items-center text-red-600" aria-label="Remove brand" onClick={onRemove}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[160px_1fr]">
        <BrandPreview brand={brand} />
        <div className="grid content-start gap-4 sm:grid-cols-2">
          <Field label="Name" hint="Without “Prime” — e.g. Residence">
            <input className="prime-input" value={brand.name} placeholder="Residence" onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Arabic name" hint="Shown as “برايم …” on the Arabic site">
            <input className="prime-input" dir="rtl" value={brand.nameAr} placeholder="ريزيدنس" onChange={(e) => set({ nameAr: e.target.value })} />
          </Field>
          <Field label="Colour">
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-11 w-14 shrink-0 cursor-pointer border border-prime-line bg-transparent p-1"
                value={HEX.test(brand.color) ? brand.color : '#231F20'}
                onChange={(e) => set({ color: e.target.value.toUpperCase() })}
                aria-label="Pick colour"
              />
              <input
                className="prime-input font-mono uppercase"
                value={brand.color}
                maxLength={7}
                placeholder="#58595B"
                onChange={(e) => set({ color: e.target.value.trim() })}
              />
            </div>
          </Field>
          <ImageUploadField
            label="Photo"
            value={brand.image}
            onChange={(url) => set({ image: url })}
            folder="site"
            ratio="4:5"
          />
          <Field label="Description (English)" className="sm:col-span-2">
            <textarea rows={2} className="prime-input" value={brand.text?.en || ''} onChange={(e) => setText('en', e.target.value)} />
          </Field>
          <Field label="Description (Arabic)" className="sm:col-span-2">
            <textarea rows={2} dir="rtl" className="prime-input" value={brand.text?.ar || ''} onChange={(e) => setText('ar', e.target.value)} />
          </Field>
        </div>
      </div>
    </li>
  );
}

export default function AdminBrandsPage() {
  const toast = useToast();
  const { replace } = useSite();
  const { draft, setDraft, dirty, saving, error, save, discard, loaded } = useSiteSection(api, 'brands', replace);
  const [removing, setRemoving] = useState(null);
  const items = draft?.brands?.items || [];

  const setItems = (next) => setDraft((d) => ({ ...d, brands: { ...d.brands, items: next } }));

  async function onSave() {
    const names = items.map((b) => b.name.trim().replace(/^prime\s+/i, '').toLowerCase()).filter(Boolean);
    if (names.length !== items.length) return toast.error('Every brand needs a name.');
    if (new Set(names).size !== names.length) return toast.error('Two brands have the same name.');
    if (items.some((b) => !HEX.test(b.color))) return toast.error('Colours must look like #58595B.');
    if (await save()) toast.success('Brands saved — live on the website.');
  }

  return (
    <div>
      <AdminPageHeader
        title="Brands"
        lede="Prime sub-brands shown as colour cards on the homepage, as coloured tags on stay cards and in the search filter. Properties are linked to a brand in Inventory › Properties."
      />
      {error ? <p className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {!loaded ? (
        <p className="text-sm text-prime-muted">Loading…</p>
      ) : (
        <Card
          title={`${items.length} ${items.length === 1 ? 'brand' : 'brands'}`}
          description="With no photo, the homepage card uses a photo of one of the brand's properties. Up to 12 brands."
          actions={
            <button
              type="button"
              className="prime-btn-outline"
              disabled={items.length >= 12}
              onClick={() => setItems([...items, structuredClone(NEW_BRAND)])}
            >
              <Plus size={14} /> Add brand
            </button>
          }
        >
          {items.length ? (
            <ol className="space-y-4">
              {items.map((brand, i) => (
                <BrandEditor
                  key={i}
                  brand={brand}
                  index={i}
                  count={items.length}
                  onChange={(next) => setItems(items.map((b, j) => (j === i ? next : b)))}
                  onMove={(to) => setItems(reorderList(items, i, to))}
                  onRemove={() => setRemoving(i)}
                />
              ))}
            </ol>
          ) : (
            <p className="text-sm text-prime-muted">No brands — the homepage brand section and the search brand filter are hidden.</p>
          )}
        </Card>
      )}
      <ConfirmDialog
        open={removing != null}
        title={`Remove ${items[removing]?.name ? `Prime ${items[removing].name}` : 'this brand'}?`}
        message="It disappears from the homepage and the search filter once you save. Properties tagged with it keep the tag until you change them in Properties."
        confirmText="Remove"
        danger
        onConfirm={() => {
          setItems(items.filter((_, j) => j !== removing));
          setRemoving(null);
        }}
        onClose={() => setRemoving(null)}
      />
      <SaveBar dirty={dirty} saving={saving} onSave={onSave} onDiscard={discard} />
    </div>
  );
}
