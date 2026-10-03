import { useMemo, useState } from 'react';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import api from '../../api/client';
import { AdminPageHeader, ImageUploadField, MoveButtons, reorderList } from '../../components/admin/AdminUi';
import { Card, Field, SaveBar, SearchInput, Tabs, Toggle, labelCls, useSiteSection, useToast } from '../../components/admin/kit';
import CopyFields, { isOverridden, keyLabel } from '../../components/admin/CopyFields';
import LivePreview from '../../components/admin/LivePreview';
import { defaultCopy } from '../../context/LocaleContext';
import { useSite } from '../../context/SiteContext';
import { cn } from '../../utils/cn';

const GROUPS = [
  ['home', 'Homepage', '/'],
  ['nav', 'Header & menu', '/'],
  ['footer', 'Footer', '/'],
  ['about', 'About', '/about'],
  ['contact', 'Contact', '/contact'],
  ['faq', 'FAQ', '/faq'],
  ['owners', 'List your property', '/owners'],
  ['careers', 'Careers', '/careers'],
  ['legal', 'Legal pages', '/terms'],
  ['listing', 'Unit page', '/search'],
  ['bm', 'Booking popup', '/search'],
  ['booking', 'Checkout', '/search'],
  ['bs', 'Booking confirmation', '/'],
  ['common', 'Shared labels', '/'],
];

const ALL_KEYS = Object.keys(defaultCopy.en);

function WithPreview({ path, site, children }) {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0">{children}</div>
      <div className="hidden min-w-0 xl:sticky xl:top-20 xl:block">
        <LivePreview path={path} site={site} />
      </div>
    </div>
  );
}

function TextEditor({ copy, onChange, previewSite }) {
  const [group, setGroup] = useState('home');
  const [query, setQuery] = useState('');
  const [editedOnly, setEditedOnly] = useState(false);

  const groups = useMemo(() => {
    const known = new Set(GROUPS.map(([id]) => id));
    const extra = [...new Set(ALL_KEYS.map((k) => k.split('.')[0]))].filter((p) => !known.has(p)).map((p) => [p, p, '/']);
    return [...GROUPS, ...extra].map(([id, label, path]) => {
      const keys = ALL_KEYS.filter((k) => k.startsWith(`${id}.`));
      return { id, label, path, keys, edited: keys.filter((k) => isOverridden(copy, k)).length };
    });
  }, [copy]);

  const q = query.trim().toLowerCase();
  const keys = useMemo(() => {
    const pool = q ? ALL_KEYS : groups.find((g) => g.id === group)?.keys || [];
    return pool.filter((k) => {
      if (editedOnly && !isOverridden(copy, k)) return false;
      if (!q) return true;
      return [k, defaultCopy.en[k], defaultCopy.ar[k], copy?.en?.[k], copy?.ar?.[k]].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [q, group, groups, editedOnly, copy]);

  const current = groups.find((g) => g.id === group);
  const groupLabel = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g.label])), [groups]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <SearchInput value={query} onChange={setQuery} placeholder="Find any text on the website, e.g. “check-in”…" className="min-w-[240px] flex-1" />
        <Toggle checked={editedOnly} onChange={setEditedOnly} label="Only what I changed" />
      </div>
      <p className={cn(labelCls, 'mb-2')}>Where on the website?</p>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => {
              setGroup(g.id);
              setQuery('');
            }}
            className={cn(
              'inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold transition',
              group === g.id && !q ? 'border-prime-night bg-prime-night text-prime-sand' : 'border-prime-line bg-prime-surface text-prime-ink hover:border-prime-ink'
            )}
          >
            {g.label}
            {g.edited ? <span className="rounded-full bg-prime-gold px-1.5 text-[10px] text-prime-night">{g.edited}</span> : null}
          </button>
        ))}
      </div>
      <WithPreview path={q ? '/' : current?.path || '/'} site={previewSite}>
        <Card
          title={q ? `Results for “${query.trim()}”` : current?.label}
          description="Type in English and/or Arabic — the preview updates as you type. Empty boxes keep the built-in wording shown in grey. Keep words in {braces}: they are filled in automatically."
          actions={
            !q && current ? (
              <a href={current.path} target="_blank" rel="noreferrer" className="prime-link inline-flex items-center gap-1 text-xs">
                Open page <ExternalLink size={12} />
              </a>
            ) : null
          }
        >
          {keys.length ? (
            <CopyFields keys={keys.slice(0, 200)} copy={copy} onChange={onChange} labels={q ? Object.fromEntries(keys.map((k) => [k, `${groupLabel[k.split('.')[0]] || k.split('.')[0]} · ${keyLabel(k)}`])) : {}} />
          ) : (
            <p className="text-sm text-prime-muted">{editedOnly ? 'Nothing changed here yet.' : 'Nothing matches.'}</p>
          )}
          {keys.length > 200 ? <p className="mt-4 text-xs text-prime-muted">Showing the first 200 — refine the search.</p> : null}
        </Card>
      </WithPreview>
    </div>
  );
}

