import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import api from '../../../api/client';
import { AdminPageHeader, ImageUploadField } from '../../../components/admin/AdminUi';
import { Badge, Card, Drawer, Field, SaveBar, StatusChips, useSiteSection, useToast } from '../../../components/admin/kit';
import { SEO_DEFAULT_TITLES } from '../../../components/SeoManager';
import { useSite } from '../../../context/SiteContext';
import { brand } from '../../../theme/brand';
import { cn } from '../../../utils/cn';
import {
  AnnotatedSection,
  CheckList,
  DESCRIPTION_RANGE,
  GooglePreview,
  LengthMeter,
  PAGE_PATHS,
  SEO_PAGE_KEYS,
  ScoreRing,
  SegmentedControl,
  SocialPreview,
  TITLE_RANGE,
  effectiveDescription,
  effectiveTitle,
  scoreLabel,
  scoreOf,
  scoreTone,
  seoChecks,
  siteOrigin,
  siteSeoScore,
} from './shared';
import MarketingNav from './MarketingNav';

const DOT = { green: 'bg-emerald-500', gold: 'bg-amber-400', red: 'bg-red-500' };

function PageEditor({ seo, pageKey, onChange, onClose }) {
  const [device, setDevice] = useState('desktop');
  const page = seo.pages?.[pageKey] || {};
  const checks = seoChecks(seo, pageKey);
  const score = scoreOf(checks);
  const url = `${siteOrigin()}${PAGE_PATHS[pageKey]}`;
  const title = effectiveTitle(seo, pageKey);
  const description = effectiveDescription(seo, pageKey);

  return (
    <Drawer open onClose={onClose} wide title={SEO_DEFAULT_TITLES[pageKey]} subtitle={PAGE_PATHS[pageKey]} footer={<div className="flex justify-end"><button type="button" className="prime-btn" onClick={onClose}>Done</button></div>}>
      <div className="space-y-6">
        <div className="flex items-center gap-4 border border-prime-line bg-prime-surface p-4">
          <ScoreRing score={score} size={58} />
          <div>
            <p className="font-display text-lg font-bold">{scoreLabel(score)}</p>
            <p className="text-xs text-prime-muted">Fix the orange and red points below to raise the score. Changes are saved with the Save bar.</p>
          </div>
        </div>

        <div className="space-y-4 border border-prime-line bg-prime-surface p-4">
          <Field label="SEO title" hint={`Shown as the blue link in Google. “ · ${seo.titleSuffix || brand.name}” is added automatically.`}>
            <input className="prime-input" value={page.title || ''} placeholder={SEO_DEFAULT_TITLES[pageKey]} onChange={(e) => onChange({ title: e.target.value })} />
            <LengthMeter value={title} range={TITLE_RANGE} />
          </Field>
          <Field label="Meta description" hint="The grey text under the link in Google. Say what guests get and why to click.">
            <textarea className="prime-input min-h-[88px]" value={page.description || ''} placeholder={seo.defaultDescription || ''} onChange={(e) => onChange({ description: e.target.value })} />
            <LengthMeter value={description} range={DESCRIPTION_RANGE} />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted">Google preview</p>
            <SegmentedControl size="sm" value={device} onChange={setDevice} options={[['desktop', 'Desktop'], ['mobile', 'Mobile']]} />
          </div>
          <GooglePreview url={url} title={title} description={description} mobile={device === 'mobile'} />
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted">WhatsApp / Facebook preview</p>
          <SocialPreview url={url} title={title} description={description} image={seo.ogImage} />
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted">Checklist</p>
          <CheckList checks={checks} />
        </div>
      </div>
    </Drawer>
  );
}

