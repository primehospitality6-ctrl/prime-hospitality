import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, ChevronDown, ExternalLink, Eye, EyeOff, Handshake, ImageIcon, MapPin, Megaphone, ShieldCheck, Sparkles, Star } from 'lucide-react';
import api from '../../api/client';
import { AdminPageHeader, MoveButtons, reorderList } from '../../components/admin/AdminUi';
import { Badge, SaveBar, useSiteSection, useToast } from '../../components/admin/kit';
import CopyFields, { isOverridden } from '../../components/admin/CopyFields';
import LivePreview from '../../components/admin/LivePreview';
import { useSite } from '../../context/SiteContext';
import { cn } from '../../utils/cn';

const HERO = {
  name: 'Hero',
  about: 'Full-screen photos with the headline and search bar.',
  icon: ImageIcon,
  keys: ['home.heroLine1', 'home.heroLine2', 'home.heroSubtitle', 'home.introEyebrow'],
  link: ['/admin/slideshow', 'Change the slideshow photos'],
};

const SECTION_INFO = {
  intro: {
    name: 'Introduction',
    about: 'Brand statement with live destination and property counts.',
    icon: Sparkles,
    keys: ['home.introTitle', 'home.introBody', 'home.ourStory'],
  },
  properties: {
    name: 'Destinations',
    about: 'Destination tiles. Pick which ones show with “Show on home” on each destination.',
    icon: MapPin,
    keys: ['home.destinations', 'home.destinationsBody', 'home.exploreCompounds'],
    link: ['/admin/destinations', 'Choose destinations'],
  },
  brands: {
    name: 'Brands',
    about: 'A colour card for each Prime brand.',
    icon: Award,
    keys: ['home.brandsEyebrow', 'home.brandsTitle'],
    link: ['/admin/brands', 'Manage brands'],
  },
  featured: {
    name: 'Featured stays',
    about: 'Carousel of the unit types marked “Featured”.',
    icon: Star,
    keys: ['home.featured', 'home.featuredTitle', 'home.viewAll'],
    link: ['/admin/units', 'Choose featured unit types'],
  },
  trust: {
    name: 'Why Prime',
    about: 'Numbered reasons to book with Prime.',
    icon: ShieldCheck,
    keys: ['home.why', 'home.trustTitle', 'home.trustBody'],
    link: ['/admin/content', 'Edit the reasons'],
  },
  partners: {
    name: 'Partner logos',
    about: 'Strip of booking channel / partner logos.',
    icon: Handshake,
    keys: ['home.partners'],
    link: ['/admin/content', 'Edit the logos'],
  },
  partnerCta: {
    name: 'Owner call-to-action',
    about: 'Invites property owners to list with Prime.',
    icon: Megaphone,
    keys: ['home.partnersLabel', 'home.partnerCtaTitle', 'home.partnerCtaBody', 'home.partnerCtaBtn'],
  },
};

