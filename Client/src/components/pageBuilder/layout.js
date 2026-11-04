/**
 * Page builder layouts. Each page is a list of blocks: its built-in sections ({ type: 'section', key })
 * and custom blocks (text, image, image + text, gallery, buttons, spacer). The server validates the same shape.
 */

export const PAGE_BUILTINS = {
  home: ['intro', 'properties', 'brands', 'featured', 'trust', 'partners', 'partnerCta'],
  about: ['story', 'wideImage', 'values', 'brands', 'cta'],
  compounds: ['main'],
  contact: ['main'],
  faq: ['main'],
  owners: ['main'],
  careers: ['main'],
};

export const sectionBlock = (key, hidden = false) => ({ id: `section-${key}`, type: 'section', key, hidden });

/** The blocks to show for a page: saved layout, else (homepage) the older section list, else the built-in order. */
export function pageBlocks(site, page) {
  const builtins = PAGE_BUILTINS[page] || [];
  const saved = site?.layouts?.[page]?.blocks;
  let blocks = Array.isArray(saved) && saved.length ? saved : null;
  if (!blocks && page === 'home' && Array.isArray(site?.home?.sections) && site.home.sections.length) {
    blocks = site.home.sections.map((s) => sectionBlock(s.id, s.enabled === false));
  }
  blocks = blocks ? [...blocks] : [];
  const present = new Set(blocks.filter((b) => b.type === 'section').map((b) => b.key));
  for (const key of builtins) if (!present.has(key)) blocks.push(sectionBlock(key));
  return blocks.filter((b) => b.type !== 'section' || builtins.includes(b.key));
}

/** Element id used on the live site, so the editor's preview can scroll to a block. */
export function blockDomId(page, block) {
  if (block.type === 'section' && page === 'home') return `home-${block.key}`;
  return `blk-${page}-${block.id}`;
}

/** English/Arabic value for the current language, falling back to the other one. */
export function localText(value, locale) {
  if (!value || typeof value !== 'object') return typeof value === 'string' ? value : '';
  return value[locale] || value.en || value.ar || '';
}

let counter = 0;
export function newBlockId() {
  counter += 1;
  return `b${Date.now().toString(36)}${counter.toString(36)}`;
}

const empty = () => ({ en: '', ar: '' });

/** A fresh block of each type, with sensible starting values. */
export function newBlock(type) {
  const base = { id: newBlockId(), type, hidden: false, width: 'normal', align: 'start', background: 'none', spacing: 'md' };
  switch (type) {
    case 'text':
      return { ...base, eyebrow: empty(), title: { en: 'New heading', ar: '' }, body: { en: 'Write your text here.', ar: '' }, titleSize: 'md' };
    case 'image':
      return { ...base, width: 'wide', src: '', alt: empty(), caption: empty(), aspect: '16/9', size: 100, rounded: false, href: '' };
    case 'imageText':
      return {
        ...base,
        width: 'wide',
        src: '',
        alt: empty(),
        aspect: '4/5',
        eyebrow: empty(),
        title: { en: 'New heading', ar: '' },
        body: { en: 'Write your text here.', ar: '' },
        buttonLabel: empty(),
        buttonHref: '',
        imageSide: 'start',
        imageShare: 50,
        rounded: false,
      };
    case 'gallery':
      return { ...base, width: 'wide', images: [], columns: 3, aspect: '4/3', rounded: false };
    case 'buttons':
      return { ...base, align: 'center', items: [{ label: { en: 'Book a stay', ar: 'احجز إقامتك' }, href: '/search', style: 'solid' }] };
    case 'spacer':
      return { ...base, height: 'md', line: false, spacing: 'none' };
    default:
      return base;
  }
}
