import { useEffect, useState } from 'react';
import { ChevronDown, Copy, Lightbulb, Plus, Trash2 } from 'lucide-react';
import api from '../../api/client';
import { AdminPageHeader, ImageUploadField, MoveButtons, reorderList } from '../../components/admin/AdminUi';
import { Badge, BilingualField, Card, Field, SaveBar, Tabs, useToast } from '../../components/admin/kit';
import LivePreview from '../../components/admin/LivePreview';
import { cn } from '../../utils/cn';

const TABS = [
  ['faqs', 'FAQs'],
  ['trustPoints', 'Why Prime points'],
  ['partners', 'Partner logos'],
];

const BLANK = {
  faqs: { q: '', a: '', qAr: '', aAr: '' },
  trustPoints: { title: '', body: '', titleAr: '', bodyAr: '' },
  partners: { name: '', logo: '' },
};

const INFO = {
  faqs: {
    title: 'FAQ page',
    text: 'Questions and answers on the FAQ page. Arabic visitors see the Arabic version when both the question and answer are filled.',
    path: '/faq',
    add: 'Add question',
  },
  trustPoints: {
    title: 'Homepage · Why Prime',
    text: 'Short numbered reasons to book with Prime (up to 12). Three to six reads best.',
    path: '/',
    focus: 'home-trust',
    add: 'Add point',
  },
  partners: {
    title: 'Homepage · Partner logos',
    text: 'Logos of booking channels and partners. Transparent PNG or SVG, wide or square.',
    path: '/',
    focus: 'home-partners',
    add: 'Add logo',
  },
};

const SUGGESTED_FAQS = [
  {
    q: 'What time is check-in and check-out?',
    a: 'Check-in is from 3:00 PM and check-out is until 12:00 PM. Early check-in or late check-out can be arranged when available — just message us.',
    qAr: 'ما هي مواعيد تسجيل الوصول والمغادرة؟',
    aAr: 'تسجيل الوصول من الساعة 3:00 مساءً والمغادرة حتى 12:00 ظهرًا. يمكن ترتيب وصول مبكر أو مغادرة متأخرة حسب التوفر — فقط راسلنا.',
  },
  {
    q: 'What do I need to bring at check-in?',
    a: 'A valid national ID or passport for every adult guest, as required by Egyptian regulations.',
    qAr: 'ما المستندات المطلوبة عند الوصول؟',
    aAr: 'بطاقة رقم قومي سارية أو جواز سفر لكل نزيل بالغ، وفقًا للوائح المصرية.',
  },
  {
    q: 'Can I cancel or change my booking?',
    a: 'Yes. The cancellation terms are shown before you pay and in your confirmation email. See our Refund Policy for the details.',
    qAr: 'هل يمكنني إلغاء الحجز أو تعديله؟',
    aAr: 'نعم. تظهر شروط الإلغاء قبل الدفع وفي رسالة التأكيد. راجع سياسة الاسترداد لمعرفة التفاصيل.',
  },
  {
    q: 'How do I pay?',
    a: 'Pay securely online by card when you book. Your confirmation and voucher arrive by email straight away.',
    qAr: 'كيف أدفع؟',
    aAr: 'ادفع بأمان أونلاين بالبطاقة عند الحجز، وتصلك رسالة التأكيد والقسيمة على بريدك فورًا.',
  },
  {
    q: 'Is there Wi-Fi and parking?',
    a: 'Every unit has free high-speed Wi-Fi. Parking is available at most properties — check the unit page for details.',
    qAr: 'هل يتوفر واي فاي وموقف سيارات؟',
    aAr: 'كل الوحدات بها واي فاي سريع مجاني. يتوفر موقف سيارات في معظم العقارات — راجع صفحة الوحدة للتفاصيل.',
  },
  {
    q: 'Is cleaning included?',
    a: 'Every stay starts in a professionally cleaned unit with fresh linen and towels. Extra cleaning during longer stays can be arranged.',
    qAr: 'هل التنظيف مشمول؟',
    aAr: 'تبدأ كل إقامة في وحدة نظيفة باحترافية مع مفارش ومناشف جديدة. يمكن ترتيب تنظيف إضافي في الإقامات الطويلة.',
  },
  {
    q: 'Are pets allowed?',
    a: 'Pets are not allowed unless the unit page says otherwise.',
    qAr: 'هل يُسمح بالحيوانات الأليفة؟',
    aAr: 'لا يُسمح بالحيوانات الأليفة ما لم تذكر صفحة الوحدة خلاف ذلك.',
  },
  {
    q: 'Can I book for a month or longer?',
    a: 'Yes — we offer monthly stays at special rates. Message us on WhatsApp for a quote.',
    qAr: 'هل يمكنني الحجز لمدة شهر أو أكثر؟',
    aAr: 'نعم — نوفر إقامات شهرية بأسعار خاصة. راسلنا على واتساب لعرض سعر.',
  },
];