function SectionRow({ info, enabled = true, expanded, edited, onToggleOpen, onToggleVisible, move, children }) {
  const Icon = info.icon;
  return (
    <li className={cn('bg-prime-surface', !enabled && 'bg-prime-mist/60', expanded && 'ring-1 ring-inset ring-prime-gold')}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        {move || <span className="w-[52px]" />}
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-start" onClick={onToggleOpen}>
          <span className={cn('grid h-9 w-9 shrink-0 place-items-center border', expanded ? 'border-prime-gold bg-prime-gold/10 text-prime-gold-deep' : 'border-prime-line text-prime-muted')}>
            <Icon size={16} />
          </span>
          <span className="min-w-0">
            <span className={cn('flex items-center gap-2 text-sm font-semibold', !enabled && 'text-prime-muted line-through')}>
              {info.name}
              {edited ? <Badge tone="gold">Edited</Badge> : null}
            </span>
            <span className="block truncate text-xs text-prime-muted">{info.about}</span>
          </span>
        </button>
        {onToggleVisible ? (
          <button
            type="button"
            onClick={onToggleVisible}
            className={cn('grid h-8 w-8 place-items-center border', enabled ? 'border-prime-line text-prime-ink hover:border-prime-ink' : 'border-dashed border-prime-line text-prime-muted')}
            title={enabled ? 'Visible — click to hide' : 'Hidden — click to show'}
            aria-label={enabled ? 'Hide section' : 'Show section'}
          >
            {enabled ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        ) : null}
        <button type="button" onClick={onToggleOpen} className="grid h-8 w-8 place-items-center text-prime-muted" aria-label={expanded ? 'Collapse' : 'Edit text'}>
          <ChevronDown size={16} className={cn('transition', expanded && 'rotate-180')} />
        </button>
      </div>
      {expanded ? <div className="border-t border-prime-line px-4 py-5">{children}</div> : null}
    </li>
  );
}

export default function AdminHomepagePage() {
  const toast = useToast();
  const { replace } = useSite();
  const { draft, setDraft, dirty, saving, error, save, discard, loaded } = useSiteSection(api, ['home', 'copy'], replace);
  const [open, setOpen] = useState('');
  const [focus, setFocus] = useState(null);

  const sections = draft?.home?.sections || [];
  const hiddenCount = sections.filter((s) => !s.enabled).length;

  function setSections(next) {
    setDraft((d) => ({ ...d, home: { ...d.home, sections: next } }));
  }

  function setCopy(copy) {
    setDraft((d) => ({ ...d, copy }));
  }

  function toggleOpen(id, enabled = true) {
    const next = open === id ? '' : id;
    setOpen(next);
    if (next && enabled) setFocus({ id: `home-${id}`, at: Date.now() });
  }

  async function onSave() {
    if (await save()) toast.success('Homepage published.');
  }

  function editor(info) {
    return (
      <>
        {info.keys.length ? <CopyFields keys={info.keys} copy={draft.copy} onChange={setCopy} /> : null}
        {info.link ? (
          <Link to={info.link[0]} className="prime-link mt-5 inline-flex items-center gap-1 text-xs">
            {info.link[1]} →
          </Link>
        ) : null}
        <p className="mt-4 text-[11px] text-prime-muted">Leave a box empty to keep the built-in wording shown in grey.</p>
      </>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Homepage"
        lede="Click a section to edit its text — the preview jumps to it. Reorder with the arrows, hide with the eye. Nothing goes live until you press Save."
        actions={
          <a href="/" target="_blank" rel="noreferrer" className="prime-btn-outline">
            <ExternalLink size={14} /> Open homepage
          </a>
        }
      />
      {error ? <p className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {!loaded ? (
        <p className="text-sm text-prime-muted">Loading…</p>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-prime-muted">
              <span>Sections, top to bottom</span>
              <span className="normal-case tracking-normal">{hiddenCount ? `${hiddenCount} hidden` : 'All visible'}</span>
            </div>
            <ol className="divide-y divide-prime-line border border-prime-line">
              <SectionRow
                info={HERO}
                expanded={open === 'hero'}
                edited={HERO.keys.some((k) => isOverridden(draft.copy, k))}
                onToggleOpen={() => toggleOpen('hero')}
              >
                {editor(HERO)}
              </SectionRow>
              {sections.map((s, index) => {
                const info = SECTION_INFO[s.id] || { name: s.id, about: '', icon: Sparkles, keys: [] };
                return (
                  <SectionRow
                    key={s.id}
                    info={info}
                    enabled={s.enabled}
                    expanded={open === s.id}
                    edited={info.keys.some((k) => isOverridden(draft.copy, k))}
                    onToggleOpen={() => toggleOpen(s.id, s.enabled)}
                    onToggleVisible={() => setSections(sections.map((x) => (x.id === s.id ? { ...x, enabled: !x.enabled } : x)))}
                    move={
                      <MoveButtons
                        disableUp={index === 0}
                        disableDown={index === sections.length - 1}
                        onUp={() => setSections(reorderList(sections, index, index - 1))}
                        onDown={() => setSections(reorderList(sections, index, index + 1))}
                      />
                    }
                  >
                    {editor(info)}
                  </SectionRow>
                );
              })}
            </ol>
            <p className="mt-3 text-xs text-prime-muted">The header, footer and announcement bar are shared by every page — edit them under Pages &amp; text and Marketing.</p>
          </div>
          <div className="hidden min-w-0 xl:sticky xl:top-20 xl:block">
            <LivePreview path="/" site={{ home: draft.home, copy: draft.copy }} focus={focus} />
          </div>
        </div>
      )}
      <SaveBar dirty={dirty} saving={saving} onSave={onSave} onDiscard={discard} />
    </div>
  );
}