export default function MarketingSeoPage() {
  const toast = useToast();
  const { replace } = useSite();
  const site = useSiteSection(api, ['seo'], replace);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('all');

  const seo = site.draft?.seo;
  const set = (patch) => site.setDraft((d) => ({ ...d, seo: { ...d.seo, ...patch } }));
  const setPage = (key, patch) => site.setDraft((d) => ({ ...d, seo: { ...d.seo, pages: { ...d.seo.pages, [key]: { ...(d.seo.pages?.[key] || {}), ...patch } } } }));

  const rows = useMemo(
    () =>
      seo
        ? SEO_PAGE_KEYS.map((key) => {
            const checks = seoChecks(seo, key);
            const score = scoreOf(checks);
            return { key, score, tone: scoreTone(score), issues: checks.filter((c) => c.level !== 'good').length };
          })
        : [],
    [seo]
  );
  const summary = seo ? siteSeoScore(seo) : null;
  const visible = rows.filter((r) => filter === 'all' || (filter === 'work' ? r.tone !== 'green' : r.tone === 'green'));

  async function onSave() {
    if (await site.save()) toast.success('SEO settings saved.');
  }

  return (
    <div>
      <MarketingNav />
      <AdminPageHeader title="SEO & sharing" lede="Control how the website looks in Google results and when links are shared on WhatsApp, Facebook and Instagram. Unit pages use each unit’s own title, description and first photo automatically." />
      {site.error ? <p className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{site.error}</p> : null}
      {!seo ? (
        <p className="text-sm text-prime-muted">Loading…</p>
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center border border-prime-line bg-prime-surface p-5">
            <ScoreRing score={summary.score} size={84} />
            <div>
              <p className="font-display text-xl font-bold">SEO score: {scoreLabel(summary.score)}</p>
              <p className="mt-1 text-sm text-prime-muted">Average of all website pages, based on title, description, length and share image.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="green">{summary.good} good</Badge>
                <Badge tone="gold">{summary.work} need work</Badge>
                {summary.poor ? <Badge tone="red">{summary.poor} poor</Badge> : null}
              </div>
            </div>
          </div>

          <AnnotatedSection title="Site-wide defaults" description="Used on every page that doesn’t have its own text. Set these first — they fix most issues at once.">
            <Field label="Brand name after every title" hint={`Example: “Find a stay · ${seo.titleSuffix || brand.name}”.`}>
              <input className="prime-input" value={seo.titleSuffix || ''} placeholder={brand.name} onChange={(e) => set({ titleSuffix: e.target.value })} />
            </Field>
            <Field label="Default description" hint="One or two sentences about Prime: what you offer, where, and why book direct.">
              <textarea className="prime-input min-h-[80px]" value={seo.defaultDescription || ''} onChange={(e) => set({ defaultDescription: e.target.value })} />
              <LengthMeter value={seo.defaultDescription} range={DESCRIPTION_RANGE} />
            </Field>
            <ImageUploadField label="Share image (WhatsApp, Facebook, LinkedIn previews)" value={seo.ogImage || ''} folder="site" ratio="1.91:1" size="1200×630" onChange={(ogImage) => set({ ogImage })} />
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted">Homepage in Google</p>
                <GooglePreview url={`${siteOrigin()}/`} title={effectiveTitle(seo, 'home')} description={effectiveDescription(seo, 'home')} />
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted">Shared on WhatsApp</p>
                <SocialPreview url={`${siteOrigin()}/`} title={effectiveTitle(seo, 'home')} description={effectiveDescription(seo, 'home')} image={seo.ogImage} />
              </div>
            </div>
          </AnnotatedSection>

          <Card
            className="mt-8"
            title="Pages"
            description="Click a page to edit its title and description and see exactly how it will look."
            actions={
              <StatusChips
                value={filter}
                onChange={setFilter}
                options={[
                  { id: 'all', label: 'All', count: rows.length },
                  { id: 'work', label: 'Needs work', count: rows.filter((r) => r.tone !== 'green').length },
                  { id: 'good', label: 'Good', count: rows.filter((r) => r.tone === 'green').length },
                ]}
              />
            }
          >
            <div className="-m-5 divide-y divide-prime-line">
              {visible.map((r) => (
                <button key={r.key} type="button" onClick={() => setEditing(r.key)} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 text-start transition hover:bg-prime-mist">
                  <ScoreRing score={r.score} size={40} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-prime-ink">{SEO_DEFAULT_TITLES[r.key]}</span>
                      <span className="text-[11px] text-prime-muted">{PAGE_PATHS[r.key]}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[#1a0dab]">{effectiveTitle(seo, r.key)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="hidden items-center gap-1.5 text-xs text-prime-muted sm:inline-flex">
                      <span className={cn('h-2 w-2 rounded-full', DOT[r.tone])} />
                      {r.issues ? `${r.issues} to improve` : 'All good'}
                    </span>
                    <ChevronRight size={16} className="text-prime-muted rtl:rotate-180" />
                  </span>
                </button>
              ))}
            </div>
          </Card>
          {editing ? <PageEditor seo={seo} pageKey={editing} onChange={(patch) => setPage(editing, patch)} onClose={() => setEditing(null)} /> : null}
        </>
      )}
      <SaveBar dirty={site.dirty} saving={site.saving} onSave={onSave} onDiscard={site.discard} />
    </div>
  );
}
