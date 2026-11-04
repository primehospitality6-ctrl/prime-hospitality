/**
 * Shared pieces of the Website Builder: what each page contains, the block types,
 * and the settings forms shown in the inspector.
 */
import {
  AlignVerticalSpaceAround,
  Award,
  Handshake,
  Image as ImageIcon,
  Images,
  LayoutPanelLeft,
  MapPin,
  Megaphone,
  MousePointerClick,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Type,
} from 'lucide-react';
import { ImageUploadField, MoveButtons, reorderList } from '../admin/AdminUi';
import { BilingualField, Field, Toggle, labelCls } from '../admin/kit';
import { localText } from './layout';
import { cn } from '../../utils/cn';

/* ——— What can be built ——— */

export const BLOCK_TYPES = {
  text: { name: 'Text', about: 'Heading and paragraphs', icon: Type },
  image: { name: 'Photo', about: 'One photo, any size, with a caption', icon: ImageIcon },
  imageText: { name: 'Photo + text', about: 'Photo beside a heading, text and button', icon: LayoutPanelLeft },
  gallery: { name: 'Gallery', about: 'A grid of photos', icon: Images },
  buttons: { name: 'Buttons', about: 'Up to three buttons that link anywhere', icon: MousePointerClick },
  spacer: { name: 'Space / line', about: 'Empty space or a dividing line', icon: AlignVerticalSpaceAround },
};

const keysOf = (prefix, ...names) => names.map((n) => `${prefix}.${n}`);

