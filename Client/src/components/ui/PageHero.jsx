import Img from './Img';
import Wordmark from './Wordmark';
import { cn } from '../../utils/cn';

function Eyebrow({ children, light, centered }) {
  return (
    <p
      className={cn(
        'prime-eyebrow prime-fade-up flex items-center gap-4',
        centered && 'justify-center',
        light ? 'text-white/80' : 'text-prime-gold'
      )}
    >
      <span className={cn('h-px w-8', light ? 'bg-prime-gold-soft' : 'bg-prime-gold')} aria-hidden />
      {children}
    </p>
  );
}

/**
 * Inner-page opener. With `image` it is a full-bleed photo (pair with <Header overHero />);
 * without, a typographic header with the page's word as a watermark.
 */
export default function PageHero({ eyebrow, title, lede, image, watermark = 'Hospitality', align = 'start', children, className }) {
  const centered = align === 'center';

  if (image) {
    return (
      <section className={cn('relative isolate flex min-h-vh-72 items-end overflow-hidden bg-brand-black text-white md:min-h-vh-78', className)}>
        <Img
          src={image}
          alt=""
          priority
          sizes="100vw"
          widths={[640, 960, 1440, 1920, 2400]}
          fallbackWidth={1920}
          className="prime-kenburns absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/25 to-black/35" />
        <div className={cn('prime-container pb-14 pt-32 md:pb-20', centered && 'text-center')}>
          <div className={cn('max-w-3xl', centered && 'mx-auto')}>
            {eyebrow ? (
              <Eyebrow light centered={centered}>
                {eyebrow}
              </Eyebrow>
            ) : null}
            <h1 className="prime-fade-up mt-6 font-display text-display-xl font-extralight text-balance" style={{ animationDelay: '80ms' }}>
              {title}
            </h1>
            {lede ? (
              <p
                className={cn('prime-fade-up mt-6 max-w-xl text-[15px] font-light leading-relaxed text-white/80 md:text-[17px]', centered && 'mx-auto')}
                style={{ animationDelay: '160ms' }}
              >
                {lede}
              </p>
            ) : null}
            {children}
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
