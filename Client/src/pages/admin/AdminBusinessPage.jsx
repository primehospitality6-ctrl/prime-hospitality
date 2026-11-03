import { Plus, Trash2 } from 'lucide-react';
import api from '../../api/client';
import { AdminPageHeader, MoveButtons, reorderList } from '../../components/admin/AdminUi';
import { Card, Field, SaveBar, useSiteSection, useToast } from '../../components/admin/kit';
import { useSite } from '../../context/SiteContext';
import { brand, phoneLines, whatsappLines } from '../../theme/brand';

const CONTACT = [
  ['name', 'Business name', 'Prime Hospitality'],
  ['tagline', 'Tagline', 'Prime stays for Prime customers.'],
  ['email', 'Guest email', 'hello@primehospitality.com'],
  ['address', 'Office address', 'New Cairo, Egypt'],
];

const SOCIAL = [
  ['instagram', 'Instagram', 'https://instagram.com/…'],
  ['facebook', 'Facebook', 'https://facebook.com/…'],
  ['tiktok', 'TikTok', 'https://tiktok.com/@…'],
  ['linkedin', 'LinkedIn', 'https://linkedin.com/company/…'],
];

/**
 * Editable list of contact numbers. The first number is the main one (used by single links
 * such as "WhatsApp us" in the footer); every number shows on the contact page.
 */