/** Built-in sections of each page: what they are and which texts/photos they use */
export const PAGES = {
  home: {
    label: 'Homepage',
    path: '/',
    hero: {
      name: 'Hero',
      about: 'Full-screen photos with the headline and search bar. Always first.',
      keys: ['home.heroLine1', 'home.heroLine2', 'home.heroSubtitle', 'home.introEyebrow'],
      link: ['/admin/slideshow', 'Change the slideshow photos'],
    },
    sections: {
      intro: { name: 'Introduction', about: 'Brand statement with a link to the About page.', icon: Sparkles, keys: ['home.introTitle', 'home.introBody', 'home.ourStory'] },
      properties: {
        name: 'Destinations',
        about: 'Destination tiles. Pick which show with “Show on home” on each destination.',
        icon: MapPin,
        keys: ['home.destinations', 'home.destinationsBody', 'home.exploreCompounds'],
        link: ['/admin/destinations', 'Choose destinations'],
      },
      brands: { name: 'Brands', about: 'A colour card for each Prime brand.', icon: Award, keys: ['home.brandsEyebrow', 'home.brandsTitle'], link: ['/admin/brands', 'Manage brands'] },
      featured: {
        name: 'Featured stays',
        about: 'Carousel of the unit types marked “Featured”.',
        icon: Star,
        keys: ['home.featured', 'home.featuredTitle', 'home.viewAll'],
        link: ['/admin/units', 'Choose featured unit types'],
      },
      trust: { name: 'Why Prime', about: 'Numbered reasons to book with Prime.', icon: ShieldCheck, keys: ['home.why', 'home.trustTitle', 'home.trustBody'], link: ['/admin/content', 'Edit the reasons'] },
      partners: { name: 'Partner logos', about: 'Strip of partner logos.', icon: Handshake, keys: ['home.partners'], link: ['/admin/content', 'Edit the logos'] },
      partnerCta: {
        name: 'Owner call-to-action',
        about: 'Invites property owners to list with Prime.',
        icon: Megaphone,
        keys: ['home.partnersLabel', 'home.partnerCtaTitle', 'home.partnerCtaBody', 'home.partnerCtaBtn'],
      },
    },
  },
  about: {
    label: 'About Us',
    path: '/about',
    hero: { name: 'Hero', about: 'Page title over a photo. Always first.', keys: keysOf('about', 'eyebrow', 'title', 'lede'), image: ['about', 'heroImage'] },
    sections: {
      story: { name: 'Our story', about: 'Heading with two paragraphs.', icon: Type, keys: keysOf('about', 'storyEyebrow', 'storyTitle', 'storyBody1', 'storyBody2', 'explore') },
      wideImage: { name: 'Wide photo', about: 'A full-width photo.', icon: ImageIcon, keys: [], image: ['about', 'wideImage'] },
      values: {
        name: 'Our values',
        about: 'Portrait photo beside three numbered values.',
        icon: ShieldCheck,
        keys: keysOf('about', 'valuesEyebrow', 'valuesTitle', 'value1Title', 'value1Body', 'value2Title', 'value2Body', 'value3Title', 'value3Body'),
        image: ['about', 'portraitImage'],
      },
      brands: { name: 'Brands', about: 'A colour card for each Prime brand.', icon: Award, keys: [], link: ['/admin/brands', 'Manage brands'] },
      cta: { name: 'Call to action', about: 'Heading with two buttons.', icon: MousePointerClick, keys: keysOf('about', 'ctaTitle', 'ctaBody', 'ctaPrimary', 'ctaSecondary') },
    },
  },
  compounds: {
    label: 'Destinations',
    path: '/compounds',
    hero: { name: 'Hero', about: 'Page title over a photo. Always first.', keys: ['home.brandsEyebrow', 'properties.title', 'properties.lede'], image: ['compounds', 'heroImage'] },
    sections: {
      main: {
        name: 'Destinations list',
        about: 'Filter chips and every destination with its properties.',
        icon: MapPin,
        keys: keysOf('properties', 'all', 'emptyTitle', 'emptyBody', 'showAll'),
        link: ['/admin/destinations', 'Manage destinations'],
      },
    },
  },
  contact: {
    label: 'Contact',
    path: '/contact',
    hero: { name: 'Hero', about: 'Page title. Always first.', keys: keysOf('contact', 'eyebrow', 'title', 'lede'), image: ['contact', 'heroImage'] },
    sections: {
      main: {
        name: 'Contact details & form',
        about: 'WhatsApp, email, phone, office and the message form.',
        icon: Type,
        keys: keysOf('contact', 'whatsappValue', 'email', 'phone', 'office', 'formTitle', 'send', 'thanks', 'thanksBody'),
        link: ['/admin/settings', 'Edit contact details'],
      },
    },
  },
  faq: {
    label: 'FAQ',
    path: '/faq',
    hero: { name: 'Hero', about: 'Page title. Always first.', keys: keysOf('faq', 'eyebrow', 'title', 'lede'), image: ['faq', 'heroImage'] },
    sections: {
      main: { name: 'Questions', about: 'Help box and the questions list.', icon: Type, keys: keysOf('faq', 'asideTitle', 'asideBody', 'whatsapp', 'contactPage'), link: ['/admin/content', 'Edit the questions'] },
    },
  },
  owners: {
    label: 'List your property',
    path: '/owners',
    hero: { name: 'Hero', about: 'Page title over a photo. Always first.', keys: keysOf('owners', 'eyebrow', 'title', 'lede', 'cta'), image: ['owners', 'heroImage'] },
    sections: {
      main: {
        name: 'How it works & form',
        about: 'Three steps, a photo and the owner inquiry form.',
        icon: Type,
        keys: keysOf('owners', 'howEyebrow', 'howTitle', 'step1Title', 'step1Body', 'step2Title', 'step2Body', 'step3Title', 'step3Body', 'inquiryEyebrow', 'formTitle', 'formBody', 'submit'),
        image: ['owners', 'sideImage'],
      },
    },
  },
  careers: {
    label: 'Careers',
    path: '/careers',
    hero: { name: 'Hero', about: 'Page title over a photo. Always first.', keys: keysOf('careers', 'eyebrow', 'title', 'lede'), image: ['careers', 'heroImage'] },
    sections: {
      main: { name: 'Open roles', about: 'Intro text and the list of open roles.', icon: Type, keys: keysOf('careers', 'openRoles', 'body', 'apply', 'none'), link: ['/admin/pages', 'Edit the roles'] },
    },
  },
};

/* ——— Small form controls ——— */

