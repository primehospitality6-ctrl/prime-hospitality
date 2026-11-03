import { cn } from '../../utils/cn';

/** Section-level heading: eyebrow, serif title, lede. */
export default function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  tone = 'light',
  className,
  dense = false,
  as: Heading = 'h1',
}) {
  const isDark = tone === 'dark';

  return (
    <div className={cn(dense ? 'mb-8' : 'mb-12 md:mb-16', className)}>
      {eyebrow ? (
        <p className={cn('prime-eyebrow mb-4', isDark ? 'text-prime-gold-deep' : 'text-prime-gold-deep')}>{eyebrow}</p>
      ) : null}
      <Heading
        className={cn(
          'font-display font-medium text-balance',
          dense ? 'text-display-md' : 'text-display-lg',
          isDark ? 'text-prime-on' : 'text-prime-ink'
        )}
      >
        {title}
      </Heading>
      {lede ? (
        <p
          className={cn(
            'mt-5 max-w-xl text-[15px] font-light leading-[1.75] md:text-[17px]',
            isDark ? 'text-prime-on/70' : 'text-prime-muted'
          )}
        >
          {lede}
        </p>
      ) : null}
      {actions ? <div className="mt-8">{actions}</div> : null}
    </div>
  );
}
