import Img from './Img';
import Wordmark from './Wordmark';
import { cn } from '../../utils/cn';

function Eyebrow({ children, centered }) {
  return (
    <p className={cn('prime-eyebrow prime-fade-up flex items-center gap-4 text-prime-gold', centered && 'justify-center')}>
      <span className="h-px w-8 bg-prime-gold" aria-hidden />
      {children}
    </p>
  );
}

/**
 * Inner-page opener. With `image`, the words sit beside a framed photo (pair with <Header overHero />);
 * without, a typographic header with the page's word as a watermark.
 */
export default function PageHero({ eyebrow, title, lede, image, watermark = 'Hospitality', align = 'start', children, className }) {
  const centered = align === 'center';

  if (image) {
    // Words on the page colour beside the photo; nothing is laid over the photo
    return (
      <section className={cn('relative isolate overflow-hidden bg-prime-sand text-prime-ink', className)}>
        <div className="prime-container grid items-center gap-10 pb-14 pt-[calc(var(--prime-header-h)+2.5rem)] md:pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:pt-[calc(var(--prime-header-h)+3.5rem)]">
          <div className={cn('max-w-2xl', centered && 'mx-auto text-center lg:mx-0 lg:text-start')}>
            {eyebrow ? <Eyebrow centered={centered}>{eyebrow}</Eyebrow> : null}
            <h1 className="prime-fade-up mt-7 font-display text-display-xl font-extralight text-balance" style={{ animationDelay: '80ms' }}>
              {title}
            </h1>
            {lede ? (
              <p
                className={cn('prime-lede prime-fade-up mt-7 max-w-lg', centered && 'mx-auto lg:mx-0')}
                style={{ animationDelay: '160ms' }}
              >
                {lede}
              </p>
            ) : null}
            {children}
          </div>
          <div className="prime-fade-up relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-prime-mist lg:aspect-[5/6]" style={{ animationDelay: '120ms' }}>
            <Img
              src={image}
              alt=""
              priority
              sizes="(min-width: 1024px) 52vw, 100vw"
              widths={[640, 960, 1440, 1920]}
              fallbackWidth={1440}
              className="prime-kenburns absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={cn('relative isolate overflow-hidden', className)}>
      {watermark ? (
        <Wordmark
          word={watermark}
          className="pointer-events-none absolute -top-[0.06em] end-[-0.03em] -z-10 hidden text-[clamp(6rem,13vw,12rem)] text-prime-ink/[0.05] md:block"
        />
      ) : null}
      <div className={cn('prime-container pb-12 pt-14 md:pb-16 md:pt-24', centered && 'text-center')}>
        <div className={cn('max-w-4xl', centered && 'mx-auto')}>
          {eyebrow ? <Eyebrow centered={centered}>{eyebrow}</Eyebrow> : null}
          <h1 className="prime-fade-up mt-6 font-display text-display-xl font-extralight text-prime-ink text-balance" style={{ animationDelay: '80ms' }}>
            {title}
          </h1>
          {lede ? (
            <p className={cn('prime-lede prime-fade-up mt-6 max-w-2xl', centered && 'mx-auto')} style={{ animationDelay: '160ms' }}>
              {lede}
            </p>
          ) : null}
          {children}
        </div>
      </div>
    </section>
  );
}
