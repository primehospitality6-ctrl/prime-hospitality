import { createElement } from 'react';
import { Link } from 'react-router-dom';
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

function TextContent({ block, locale, className }) {
  const light = onColour(block);
  const eyebrow = localText(block.eyebrow, locale);
  const title = localText(block.title, locale);
  return (
    <div className={className}>
      {eyebrow ? <p className={cn('prime-eyebrow', light ? 'text-current opacity-75' : 'text-prime-gold-deep')}>{eyebrow}</p> : null}
      {title ? (
        <h2
          className={cn(
            'font-display font-medium text-balance',
            TITLE[block.titleSize] || TITLE.md,
            eyebrow && 'mt-5',
            light ? 'text-current' : 'text-prime-ink'
          )}
        >
          {title}
        </h2>
      ) : null}
      <Paragraphs
        text={localText(block.body, locale)}
        className={cn('text-[16px] font-light leading-[1.85] md:text-[17px]', title && 'mt-6', light ? 'opacity-80' : 'text-prime-muted')}
      />
    </div>
  );
}

function Picture({ block, locale, sizes, className }) {
  const aspect = ASPECT[block.aspect];
  const alt = localText(block.alt, locale);
  if (!block.src) {
    return <div className={cn('grid aspect-[16/9] place-items-center bg-prime-mist text-xs text-prime-muted', block.rounded && 'rounded-2xl', className)}>Add a photo</div>;
  }
  return (
    <div className={cn('overflow-hidden bg-prime-mist', aspect, block.rounded && 'rounded-2xl', className)}>
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
  const caption = localText(block.caption, locale);
  const picture = <Picture block={block} locale={locale} sizes={`${block.size}vw`} />;
  return (
    <Frame block={block} edge>
      <Reveal as="figure" className={ALIGN_BOX[block.align]} style={{ width: `${block.size}%` }}>
        {block.href ? <SmartLink href={block.href} className="block transition hover:opacity-90">{picture}</SmartLink> : picture}
        {caption ? (
          <figcaption className={cn('mt-3 text-[13px]', block.width === 'full' && 'px-5', onColour(block) ? 'opacity-75' : 'text-prime-muted', ALIGN_TEXT[block.align])}>
            {caption}
          </figcaption>
        ) : null}
      </Reveal>
    </Frame>
  );
}

function ImageTextBlock({ block, locale }) {
  const label = localText(block.buttonLabel, locale);
  return (
    <Frame block={block}>
      <div className={cn('grid items-center gap-10 md:gap-16', SPLIT[block.imageShare] || SPLIT[50])}>
        <Reveal className={cn(block.imageSide === 'end' && 'md:order-2')}>
          <Picture block={block} locale={locale} sizes="(min-width: 768px) 50vw, 100vw" />
        </Reveal>
        <Reveal delay={100} className={ALIGN_TEXT[block.align]}>
          <TextContent block={block} locale={locale} />
          {label && block.buttonHref ? (
            <SmartLink href={block.buttonHref} className={cn('mt-8 inline-flex', onColour(block) ? 'prime-btn-outline' : 'prime-btn')}>
              {label}
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
        <div className="grid h-32 place-items-center border border-dashed border-prime-line text-xs text-prime-muted">Add photos to this gallery</div>
      </Frame>
    );
  }
  return (
    <Frame block={block}>
      <div className={cn('grid grid-cols-2 gap-3 md:gap-4', GRID[block.columns] || GRID[3])}>
        {block.images.map((img, i) => (
          <Reveal key={`${img.src}-${i}`} delay={(i % block.columns) * 70}>
            <Picture block={{ ...img, aspect: block.aspect, rounded: block.rounded }} locale={locale} sizes={`${Math.round(100 / block.columns)}vw`} />
          </Reveal>
        ))}
      </div>
    </Frame>
  );
}

function ButtonsBlock({ block, locale }) {
  const items = (block.items || []).filter((item) => item.href && localText(item.label, locale));
  if (!items.length) return null;
  return (
    <Frame block={block}>
      <div className={cn('flex flex-wrap gap-3', ALIGN_ITEMS[block.align])}>
        {items.map((item, i) => (
          <SmartLink key={i} href={item.href} className={item.style === 'outline' ? 'prime-btn-outline' : 'prime-btn'}>
            {localText(item.label, locale)}
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

/**
 * Renders a page's blocks in the order set in the page builder.
 * `sections` maps each built-in section key to a component or an element.
 */
export default function PageBlocks({ page, sections }) {
  const { site } = useSite();
  return pageBlocks(site, page).map((block) => {
    if (block.hidden) return null;
    const id = blockDomId(page, block);
    if (block.type === 'section') {
      const section = sections[block.key];
      if (!section) return null;
      return (
        <div key={block.id} id={id}>
          {typeof section === 'function' ? createElement(section) : section}
        </div>
      );
    }
    return (
      <div key={block.id} id={id}>
        <CustomBlock block={block} />
      </div>
    );
  });
}