function PageImages({ title, description, fields, value, onChange, link }) {
  return (
    <Card
      title={title}
      description={description}
      actions={
        link ? (
          <a href={link} target="_blank" rel="noreferrer" className="prime-link inline-flex items-center gap-1 text-xs">
            Open page <ExternalLink size={12} />
          </a>
        ) : null
      }
    >
      <div className="space-y-5">
        {fields.map(([key, label, ratio]) => (
          <ImageUploadField
            key={key}
            label={label}
            value={value?.[key] || ''}
            folder="site"
            ratio={ratio}
            onChange={(url) => onChange({ ...value, [key]: url })}
          />
        ))}
        <p className="text-xs text-prime-muted">Empty = the built-in photo. Page text is edited under “Words on the site”.</p>
      </div>
    </Card>
  );
}

function CareersEditor({ value, onChange }) {
  const roles = value?.roles || [];
  const setRoles = (next) => onChange({ ...value, roles: next });
  return (
    <div className="space-y-6">
      <PageImages
        title="Careers page photo"
        fields={[['heroImage', 'Hero photo', '16:9 or wider']]}
        value={value}
        onChange={(v) => onChange({ ...value, ...v })}
        link="/careers"
      />
      <Card
        title="Open roles"
        description="Each role links guests to the contact page."
        actions={
          <button type="button" className="prime-btn-outline" onClick={() => setRoles([...roles, { title: '', location: '', type: 'Full-time' }])}>
            <Plus size={14} /> Add role
          </button>
        }
      >
        <datalist id="role-types">
          {['Full-time', 'Part-time', 'Contract', 'Seasonal', 'Internship'].map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        {roles.length ? (
          <ol className="space-y-3">
            {roles.map((r, i) => (
              <li key={i} className="border border-prime-line p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-prime-muted">Role {i + 1}</span>
                  <div className="flex items-center gap-2">
                    <MoveButtons
                      disableUp={i === 0}
                      disableDown={i === roles.length - 1}
                      onUp={() => setRoles(reorderList(roles, i, i - 1))}
                      onDown={() => setRoles(reorderList(roles, i, i + 1))}
                    />
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center text-red-600"
                      aria-label="Remove role"
                      onClick={() => setRoles(roles.filter((_, j) => j !== i))}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['title', 'Job title', 'sm:col-span-2'],
                    ['location', 'Location', ''],
                    ['type', 'Type', ''],
                  ].map(([k, label, span]) => (
                    <Field key={k} label={label} className={span}>
                      <input
                        className="prime-input"
                        value={r[k] || ''}
                        list={k === 'type' ? 'role-types' : undefined}
                        onChange={(e) => setRoles(roles.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                      />
                    </Field>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-prime-muted">No open roles — the page will say so.</p>
        )}
      </Card>
    </div>
  );
}

const LEGAL = [
  ['terms', 'Terms & Conditions', '/terms'],
  ['privacy', 'Privacy Policy', '/privacy'],
  ['refund', 'Refund Policy', '/refund-policy'],
];

function LegalEditor({ value, onChange, previewSite }) {
  const [which, setWhich] = useState('terms');
  const page = value?.[which] || {};
  const set = (patch) => onChange({ ...value, [which]: { ...page, ...patch } });
  const current = LEGAL.find(([id]) => id === which);
  return (
    <WithPreview path={current[2]} site={previewSite}>
      <Card
        title={current[1]}
        description="Plain text. Leave a blank line between paragraphs, start a line with “## ” for a heading and “- ” for a bullet."
        actions={
          <div className="flex flex-wrap gap-1.5">
            {LEGAL.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setWhich(id)}
                className={cn(
                  'border px-3 py-1.5 text-[11px] font-semibold',
                  which === id ? 'border-prime-night bg-prime-night text-prime-sand' : 'border-prime-line'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Last updated" className="w-48">
              <input type="date" className="prime-input" value={page.updatedAt || ''} onChange={(e) => set({ updatedAt: e.target.value })} />
            </Field>
            <a href={current[2]} target="_blank" rel="noreferrer" className="prime-link inline-flex items-center gap-1 pb-3 text-xs">
              Open page <ExternalLink size={12} />
            </a>
          </div>
          {[
            ['en', 'English', 'ltr', '## Bookings\n\nAll reservations…'],
            ['ar', 'Arabic', 'rtl', '## الحجوزات\n\nجميع الحجوزات…'],
          ].map(([locale, label, dir, placeholder]) => (
            <Field key={locale} label={`Policy text — ${label}`}>
              <textarea dir={dir} rows={14} className="prime-input min-h-[200px]" value={page[locale] || ''} placeholder={placeholder} onChange={(e) => set({ [locale]: e.target.value })} />
            </Field>
          ))}
        </div>
      </Card>
    </WithPreview>
  );
}

const TABS = [
  ['text', 'Words on the site'],
  ['about', 'About photos'],
  ['owners', 'Owners page photos'],
  ['careers', 'Careers & jobs'],
  ['legal', 'Legal pages'],
];

export default function AdminPagesPage() {
  const toast = useToast();
  const { replace } = useSite();
  const { draft, setDraft, dirty, saving, error, save, discard, loaded } = useSiteSection(api, ['copy', 'pages'], replace);
  const [tab, setTab] = useState('text');

  const setPages = (key, value) => setDraft((d) => ({ ...d, pages: { ...d.pages, [key]: value } }));

  async function onSave() {
    if (await save()) toast.success('Pages saved — live on the website.');
  }

  return (
    <div>
      <AdminPageHeader
        title="Pages & text"
        lede="Change any word or photo guests see, in English and Arabic. The preview on the right updates as you type; press Save to publish."
      />
      {error ? <p className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {!loaded ? (
        <p className="text-sm text-prime-muted">Loading…</p>
      ) : (
        <>
          {tab === 'text' && <TextEditor copy={draft.copy} onChange={(copy) => setDraft((d) => ({ ...d, copy }))} previewSite={draft} />}
          {tab === 'about' && (
            <WithPreview path="/about" site={draft}>
              <PageImages
                title="About page photos"
                link="/about"
                fields={[
                  ['heroImage', 'Hero photo', '16:9 or wider'],
                  ['wideImage', 'Wide photo', '21:9'],
                  ['portraitImage', 'Portrait photo', '4:5'],
                ]}
                value={draft.pages.about}
                onChange={(v) => setPages('about', v)}
              />
            </WithPreview>
          )}
          {tab === 'owners' && (
            <WithPreview path="/owners" site={draft}>
              <PageImages
                title="List-your-property page photos"
                link="/owners"
                fields={[
                  ['heroImage', 'Hero photo', '16:9 or wider'],
                  ['sideImage', 'Inquiry form photo', '4:5'],
                ]}
                value={draft.pages.owners}
                onChange={(v) => setPages('owners', v)}
              />
            </WithPreview>
          )}
          {tab === 'careers' && (
            <WithPreview path="/careers" site={draft}>
              <CareersEditor value={draft.pages.careers} onChange={(v) => setPages('careers', v)} />
            </WithPreview>
          )}
          {tab === 'legal' && <LegalEditor value={draft.pages.legal} onChange={(v) => setPages('legal', v)} previewSite={draft} />}
        </>
      )}
      <p className={cn(labelCls, 'mt-6 normal-case tracking-normal')}>
        Rates, availability and reservations are managed in Kwentra — this page only changes website content.
      </p>
      <SaveBar dirty={dirty} saving={saving} onSave={onSave} onDiscard={discard} />
    </div>
  );
}
