import { brand } from '../../theme/brand';
import { cn } from '../../utils/cn';

/** The logo in the theme's ink: dark artwork in light mode, light artwork in dark mode */
export default function BrandLogo({ className, alt = brand.name, loading }) {
  const common = { alt, width: 640, height: 228, loading };
  return (
    <>
      <img src={brand.logoDark} {...common} className={cn('dark:hidden', className)} />
      <img src={brand.logoLight} {...common} aria-hidden={alt ? undefined : true} className={cn('hidden dark:block', className)} />
    </>
  );
}
