import { lazy, Suspense, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { isPreviewFrame } from '../context/SiteContext';

const ComingSoonPage = lazy(() => import('../pages/ComingSoonPage'));

const PREVIEW_KEY = 'prime.preview';
/** Open the real site on this browser with ?preview=prime-team; ?preview=off shows the coming-soon page again. */
const PREVIEW_CODE = 'prime-team';

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode: preview lasts for this page only */
  }
}

/**
 * Until launch, the public sees the coming-soon page on every page of the site.
 * The real site stays open for: the admin (/admin), the Website Builder preview, signed-in admins,
 * and anyone who opened it once with ?preview=prime-team. Set VITE_COMING_SOON=false to launch.
 */
export default function ComingSoonGate({ children }) {
  const { pathname, search } = useLocation();

  const showComingSoon = useMemo(() => {
    if (String(import.meta.env.VITE_COMING_SOON || '').toLowerCase() === 'false') return false;
    if (pathname.startsWith('/admin')) return false;
    if (isPreviewFrame()) return false;
    const preview = new URLSearchParams(search).get('preview');
    if (preview === PREVIEW_CODE) {
      writeStorage(PREVIEW_KEY, '1');
      return false;
    }
    if (preview === 'off') writeStorage(PREVIEW_KEY, null);
    if (readStorage(PREVIEW_KEY) === '1') return false;
    if (readStorage('prime_admin_token')) return false;
    return true;
  }, [pathname, search]);

  if (!showComingSoon) return children;
  return (
    <Suspense fallback={<div className="min-h-[100svh] bg-[#0f0d0a]" />}>
      <ComingSoonPage />
    </Suspense>
  );
}