function NumbersCard({ title, description, addLabel, emptyText, items, withDisplay, onChange }) {
  const update = (i, patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const blank = withDisplay ? { number: '', display: '', label: { en: '', ar: '' } } : { number: '', label: { en: '', ar: '' } };
  return (
    <Card
      title={title}
      description={description}
      actions={
        <button type="button" className="prime-btn-outline" onClick={() => onChange([...items, blank])}>
          <Plus size={14} /> {addLabel}
        </button>
      }
    >
      {items.length ? (
        <ol className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="border border-prime-line p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-prime-muted">
                  {i === 0 ? 'Main number' : `Number ${i + 1}`}
                </span>
                <div className="flex items-center gap-2">
                  <MoveButtons
                    disableUp={i === 0}
                    disableDown={i === items.length - 1}
                    onUp={() => onChange(reorderList(items, i, i - 1))}
                    onDown={() => onChange(reorderList(items, i, i + 1))}
                  />
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center text-red-600"
                    aria-label="Remove number"
                    onClick={() => onChange(items.filter((_, j) => j !== i))}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Number (international)" hint={withDisplay ? undefined : 'With country code, e.g. +20 100 000 0000'}>
                  <input
                    dir="ltr"
                    inputMode="tel"
                    className="prime-input"
                    value={item.number || ''}
                    placeholder="+201000000000"
                    onChange={(e) => update(i, { number: e.target.value })}
                  />
                </Field>
                {withDisplay ? (
                  <Field label="As shown on the site">
                    <input
                      dir="ltr"
                      className="prime-input"
                      value={item.display || ''}
                      placeholder="0100 000 0000"
                      onChange={(e) => update(i, { display: e.target.value })}
                    />
                  </Field>
                ) : null}
                <Field label="Label (English)" hint="Optional, e.g. Reservations">
                  <input
                    className="prime-input"
                    value={item.label?.en || ''}
                    onChange={(e) => update(i, { label: { ...item.label, en: e.target.value } })}
                  />
                </Field>
                <Field label="Label (Arabic)">
                  <input
                    dir="rtl"
                    className="prime-input"
                    value={item.label?.ar || ''}
                    onChange={(e) => update(i, { label: { ...item.label, ar: e.target.value } })}
                  />
                </Field>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-prime-muted">{emptyText}</p>
      )}
    </Card>
  );
}

function RulesCard({ title, description, emptyText, rules, onChange }) {
  const update = (i, key, value) => onChange(rules.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  return (
    <Card
      title={title}
      description={description}
      actions={
        <button type="button" className="prime-btn-outline" onClick={() => onChange([...rules, { en: '', ar: '' }])}>
          <Plus size={14} /> Add rule
        </button>
      }
    >
      {rules.length ? (
        <ol className="space-y-3">
          {rules.map((rule, i) => (
            <li key={i} className="border border-prime-line p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-prime-muted">Rule {i + 1}</span>
                <div className="flex items-center gap-2">
                  <MoveButtons
                    disableUp={i === 0}
                    disableDown={i === rules.length - 1}
                    onUp={() => onChange(reorderList(rules, i, i - 1))}
                    onDown={() => onChange(reorderList(rules, i, i + 1))}
                  />
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center text-red-600"
                    aria-label="Remove rule"
                    onClick={() => onChange(rules.filter((_, j) => j !== i))}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="English">
                  <textarea
                    rows={2}
                    className="prime-input"
                    value={rule.en || ''}
                    onChange={(e) => update(i, 'en', e.target.value)}
                  />
                </Field>
                <Field label="Arabic">
                  <textarea
                    rows={2}
                    dir="rtl"
                    className="prime-input"
                    value={rule.ar || ''}
                    onChange={(e) => update(i, 'ar', e.target.value)}
                  />
                </Field>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-prime-muted">{emptyText}</p>
      )}
    </Card>
  );
}

export default function AdminBusinessPage() {
  const toast = useToast();
  const { replace } = useSite();
  const { draft, setDraft, dirty, saving, error, save, discard, loaded } = useSiteSection(api, 'business', replace);

  function set(key, value) {
    setDraft((d) => ({ ...d, business: { ...d.business, [key]: value } }));
  }

  async function onSave() {
    if (await save()) toast.success('Business info saved — live on the website.');
  }

  return (
    <div>
      <AdminPageHeader
        title="Business info"
        lede="Contact details, social links, house rules and guest regulations used across the website. Leave a contact field empty to keep the built-in value."
      />
      {error ? <p className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {!loaded ? (
        <p className="text-sm text-prime-muted">Loading…</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Card title="Contact" description="Shown to guests on every page.">
              <div className="grid gap-4 sm:grid-cols-2">
                {CONTACT.map(([key, label, placeholder]) => (
                  <Field key={key} label={label} className={key === 'address' || key === 'tagline' ? 'sm:col-span-2' : ''}>
                    <input
                      className="prime-input"
                      value={draft.business[key] || ''}
                      placeholder={placeholder}
                      onChange={(e) => set(key, e.target.value)}
                    />
                  </Field>
                ))}
              </div>
            </Card>
            <NumbersCard
              title="WhatsApp numbers"
              description="With more than one number, the floating WhatsApp button lets guests pick who to message. The first number is used by the other WhatsApp links."
              addLabel="Add WhatsApp"
              emptyText="No WhatsApp numbers — the site uses the built-in number."
              items={draft.business.whatsapps || []}
              onChange={(next) => set('whatsapps', next)}
            />
            <NumbersCard
              withDisplay
              title="Phone numbers"
              description="All numbers show in the footer and on the contact page."
              addLabel="Add phone"
              emptyText="No phone numbers — the site uses the built-in number."
              items={draft.business.phones || []}
              onChange={(next) => set('phones', next)}
            />
            <Card title="Social links" description="Icons appear in the footer only for links you fill in.">
              <div className="grid gap-4 sm:grid-cols-2">
                {SOCIAL.map(([key, label, placeholder]) => (
                  <Field key={key} label={label}>
                    <input
                      type="url"
                      className="prime-input"
                      value={draft.business[key] || ''}
                      placeholder={placeholder}
                      onChange={(e) => set(key, e.target.value)}
                    />
                  </Field>
                ))}
              </div>
            </Card>
            <RulesCard
              title="House rules"
              description="Shown on every stay page. Write {guests} to insert the unit's maximum number of guests."
              emptyText="No house rules — the section is hidden on stay pages."
              rules={draft.business.houseRules || []}
              onChange={(next) => set('houseRules', next)}
            />
            <RulesCard
              title="Guest regulations"
              description="Shown under the house rules on every stay page."
              emptyText="No guest regulations — the section is hidden on stay pages."
              rules={draft.business.guestRegulations || []}
              onChange={(next) => set('guestRegulations', next)}
            />
          </div>
          <Card title="Live on the site" className="h-fit">
            <dl className="space-y-3 text-sm">
              {[
                ['Name', brand.name],
                ['Email', brand.email],
                ['WhatsApp', whatsappLines().map((l) => l.number).join(' · ')],
                ['Phone', phoneLines().map((l) => l.display).join(' · ')],
                ['Address', brand.address],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-prime-muted">{k}</dt>
                  <dd className="mt-0.5 break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      )}
      <SaveBar dirty={dirty} saving={saving} onSave={onSave} onDiscard={discard} />
    </div>
  );
}
