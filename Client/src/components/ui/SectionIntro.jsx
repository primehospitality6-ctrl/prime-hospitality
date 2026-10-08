import { Link } from 'react-router-dom';
import Reveal from './Reveal';
import { cn } from '../../utils/cn';

/** Eyebrow + light statement + optional body and “explore” link. */
export default function SectionIntro({
  eyebrow,
  title,
  body,
  link,
  align = 'start',
  tone = 'light',
  className,
  as: Heading = 'h2',
}) {
  const dark = tone === 'dark';
  const centered = align === 'center';
  const split = align === 'split';

  return (
    <Reveal
      className={cn(
        'mb-12 md:mb-16',
        centered && 'mx-auto max-w-3xl text-center',
        split && 'flex flex-col gap-6 md:flex-row md:items-end md:justify-between',
        className
      )}
    >
      <div className={cn(split && 'max-w-2xl')}>
        {eyebrow ? (
          <p
            className={cn(
              'prime-eyebrow mb-6 flex items-center gap-4',
              centered && 'justify-center',
              dark ? 'text-prime-gold-soft' : 'text-prime-gold'
            )}
          >
            <span className={cn('h-px w-8', dark ? 'bg-prime-gold-soft' : 'bg-prime-gold')} aria-hidden />
            {eyebrow}
          </p>
        ) : null}
        <Heading
          className={cn('font-display text-display-lg font-extralight text-balance', dark ? 'text-white' : 'text-prime-ink')}
        >
          {title}
        </Heading>
        {body ? (
          <p
            className={cn(
              'mt-6 max-w-xl text-[15px] font-light leading-[1.8] md:text-[17px]',
              centered && 'mx-auto',
              dark ? 'text-white/70' : 'text-prime-muted'
            )}
          >
            {body}
          </p>
        ) : null}
        {link && !split ? (
          <Link to={link.to} className={cn('prime-link mt-8', dark && 'prime-link--light')}>
            {link.label}
          </Link>
        ) : null}
      </div>
      {link && split ? (
        <Link to={link.to} className={cn('prime-link shrink-0', dark && 'prime-link--light')}>
          {link.label}
        </Link>
      ) : null}
    </Reveal>
  );
}
