import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  ChartColumn,
  ClipboardList,
  ExternalLink,
  FileText,
  Home,
  ImageIcon,
  LayoutDashboard,
  LayoutTemplate,
  Link2,
  ListChecks,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  MessageSquareText,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PanelTop,
  RefreshCw,
  Search,
  Store,
  X,
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { cn } from '../../utils/cn';
import { ToastProvider } from './kit';

/** Grouped like the PMS sidebar: inventory mirrors Kwentra, website + marketing are site-only */
const NAV_SECTIONS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
      { to: '/admin/bookings', label: 'Bookings', icon: ClipboardList },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    items: [
      { to: '/admin/destinations', label: 'Destinations', icon: MapPin },
      { to: '/admin/compounds', label: 'Properties', icon: Building2 },
      { to: '/admin/units', label: 'Unit types', icon: Home },
      { to: '/admin/sync', label: 'Kwentra sync', icon: RefreshCw },
    ],
  },
  {
    id: 'website',
    label: 'Website',
    items: [
      { to: '/admin/homepage', label: 'Homepage', icon: LayoutTemplate },
      { to: '/admin/brands', label: 'Brands', icon: Palette },
      { to: '/admin/slideshow', label: 'Hero slideshow', icon: ImageIcon },
      { to: '/admin/pages', label: 'Pages & text', icon: FileText },
      { to: '/admin/content', label: 'FAQs & lists', icon: ListChecks },
    ],
  },
  {
    id: 'growth',
    label: 'Marketing',
    items: [
      { to: '/admin/marketing', end: true, label: 'Overview', icon: Megaphone },
      { to: '/admin/marketing/announcement', label: 'Announcement bar', icon: PanelTop },
      { to: '/admin/marketing/popup', label: 'Pop-up', icon: MessageSquareText },
      { to: '/admin/marketing/seo', label: 'SEO & sharing', icon: Search },
      { to: '/admin/marketing/tracking', label: 'Tracking & pixels', icon: ChartColumn },
      { to: '/admin/marketing/campaigns', label: 'Campaign links', icon: Link2 },
      { to: '/admin/settings', label: 'Business info', icon: Store },
    ],
  },
];

const COLLAPSE_KEY = 'prime.admin.sidebar';

function NavItems({ collapsed, onNavigate }) {
  return NAV_SECTIONS.map((section, i) => (
    <div key={section.id} className={cn(i > 0 && 'mt-5')}>
      {collapsed ? (
        i > 0 ? <div className="mx-3 mb-3 border-t border-prime-line" /> : null
      ) : (
        <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-prime-muted/80">{section.label}</p>
      )}
      <div className="flex flex-col gap-0.5">
        {section.items.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 py-2.5 text-[12px] font-semibold tracking-[0.04em] transition',
                collapsed ? 'justify-center px-0' : 'px-3',
                isActive ? 'bg-prime-night text-prime-sand' : 'text-prime-muted hover:bg-prime-mist hover:text-prime-ink'
              )
            }
          >
            <Icon size={16} strokeWidth={1.75} className="shrink-0" />
            {collapsed ? null : label}
          </NavLink>
        ))}
      </div>
    </div>
  ));
}

export default function AdminLayout() {
  const { user, logout } = useAdminAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function signOut() {
    logout();
    navigate('/admin/login');
  }

  const brandBlock = (
    <div className={cn('flex items-center', collapsed ? 'justify-center' : 'px-3')}>
      {collapsed ? (
        <span className="font-display text-xl font-bold">P</span>
      ) : (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-prime-muted">Prime Hospitality</p>
          <p className="mt-0.5 font-display text-lg font-bold tracking-[-0.02em]">Admin</p>
        </div>
      )}
    </div>
  );

  const footerBlock = (
    <div className="border-t border-prime-line pt-4">
      {collapsed ? null : <p className="truncate px-3 text-xs text-prime-muted">{user?.username || user?.email}</p>}
      <button
        type="button"
        onClick={signOut}
        title={collapsed ? 'Sign out' : undefined}
        className={cn(
          'mt-2 flex w-full items-center gap-2 py-2 text-[12px] font-semibold text-prime-ink transition hover:bg-prime-mist',
          collapsed ? 'justify-center' : 'px-3'
        )}
      >
        <LogOut size={15} /> {collapsed ? null : 'Sign out'}
      </button>
    </div>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-prime-mist text-prime-ink">
        <aside
          className={cn(
            'fixed inset-y-0 start-0 z-40 hidden flex-col border-e border-prime-line bg-prime-surface py-5 transition-[width] duration-300 lg:flex',
            collapsed ? 'w-16 px-2' : 'w-64 px-3'
          )}
        >
          {brandBlock}
          <nav className="mt-7 flex-1 overflow-y-auto">
            <NavItems collapsed={collapsed} />
          </nav>
          {footerBlock}
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <aside className="relative flex h-full w-72 flex-col bg-prime-surface px-3 py-5 shadow-2xl">
              <div className="flex items-center justify-between">
                {brandBlock}
                <button type="button" onClick={() => setMobileOpen(false)} className="grid h-9 w-9 place-items-center" aria-label="Close menu">
                  <X size={18} />
                </button>
              </div>
              <nav className="mt-7 flex-1 overflow-y-auto">
                <NavItems collapsed={false} onNavigate={() => setMobileOpen(false)} />
              </nav>
              {footerBlock}
            </aside>
          </div>
        ) : null}

        <div className={cn('transition-[padding] duration-300', collapsed ? 'lg:ps-16' : 'lg:ps-64')}>
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-prime-line bg-prime-surface/90 px-4 backdrop-blur-md sm:px-8">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="grid h-9 w-9 place-items-center border border-prime-line lg:hidden"
                aria-label="Open menu"
              >
                <Menu size={17} />
              </button>
              <button
                type="button"
                onClick={() => setCollapsed((v) => !v)}
                className="hidden h-9 w-9 place-items-center text-prime-muted hover:text-prime-ink lg:grid"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
              </button>
              <span className="border border-prime-gold/40 bg-prime-gold/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-gold-deep">
                Website admin · PMS is Kwentra
              </span>
            </div>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-prime-ink hover:text-prime-gold-deep"
            >
              View site <ExternalLink size={13} />
            </a>
          </header>
          <main className="mx-auto min-w-0 max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
