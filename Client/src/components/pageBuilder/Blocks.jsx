import { createElement } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Copy, EyeOff, Plus, Settings2, Trash2 } from 'lucide-react';
import { useBuilder } from './BuilderFrame';
import Img from '../ui/Img';
import Reveal from '../ui/Reveal';
import { useLocale } from '../../context/LocaleContext';
import { useSite } from '../../context/SiteContext';
import { cn } from '../../utils/cn';
import { blockDomId, localText, pageBlocks } from './layout';

const BACKGROUND = {
  none: '',
  mist: 'bg-prime-mist',
  band: 'bg-prime-band text-prime-on',
  gold: 'bg-brand-gold text-white',
};
const SPACING = { none: 'py-0', sm: 'py-8 md:py-10', md: 'py-14 md:py-20', lg: 'py-20 md:py-32' };
const WIDTH = { narrow: 'max-w-2xl', normal: 'max-w-4xl', wide: '', full: '' };
const ALIGN_TEXT = { start: 'text-start', center: 'text-center', end: 'text-end' };
const ALIGN_ITEMS = { start: 'justify-start', center: 'justify-center', end: 'justify-end' };
const ALIGN_BOX = { start: 'me-auto', center: 'mx-auto', end: 'ms-auto' };
const ASPECT = {
  '21/9': 'aspect-[21/9]',
  '16/9': 'aspect-[16/9]',
  '4/3': 'aspect-[4/3]',
  '1/1': 'aspect-square',
  '4/5': 'aspect-[4/5]',
  '3/4': 'aspect-[3/4]',
};
const TITLE = {
  sm: 'text-[1.6rem] leading-tight md:text-[2rem]',
  md: 'text-display-md',
  lg: 'text-display-lg',
  xl: 'text-display-xl',
};
const GRID = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' };
const SPLIT = { 40: 'md:grid-cols-[2fr_3fr]', 50: 'md:grid-cols-2', 60: 'md:grid-cols-[3fr_2fr]' };
const SPACER = { sm: 'h-6', md: 'h-12', lg: 'h-20', xl: 'h-32' };

const onColour = (b) => b.background === 'band' || b.background === 'gold';

