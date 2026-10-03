import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Images, Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../../api/client';
import { AdminPageHeader, ImageUploadField, reorderList } from '../../components/admin/AdminUi';
import { Badge, ConfirmDialog, Drawer, EmptyState, Field, Toggle, useToast } from '../../components/admin/kit';
import LivePreview from '../../components/admin/LivePreview';
import { cn } from '../../utils/cn';

const BLANK = { image: '', alt: '', enabled: true };

function SlideDrawer({ slide, onClose, onSave }) {
  const [form, setForm] = useState(slide || BLANK);
  const [busy, setBusy] = useState(false);
  useEffect(() => setForm(slide || BLANK), [slide]);
  const isNew = !slide?.id;

  async function submit() {
    setBusy(true);
    try {
      await onSave(form);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open={Boolean(slide)}
      onClose={onClose}
      title={isNew ? 'Add a slide' : 'Edit slide'}
      subtitle="Landscape photos work best — bright, sharp and without text on the image."
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="prime-btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="prime-btn" disabled={busy || !form.image} onClick={submit}>
            {busy ? 'Saving…' : isNew ? 'Add slide' : 'Save slide'}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="aspect-video overflow-hidden border border-prime-line bg-prime-mist">
          {form.image ? (
            <img src={form.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="grid h-full place-items-center text-sm text-prime-muted">Upload or paste a photo below</div>
          )}
        </div>
        <ImageUploadField label="Photo" value={form.image} folder="slideshow" ratio="16:9" size="1920×1080" onChange={(image) => setForm((f) => ({ ...f, image }))} />
        <Field label="Describe the photo" hint="Read by Google and screen readers, e.g. “Pool at Prime Residence New Cairo at sunset”.">
          <input className="prime-input" value={form.alt || ''} maxLength={160} onChange={(e) => setForm((f) => ({ ...f, alt: e.target.value }))} />
        </Field>
        <Toggle checked={form.enabled !== false} onChange={(enabled) => setForm((f) => ({ ...f, enabled }))} label="Show in the slideshow" hint="Turn off to keep the photo here without showing it." />
      </div>
    </Drawer>
  );
}

export default function AdminSlideshowPage() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const changed = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    api
      .adminGetSlideshow()
      .then((data) => setItems(data.items || []))
      .catch((err) => toast.error(err.message));
  }, [toast]);

  async function saveSlide(form) {
    try {
      if (form.id) {
        const data = await api.adminUpdateSlide(form.id, { image: form.image, alt: form.alt, enabled: form.enabled });
        setItems((prev) => prev.map((s) => (s.id === form.id ? data.item : s)));
        toast.success('Slide saved.');
      } else {
        const data = await api.adminCreateSlide({ image: form.image, alt: form.alt, enabled: form.enabled });
        setItems(data.items || []);
        toast.success('Slide added at the end.');
      }
      setEditing(null);
      changed();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function toggle(slide, enabled) {
    setItems((prev) => prev.map((s) => (s.id === slide.id ? { ...s, enabled } : s)));
    try {
      await api.adminUpdateSlide(slide.id, { enabled });
      changed();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function move(index, dir) {
    const next = reorderList(items, index, index + dir);
    setItems(next);
    try {
      await api.adminReorderSlideshow(next.map((s) => s.id));
      changed();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function doDelete() {
    try {
      const data = await api.adminDeleteSlide(confirmDelete.id);
      setItems(data.items || []);
      setConfirmDelete(null);
      toast.success('Slide deleted.');
      changed();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const shown = (items || []).filter((s) => s.enabled !== false).length;

  return (
    <div>
      <AdminPageHeader
        title="Hero slideshow"
        lede="The big photos at the top of the homepage. They rotate every few seconds in this order. Changes save straight away."
        actions={
          <button type="button" className="prime-btn" onClick={() => setEditing({ ...BLANK })}>
            <Plus size={14} /> Add slide
          </button>
        }
      />
      {!items ? (
        <p className="text-sm text-prime-muted">Loading…</p>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-prime-muted">
              <Badge tone={shown ? 'green' : 'red'}>{shown} showing</Badge>
              {items.length - shown ? <Badge>{items.length - shown} hidden</Badge> : null}
              <span>Tip: 3–5 photos is ideal. Use 1920×1080 landscape images.</span>
            </div>
            {items.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {items.map((slide, index) => {
                  const on = slide.enabled !== false;
                  return (
                    <div key={slide.id} className={cn('border bg-prime-surface', on ? 'border-prime-line' : 'border-dashed border-prime-line')}>
                      <button type="button" onClick={() => setEditing(slide)} className="group relative block aspect-video w-full overflow-hidden bg-prime-mist">
                        {slide.image ? (
                          <img src={slide.image} alt="" className={cn('h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]', !on && 'opacity-40 grayscale')} referrerPolicy="no-referrer" loading="lazy" />
                        ) : null}
                        <span className="absolute start-2 top-2 grid h-7 min-w-[28px] place-items-center bg-prime-night px-2 text-xs font-bold text-prime-sand">{index + 1}</span>
                        {!on ? (
                          <span className="absolute end-2 top-2">
                            <Badge>Hidden</Badge>
                          </span>
                        ) : null}
                        <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-xs text-white opacity-0 transition group-hover:opacity-100">
                          <Pencil size={12} /> Edit
                        </span>
                      </button>
                      <div className="space-y-3 p-3">
                        <p className={cn('truncate text-sm', slide.alt ? 'text-prime-ink' : 'italic text-amber-700')}>{slide.alt || 'No description yet — add one for Google'}</p>
                        <div className="flex items-center justify-between gap-2">
                          <Toggle checked={on} onChange={(v) => toggle(slide, v)} label={on ? 'Showing' : 'Hidden'} />
                          <div className="flex items-center gap-1">
                            <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="grid h-8 w-8 place-items-center border border-prime-line hover:border-prime-ink disabled:opacity-30" title="Show earlier" aria-label="Move earlier">
                              <ArrowLeft size={14} className="rtl:rotate-180" />
                            </button>
                            <button type="button" disabled={index === items.length - 1} onClick={() => move(index, 1)} className="grid h-8 w-8 place-items-center border border-prime-line hover:border-prime-ink disabled:opacity-30" title="Show later" aria-label="Move later">
                              <ArrowRight size={14} className="rtl:rotate-180" />
                            </button>
                            <button type="button" onClick={() => setEditing(slide)} className="grid h-8 w-8 place-items-center border border-prime-line hover:border-prime-ink" aria-label="Edit slide">
                              <Pencil size={14} />
                            </button>
                            <button type="button" onClick={() => setConfirmDelete(slide)} className="grid h-8 w-8 place-items-center border border-prime-line text-red-600 hover:border-red-600" aria-label="Delete slide">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Images}
                title="No slides yet"
                subtitle="The homepage shows built-in photos until you add your own."
                action={
                  <button type="button" className="prime-btn" onClick={() => setEditing({ ...BLANK })}>
                    <Plus size={14} /> Add the first slide
                  </button>
                }
              />
            )}
          </div>
          <div className="hidden min-w-0 xl:sticky xl:top-20 xl:block">
            <LivePreview path="/" reloadKey={reloadKey} height="420px" />
          </div>
        </div>
      )}
      <SlideDrawer slide={editing} onClose={() => setEditing(null)} onSave={saveSlide} />
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        danger
        title="Delete this slide?"
        message="The photo is removed from the homepage slideshow. To keep it for later, hide it instead."
        confirmText="Delete"
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