function summaryOf(kind, item) {
  if (kind === 'faqs') return item.q || item.qAr;
  if (kind === 'trustPoints') return item.title || item.titleAr;
  return item.name;
}

function warningsOf(kind, item) {
  if (kind === 'faqs') {
    if (!item.q || !item.a) return ['English missing'];
    if (!item.qAr || !item.aAr) return ['Arabic missing'];
  }
  if (kind === 'trustPoints') {
    if (!item.title) return ['Title missing'];
    if (!item.titleAr) return ['Arabic missing'];
  }
  if (kind === 'partners' && !item.logo) return ['No logo'];
  return [];
}

function ItemEditor({ kind, item, onChange }) {
  if (kind === 'faqs') {
    return (
      <div className="space-y-3">
        <BilingualField label="Question" value={{ en: item.q, ar: item.qAr }} onChange={(v) => onChange({ ...item, q: v.en, qAr: v.ar })} />
        <BilingualField label="Answer" multiline rows={4} value={{ en: item.a, ar: item.aAr }} onChange={(v) => onChange({ ...item, a: v.en, aAr: v.ar })} />
      </div>
    );
  }
  if (kind === 'trustPoints') {
    return (
      <div className="space-y-3">
        <BilingualField label="Title" value={{ en: item.title, ar: item.titleAr }} onChange={(v) => onChange({ ...item, title: v.en, titleAr: v.ar })} />
        <BilingualField label="Text" multiline rows={2} value={{ en: item.body, ar: item.bodyAr }} onChange={(v) => onChange({ ...item, body: v.en, bodyAr: v.ar })} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Field label="Partner name">
        <input className="prime-input" value={item.name || ''} placeholder="e.g. Booking.com" onChange={(e) => onChange({ ...item, name: e.target.value })} />
      </Field>
      <ImageUploadField label="Logo" value={item.logo || ''} folder="partners" onChange={(logo) => onChange({ ...item, logo })} />
    </div>
  );
}

function Suggestions({ items, onAdd }) {
  const existing = new Set(items.map((f) => (f.q || '').trim().toLowerCase()));
  const left = SUGGESTED_FAQS.filter((f) => !existing.has(f.q.toLowerCase()));
  if (!left.length) return null;
  return (
    <div className="mt-5 border border-dashed border-prime-gold/60 bg-prime-gold/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-prime-ink">
        <Lightbulb size={15} className="text-prime-gold-deep" /> Questions guests often ask
      </p>
      <p className="mt-0.5 text-xs text-prime-muted">Add with one click (English and Arabic included), then adjust the answer to your rules.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {left.map((f) => (
          <button key={f.q} type="button" onClick={() => onAdd(f)} className="inline-flex items-center gap-1 border border-prime-line bg-prime-surface px-2.5 py-1.5 text-xs hover:border-prime-ink">
            <Plus size={12} /> {f.q}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AdminContentListsPage() {
  const toast = useToast();
  const [tab, setTab] = useState('faqs');
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(() => new Set());
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api
      .adminGetContent()
      .then((res) => {
        setSaved(res.content);
        setDraft(structuredClone(res.content));
      })
      .catch((err) => setError(err.message));
  }, []);

  const dirty = saved != null && JSON.stringify(saved) !== JSON.stringify(draft);
  const items = draft?.[tab] || [];
  const setItems = (next) => setDraft((d) => ({ ...d, [tab]: next }));
  const info = INFO[tab];
  const key = (i) => `${tab}:${i}`;

  function toggle(i) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key(i))) next.delete(key(i));
      else next.add(key(i));
      return next;
    });
  }

  function add(item = BLANK[tab]) {
    setItems([...items, { ...item }]);
    setOpen((prev) => new Set(prev).add(key(items.length)));
  }

  function remove(i) {
    setItems(items.filter((_, j) => j !== i));
    setOpen(new Set());
  }

  function move(i, to) {
    setItems(reorderList(items, i, to));
    setOpen(new Set());
  }

  async function onSave() {
    setSaving(true);
    setError('');
    try {
      const res = await api.adminSaveContent(draft);
      setSaved(res.content);
      setDraft(structuredClone(res.content));
      setOpen(new Set());
      setReloadKey((k) => k + 1);
      toast.success('Saved and live. Empty items were removed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const allOpen = items.length > 0 && items.every((_, i) => open.has(key(i)));

  return (
    <div>
      <AdminPageHeader title="FAQs & lists" lede="Short lists that appear on guest pages — FAQ questions, the homepage “Why Prime” points and partner logos. Click an item to edit it." />
      {error ? <p className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <Tabs tabs={TABS.map(([id, label]) => [id, `${label}${draft ? ` (${(draft[id] || []).length})` : ''}`])} value={tab} onChange={setTab} />
      {!draft ? (
        <p className="text-sm text-prime-muted">Loading…</p>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card
            className="min-w-0"
            title={info.title}
            description={info.text}
            actions={
              <div className="flex items-center gap-3">
                {items.length ? (
                  <button type="button" className="prime-link text-xs" onClick={() => setOpen(allOpen ? new Set() : new Set(items.map((_, i) => key(i))))}>
                    {allOpen ? 'Collapse all' : 'Expand all'}
                  </button>
                ) : null}
                <button type="button" className="prime-btn-outline" onClick={() => add()}>
                  <Plus size={14} /> {info.add}
                </button>
              </div>
            }
          >
            {items.length ? (
              <ol className="divide-y divide-prime-line border border-prime-line">
                {items.map((item, i) => {
                  const expanded = open.has(key(i));
                  const summary = summaryOf(tab, item);
                  const warnings = warningsOf(tab, item);
                  return (
                    <li key={i} className={cn('bg-prime-surface', expanded && 'bg-prime-sand/40')}>
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <span className="w-6 shrink-0 text-[11px] font-semibold tabular-nums text-prime-muted">{String(i + 1).padStart(2, '0')}</span>
                        {tab === 'partners' ? (
                          <span className="grid h-9 w-14 shrink-0 place-items-center border border-prime-line bg-white">
                            {item.logo ? <img src={item.logo} alt="" className="max-h-6 max-w-[48px] object-contain" /> : null}
                          </span>
                        ) : null}
                        <button type="button" onClick={() => toggle(i)} className="min-w-0 flex-1 text-start">
                          <span className={cn('block truncate text-sm', summary ? 'font-medium text-prime-ink' : 'italic text-prime-muted')}>{summary || 'New item — click to fill in'}</span>
                        </button>
                        {warnings.map((w) => (
                          <Badge key={w} tone={w === 'Arabic missing' ? 'gold' : 'red'}>
                            {w}
                          </Badge>
                        ))}
                        <MoveButtons disableUp={i === 0} disableDown={i === items.length - 1} onUp={() => move(i, i - 1)} onDown={() => move(i, i + 1)} />
                        <button type="button" onClick={() => add(item)} className="grid h-8 w-8 place-items-center text-prime-muted hover:text-prime-ink" title="Duplicate" aria-label="Duplicate">
                          <Copy size={14} />
                        </button>
                        <button type="button" onClick={() => remove(i)} className="grid h-8 w-8 place-items-center text-red-600" title="Remove" aria-label="Remove">
                          <Trash2 size={14} />
                        </button>
                        <button type="button" onClick={() => toggle(i)} className="grid h-8 w-8 place-items-center text-prime-muted" aria-label={expanded ? 'Collapse' : 'Edit'}>
                          <ChevronDown size={16} className={cn('transition', expanded && 'rotate-180')} />
                        </button>
                      </div>
                      {expanded ? (
                        <div className="border-t border-prime-line px-4 py-4">
                          <ItemEditor kind={tab} item={item} onChange={(next) => setItems(items.map((x, j) => (j === i ? next : x)))} />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="border border-dashed border-prime-line px-4 py-8 text-center text-sm text-prime-muted">Nothing here yet — press “{info.add}”.</p>
            )}
            {tab === 'faqs' ? <Suggestions items={items} onAdd={add} /> : null}
          </Card>
          <div className="hidden min-w-0 xl:sticky xl:top-20 xl:block">
            <LivePreview path={info.path} reloadKey={reloadKey} focus={info.focus ? { id: info.focus, at: reloadKey } : null} />
            <p className="mt-2 text-xs text-prime-muted">The preview shows the saved version — press Save to see list changes here.</p>
          </div>
        </div>
      )}
      <SaveBar dirty={dirty} saving={saving} onSave={onSave} onDiscard={() => setDraft(structuredClone(saved))} />
    </div>
  );
}