export function Segmented({ label, value, options, onChange }) {
  return (
    <div>
      {label ? <span className={labelCls}>{label}</span> : null}
      <div className="inline-flex flex-wrap border border-prime-line bg-prime-surface p-0.5">
        {options.map(([id, text]) => (
          <button
            key={String(id)}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={value === id}
            className={cn(
              'px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition',
              value === id ? 'bg-prime-ink text-prime-sand' : 'text-prime-muted hover:text-prime-ink'
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function LinkInput({ label = 'Link', value, onChange, hint = 'A page on this site like /search or /about, or a full https:// address.' }) {
  return (
    <Field label={label} hint={hint}>
      <input className="prime-input" value={value || ''} placeholder="/search" onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

const ASPECT_OPTIONS = [
  ['auto', 'Original'],
  ['21/9', '21:9'],
  ['16/9', '16:9'],
  ['4/3', '4:3'],
  ['1/1', '1:1'],
  ['4/5', '4:5'],
  ['3/4', '3:4'],
];

export function LayoutFields({ block, set }) {
  return (
    <div className="space-y-4 border-t border-prime-line pt-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-ink">Layout</p>
      <Segmented
        label="Width"
        value={block.width}
        onChange={(width) => set({ width })}
        options={[
          ['narrow', 'Narrow'],
          ['normal', 'Medium'],
          ['wide', 'Wide'],
          ['full', 'Full screen'],
        ]}
      />
      {block.type !== 'spacer' ? (
        <Segmented
          label="Position"
          value={block.align}
          onChange={(align) => set({ align })}
          options={[
            ['start', 'Left'],
            ['center', 'Centre'],
            ['end', 'Right'],
          ]}
        />
      ) : null}
      <Segmented
        label="Background"
        value={block.background}
        onChange={(background) => set({ background })}
        options={[
          ['none', 'None'],
          ['mist', 'Light'],
          ['band', 'Dark'],
          ['gold', 'Gold'],
        ]}
      />
      {block.type !== 'spacer' ? (
        <Segmented
          label="Space above & below"
          value={block.spacing}
          onChange={(spacing) => set({ spacing })}
          options={[
            ['none', 'None'],
            ['sm', 'Small'],
            ['md', 'Medium'],
            ['lg', 'Large'],
          ]}
        />
      ) : null}
      <p className="text-[11px] text-prime-muted">In Arabic, left and right swap automatically.</p>
    </div>
  );
}

function TextFields({ block, set }) {
  return (
    <>
      <BilingualField label="Small label above the heading" value={block.eyebrow} onChange={(eyebrow) => set({ eyebrow })} />
      <BilingualField label="Heading" value={block.title} onChange={(title) => set({ title })} />
      <Segmented
        label="Heading size"
        value={block.titleSize || 'md'}
        onChange={(titleSize) => set({ titleSize })}
        options={[
          ['sm', 'S'],
          ['md', 'M'],
          ['lg', 'L'],
          ['xl', 'XL'],
        ]}
      />
      <BilingualField label="Text" multiline rows={6} value={block.body} onChange={(body) => set({ body })} hint="Leave an empty line between paragraphs. Empty boxes are simply not shown." />
    </>
  );
}

export function BlockFields({ block, set }) {
  switch (block.type) {
    case 'text':
      return <TextFields block={block} set={set} />;
    case 'image':
      return (
        <>
          <ImageUploadField label="Photo" value={block.src} onChange={(src) => set({ src })} folder="pages" />
          <div>
            <span className={labelCls}>Photo size · {block.size}% of the width</span>
            <input type="range" min={20} max={100} step={5} value={block.size} onChange={(e) => set({ size: Number(e.target.value) })} className="w-full accent-[var(--prime-gold)]" />
          </div>
          <Segmented label="Shape" value={block.aspect} onChange={(aspect) => set({ aspect })} options={ASPECT_OPTIONS} />
          <Toggle checked={block.rounded} onChange={(rounded) => set({ rounded })} label="Rounded corners" />
          <BilingualField label="Caption" value={block.caption} onChange={(caption) => set({ caption })} />
          <BilingualField label="Description for screen readers" value={block.alt} onChange={(alt) => set({ alt })} />
          <LinkInput label="Link when clicked (optional)" value={block.href} onChange={(href) => set({ href })} />
        </>
      );
    case 'imageText':
      return (
        <>
          <ImageUploadField label="Photo" value={block.src} onChange={(src) => set({ src })} folder="pages" />
          <Segmented
            label="Photo side"
            value={block.imageSide}
            onChange={(imageSide) => set({ imageSide })}
            options={[
              ['start', 'Left'],
              ['end', 'Right'],
            ]}
          />
          <Segmented
            label="Photo size"
            value={block.imageShare}
            onChange={(imageShare) => set({ imageShare })}
            options={[
              [40, 'Small'],
              [50, 'Half'],
              [60, 'Large'],
            ]}
          />
          <Segmented label="Shape" value={block.aspect} onChange={(aspect) => set({ aspect })} options={ASPECT_OPTIONS} />
          <Toggle checked={block.rounded} onChange={(rounded) => set({ rounded })} label="Rounded corners" />
          <TextFields block={block} set={set} />
          <BilingualField label="Button text (optional)" value={block.buttonLabel} onChange={(buttonLabel) => set({ buttonLabel })} />
          <LinkInput label="Button link" value={block.buttonHref} onChange={(buttonHref) => set({ buttonHref })} />
        </>
      );
    case 'gallery': {
      const images = block.images || [];
      const setImages = (next) => set({ images: next });
      return (
        <>
          <ol className="space-y-3">
            {images.map((img, i) => (
              <li key={i} className="flex items-start gap-2 border border-prime-line p-3">
                <MoveButtons
                  disableUp={i === 0}
                  disableDown={i === images.length - 1}
                  onUp={() => setImages(reorderList(images, i, i - 1))}
                  onDown={() => setImages(reorderList(images, i, i + 1))}
                />
                <ImageUploadField className="min-w-0 flex-1" value={img.src} onChange={(src) => setImages(images.map((x, j) => (j === i ? { ...x, src } : x)))} folder="pages" />
                <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center border border-prime-line text-red-600" aria-label="Remove photo">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ol>
          {images.length < 24 ? (
            <button type="button" className="prime-btn-outline" onClick={() => setImages([...images, { src: '', alt: { en: '', ar: '' } }])}>
              <Plus size={14} /> Add photo
            </button>
          ) : null}
          <Segmented
            label="Photos per row"
            value={block.columns}
            onChange={(columns) => set({ columns })}
            options={[
              [2, '2'],
              [3, '3'],
              [4, '4'],
            ]}
          />
          <Segmented label="Shape" value={block.aspect} onChange={(aspect) => set({ aspect })} options={ASPECT_OPTIONS.filter(([id]) => id !== 'auto')} />
          <Toggle checked={block.rounded} onChange={(rounded) => set({ rounded })} label="Rounded corners" />
        </>
      );
    }
    case 'buttons': {
      const items = block.items || [];
      const setItems = (next) => set({ items: next });
      return (
        <>
          {items.map((item, i) => (
            <div key={i} className="space-y-3 border border-prime-line p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-prime-muted">Button {i + 1}</span>
                <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-xs text-red-600">
                  Remove
                </button>
              </div>
              <BilingualField label="Text" value={item.label} onChange={(label) => setItems(items.map((x, j) => (j === i ? { ...x, label } : x)))} />
              <LinkInput value={item.href} onChange={(href) => setItems(items.map((x, j) => (j === i ? { ...x, href } : x)))} />
              <Segmented
                label="Style"
                value={item.style}
                onChange={(style) => setItems(items.map((x, j) => (j === i ? { ...x, style } : x)))}
                options={[
                  ['solid', 'Filled'],
                  ['outline', 'Outline'],
                ]}
              />
            </div>
          ))}
          {items.length < 3 ? (
            <button type="button" className="prime-btn-outline" onClick={() => setItems([...items, { label: { en: '', ar: '' }, href: '', style: items.length ? 'outline' : 'solid' }])}>
              <Plus size={14} /> Add button
            </button>
          ) : null}
        </>
      );
    }
    case 'spacer':
      return (
        <>
          <Segmented
            label="Height"
            value={block.height}
            onChange={(height) => set({ height })}
            options={[
              ['sm', 'Small'],
              ['md', 'Medium'],
              ['lg', 'Large'],
              ['xl', 'Extra large'],
            ]}
          />
          <Toggle checked={block.line} onChange={(line) => set({ line })} label="Show a dividing line" />
        </>
      );
    default:
      return null;
  }
}

/* ——— Block list ——— */

export function blockSummary(block) {
  const type = BLOCK_TYPES[block.type];
  const text =
    localText(block.title, 'en') ||
    localText(block.caption, 'en') ||
    localText(block.items?.[0]?.label, 'en') ||
    (block.type === 'gallery' ? `${block.images?.length || 0} photo(s)` : '') ||
    type?.about ||
    '';
  return text.length > 70 ? `${text.slice(0, 70)}…` : text;
}

export function AddMenu({ onAdd, onClose }) {
  return (
    <div className="grid gap-2 border border-prime-gold bg-prime-surface p-3 sm:grid-cols-2">
      {Object.entries(BLOCK_TYPES).map(([type, info]) => {
        const Icon = info.icon;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onAdd(type)}
            className="flex items-start gap-3 border border-prime-line p-3 text-start transition hover:border-prime-gold hover:bg-prime-gold/5"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center border border-prime-line text-prime-gold-deep">
              <Icon size={16} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-prime-ink">{info.name}</span>
              <span className="block text-xs text-prime-muted">{info.about}</span>
            </span>
          </button>
        );
      })}
      <button type="button" onClick={onClose} className="text-xs text-prime-muted underline sm:col-span-2">
        Cancel
      </button>
    </div>
  );
}