function SmartLink({ href, className, children }) {
  if (!href) return <span className={className}>{children}</span>;
  if (href.startsWith('/')) {
    return (
      <Link to={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  );
}

function Paragraphs({ text, className }) {
  const parts = String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  return (
    <div className={cn('space-y-5', className)}>
      {parts.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}

/** Outer band (background + spacing) and inner width */
function Frame({ block, children, edge = false }) {
  const full = block.width === 'full';
  return (
    <section className={cn(BACKGROUND[block.background], SPACING[block.spacing])}>
      {full && edge ? children : <div className={cn('prime-container', WIDTH[block.width])}>{children}</div>}
    </section>
  );
}

/** In the builder, empty fields show a faint prompt so they can be clicked and filled in. */
function Empty({ children }) {
  return <span className="opacity-35">{children}</span>;
}

function TextContent({ block, locale, className }) {
  const { editing, selectedId } = useBuilder();
  const selected = editing && selectedId === block.id;
  const light = onColour(block);
  const eyebrow = localText(block.eyebrow, locale);
  const title = localText(block.title, locale);
  const body = localText(block.body, locale);
  return (
    <div className={className}>
      {eyebrow || selected ? (
        <p data-edit-field="eyebrow" className={cn('prime-eyebrow', light ? 'text-current opacity-75' : 'text-prime-gold-deep')}>
          {eyebrow || <Empty>Add a small label</Empty>}
        </p>
      ) : null}
      {title || editing ? (
        <h2
          data-edit-field="title"
          className={cn(
            'font-display font-medium text-balance',
            TITLE[block.titleSize] || TITLE.md,
            (eyebrow || selected) && 'mt-5',
            light ? 'text-current' : 'text-prime-ink'
          )}
        >
          {title || <Empty>Add a heading</Empty>}
        </h2>
      ) : null}
      {body || editing ? (
        <div data-edit-field="body" data-edit-multiline="1" className={cn((title || editing) && 'mt-6')}>
          {body ? (
            <Paragraphs text={body} className={cn('text-[16px] font-light leading-[1.85] md:text-[17px]', light ? 'opacity-80' : 'text-prime-muted')} />
          ) : (
            <p className="text-[16px] font-light">
              <Empty>Add text</Empty>
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Picture({ block, locale, sizes, className }) {
  const aspect = ASPECT[block.aspect];
  const alt = localText(block.alt, locale);
  const edit = block.editImage || 'src';
  if (!block.src) {
    return (
      <div data-edit-image={edit} className={cn('grid aspect-[16/9] place-items-center bg-prime-mist text-xs text-prime-muted', block.rounded && 'rounded-2xl', className)}>
        Add a photo
      </div>
    );
  }
  return (
    <div data-edit-image={edit} className={cn('overflow-hidden bg-prime-mist', aspect, block.rounded && 'rounded-2xl', className)}>
      <Img src={block.src} alt={alt} sizes={sizes} className={cn('w-full', aspect ? 'h-full object-cover' : 'h-auto')} />
    </div>
  );
}

function TextBlock({ block, locale }) {
  return (
    <Frame block={block}>
      <Reveal>
        <TextContent block={block} locale={locale} className={cn(ALIGN_TEXT[block.align], block.align === 'center' && 'mx-auto max-w-3xl')} />
      </Reveal>
    </Frame>
  );
}

function ImageBlock({ block, locale }) {
  const { editing, selectedId } = useBuilder();
  const caption = localText(block.caption, locale) || (editing && selectedId === block.id ? '' : null);
  const picture = <Picture block={block} locale={locale} sizes={`${block.size}vw`} />;
  return (
    <Frame block={block} edge>
      <Reveal as="figure" className={ALIGN_BOX[block.align]} style={{ width: `${block.size}%` }}>
        {block.href ? <SmartLink href={block.href} className="block transition hover:opacity-90">{picture}</SmartLink> : picture}
        {caption != null ? (
          <figcaption data-edit-field="caption" className={cn('mt-3 text-[13px]', block.width === 'full' && 'px-5', onColour(block) ? 'opacity-75' : 'text-prime-muted', ALIGN_TEXT[block.align])}>
            {caption || <Empty>Add a caption</Empty>}
          </figcaption>
        ) : null}
      </Reveal>
    </Frame>
  );
}

function ImageTextBlock({ block, locale }) {
  const { editing, selectedId } = useBuilder();
  const label = localText(block.buttonLabel, locale);
  const showButton = (label && block.buttonHref) || (editing && selectedId === block.id);
  return (
    <Frame block={block}>
      <div className={cn('grid items-center gap-10 md:gap-16', SPLIT[block.imageShare] || SPLIT[50])}>
        <Reveal className={cn(block.imageSide === 'end' && 'md:order-2')}>
          <Picture block={block} locale={locale} sizes="(min-width: 768px) 50vw, 100vw" />
        </Reveal>
        <Reveal delay={100} className={ALIGN_TEXT[block.align]}>
          <TextContent block={block} locale={locale} />
          {showButton ? (
            <SmartLink href={block.buttonHref} className={cn('mt-8 inline-flex', onColour(block) ? 'prime-btn-outline' : 'prime-btn')}>
              <span data-edit-field="buttonLabel">{label || <Empty>Button text</Empty>}</span>
            </SmartLink>
          ) : null}
        </Reveal>
      </div>
    </Frame>
  );
}

function GalleryBlock({ block, locale }) {
  if (!block.images?.length) {
    return (
      <Frame block={block}>
        <div data-edit-image="images" className="grid h-32 place-items-center border border-dashed border-prime-line text-xs text-prime-muted">
          Add photos to this gallery
        </div>
      </Frame>
    );
  }
  return (
    <Frame block={block}>
      <div className={cn('grid grid-cols-2 gap-3 md:gap-4', GRID[block.columns] || GRID[3])}>
        {block.images.map((img, i) => (
          <Reveal key={`${img.src}-${i}`} delay={(i % block.columns) * 70}>
            <Picture block={{ ...img, aspect: block.aspect, rounded: block.rounded, editImage: `images.${i}.src` }} locale={locale} sizes={`${Math.round(100 / block.columns)}vw`} />
          </Reveal>
        ))}
      </div>
    </Frame>
  );
}

function ButtonsBlock({ block, locale }) {
  const { editing } = useBuilder();
  const items = (block.items || [])
    .map((item, index) => ({ ...item, index }))
    .filter((item) => editing || (item.href && localText(item.label, locale)));
  if (!items.length) {
    return editing ? (
      <Frame block={block}>
        <p className="text-center text-xs text-prime-muted">No buttons yet — add one in the settings</p>
      </Frame>
    ) : null;
  }
  return (
    <Frame block={block}>
      <div className={cn('flex flex-wrap gap-3', ALIGN_ITEMS[block.align])}>
        {items.map((item) => (
          <SmartLink key={item.index} href={item.href} className={item.style === 'outline' ? 'prime-btn-outline' : 'prime-btn'}>
            <span data-edit-field={`items.${item.index}.label`}>{localText(item.label, locale) || <Empty>Button text</Empty>}</span>
          </SmartLink>
        ))}
      </div>
    </Frame>
  );
}

function SpacerBlock({ block }) {
  return (
    <div className={cn(BACKGROUND[block.background])} aria-hidden>
      <div className={cn('prime-container flex items-center', SPACER[block.height], WIDTH[block.width])}>
        {block.line ? <hr className={cn('w-full border-t', onColour(block) ? 'border-current opacity-25' : 'border-prime-line')} /> : null}
      </div>
    </div>
  );
}

const RENDERERS = {
  text: TextBlock,
  image: ImageBlock,
  imageText: ImageTextBlock,
  gallery: GalleryBlock,
  buttons: ButtonsBlock,
  spacer: SpacerBlock,
};

export function CustomBlock({ block }) {
  const { locale } = useLocale();
  const Renderer = RENDERERS[block.type];
  return Renderer ? <Renderer block={block} locale={locale} /> : null;
}

function ToolButton({ label, onClick, children, danger }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn('grid h-7 w-7 place-items-center rounded-full transition hover:bg-white/15', danger && 'hover:bg-red-500/80')}
    >
      {children}
    </button>
  );
}

/** Builder chrome around one block: outline, name and toolbar */
function BlockShell({ page, block, children }) {
  const { selectedId, names, post } = useBuilder();
  const selected = selectedId === block.id;
  const custom = block.type !== 'section';
  const act = (action) => (e) => {
    e.stopPropagation();
    post({ type: 'builder:action', page, blockId: block.id, action });
  };
  return (
    <div id={blockDomId(page, block)} data-builder-block={block.id} data-builder-page={page} className="group/blk relative">
      {children}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 z-[70] transition',
          selected ? 'shadow-[inset_0_0_0_2px_#b8955a]' : 'group-hover/blk:shadow-[inset_0_0_0_1px_rgba(184,149,90,0.75)]'
        )}
      />
      {/* The toolbar sticks just below the site header while the section is on screen */}
      <div className="pointer-events-none absolute inset-0 z-[71]">
      <div className="sticky top-[calc(var(--prime-header-h)+1.25rem)] flex justify-end p-3">
      <div
        data-builder-ui
        className={cn(
          'flex items-center gap-0.5 rounded-full bg-[#1f1d1c] py-1 pe-1 ps-3 font-sans text-white shadow-lg transition',
          selected ? 'pointer-events-auto opacity-100' : 'opacity-0 group-hover/blk:pointer-events-auto group-hover/blk:opacity-100'
        )}
      >
        <span className="me-1 max-w-[12rem] truncate text-[11px] font-semibold normal-case tracking-normal">{names[block.id] || 'Section'}</span>
        <ToolButton label="Move up" onClick={act('up')}>
          <ArrowUp size={13} />
        </ToolButton>
        <ToolButton label="Move down" onClick={act('down')}>
          <ArrowDown size={13} />
        </ToolButton>
        {custom ? (
          <ToolButton label="Duplicate" onClick={act('duplicate')}>
            <Copy size={13} />
          </ToolButton>
        ) : null}
        <ToolButton label="Hide" onClick={act('hide')}>
          <EyeOff size={13} />
        </ToolButton>
        {custom ? (
          <ToolButton label="Delete" onClick={act('delete')} danger>
            <Trash2 size={13} />
          </ToolButton>
        ) : null}
        <ToolButton label="Settings" onClick={act('settings')}>
          <Settings2 size={13} />
        </ToolButton>
      </div>
      </div>
      </div>
    </div>
  );
}

/** "+ Add section" line between two blocks */
function InsertLine({ page, index }) {
  const { post } = useBuilder();
  return (
    <div data-builder-ui className="relative z-[72] h-0">
      <div className="group/ins absolute inset-x-0 -top-3.5 flex h-7 items-center justify-center">
        <span className="absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-[#b8955a] opacity-0 transition group-hover/ins:opacity-100" />
        <button
          type="button"
          onClick={() => post({ type: 'builder:add', page, index })}
          className="relative inline-flex items-center gap-1 rounded-full bg-[#b8955a] px-3 py-1 font-sans text-[11px] font-semibold normal-case tracking-normal text-white opacity-0 shadow-md transition group-hover/ins:opacity-100"
        >
          <Plus size={12} /> Add section
        </button>
      </div>
    </div>
  );
}

function HiddenBar({ page, block }) {
  const { names, post } = useBuilder();
  return (
    <div id={blockDomId(page, block)} data-builder-block={block.id} data-builder-page={page} className="prime-container py-2">
      <div
        data-builder-ui
        className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-[#b8955a]/70 bg-[#b8955a]/5 px-4 py-2.5 font-sans text-[12px] text-prime-muted"
      >
        <span className="inline-flex items-center gap-2">
          <EyeOff size={13} /> Hidden: <strong className="font-semibold text-prime-ink">{names[block.id] || 'Section'}</strong>
        </span>
        <button
          type="button"
          onClick={() => post({ type: 'builder:action', page, blockId: block.id, action: 'show' })}
          className="rounded-full border border-[#b8955a] px-3 py-1 text-[11px] font-semibold text-[#8a6d3b] hover:bg-[#b8955a] hover:text-white"
        >
          Show
        </button>
      </div>
    </div>
  );
}

function renderSection(sections, block) {
  const section = sections[block.key];
  if (!section) return null;
  return typeof section === 'function' ? createElement(section) : section;
}

/**
 * Renders a page's blocks in the order set in the Website Builder.
 * `sections` maps each built-in section key to a component or an element.
 * Inside the builder's preview, blocks get outlines, toolbars and "+ Add section" lines.
 */
export default function PageBlocks({ page, sections }) {
  const { site } = useSite();
  const { editing, post } = useBuilder();
  const blocks = pageBlocks(site, page);

  if (!editing) {
    return blocks.map((block) => {
      if (block.hidden) return null;
      const content = block.type === 'section' ? renderSection(sections, block) : <CustomBlock block={block} />;
      return content ? (
        <div key={block.id} id={blockDomId(page, block)}>
          {content}
        </div>
      ) : null;
    });
  }

  return (
    <>
      {blocks.map((block, index) => (
        <div key={block.id}>
          <InsertLine page={page} index={index} />
          {block.hidden ? (
            <HiddenBar page={page} block={block} />
          ) : (
            <BlockShell page={page} block={block}>
              {block.type === 'section' ? renderSection(sections, block) : <CustomBlock block={block} />}
            </BlockShell>
          )}
        </div>
      ))}
      <div data-builder-ui className="prime-container py-8">
        <button
          type="button"
          onClick={() => post({ type: 'builder:add', page, index: blocks.length })}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#b8955a]/60 py-5 font-sans text-[13px] font-semibold text-[#8a6d3b] transition hover:border-[#b8955a] hover:bg-[#b8955a]/5"
        >
          <Plus size={16} /> Add section
        </button>
      </div>
    </>
  );
}
