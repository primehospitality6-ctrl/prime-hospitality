import { brand } from '../theme/brand';
import { useLocale } from '../context/LocaleContext';

export default function RouteFallback() {
  const { t } = useLocale();
  return (
    <div className="flex min-h-vh-100 items-center justify-center bg-prime-sand" role="status" aria-label={t('common.loading')}>
      <img
        src={brand.logoDark}
        alt=""
        width="180"
        height="64"
        className="h-12 w-auto animate-pulse object-contain opacity-70 dark:hidden"
      />
      <img
        src={brand.logoLight}
        alt=""
        width="180"
        height="64"
        className="hidden h-12 w-auto animate-pulse object-contain opacity-70 dark:block"
      />
    </div>
  );
}
