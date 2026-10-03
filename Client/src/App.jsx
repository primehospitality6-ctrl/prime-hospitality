import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { LocaleProvider } from './context/LocaleContext';
import { SiteProvider } from './context/SiteContext';
import { ThemeProvider } from './context/ThemeContext';
import { WishlistProvider } from './context/WishlistContext';
import RouteFallback from './components/RouteFallback';
import WhatsAppFAB from './components/layout/WhatsAppFAB';
import MarketingPixels from './components/MarketingPixels';
import SeoManager from './components/SeoManager';
import PromoPopup from './components/PromoPopup';
import AdminGuard from './components/admin/AdminGuard';
import AdminLayout from './components/admin/AdminLayout';

const HomePage = lazy(() => import('./pages/HomePage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const ListingDetailPage = lazy(() => import('./pages/ListingDetailPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const BookingSuccessPage = lazy(() => import('./pages/BookingSuccessPage'));
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const CareersPage = lazy(() => import('./pages/CareersPage'));
const AboutPage = lazy(() =>
  import('./pages/StaticPages').then((m) => ({ default: m.AboutPage }))
);
const CompoundsPage = lazy(() => import('./pages/PropertiesPage'));
const FaqPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.FaqPage })));
const TermsPage = lazy(() =>
  import('./pages/StaticPages').then((m) => ({
    default: () => <m.LegalPage kind="terms" />,
  }))
);
const PrivacyPage = lazy(() =>
  import('./pages/StaticPages').then((m) => ({
    default: () => <m.LegalPage kind="privacy" />,
  }))
);
const RefundPage = lazy(() =>
  import('./pages/StaticPages').then((m) => ({
    default: () => <m.LegalPage kind="refund-policy" />,
  }))
);
const ContactPage = lazy(() => import('./pages/ContactPage'));
const BecomeAHostPage = lazy(() => import('./pages/BecomeAHostPage'));

const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminSlideshowPage = lazy(() => import('./pages/admin/AdminSlideshowPage'));
const AdminDestinationsPage = lazy(() => import('./pages/admin/AdminDestinationsPage'));
const AdminCompoundsPage = lazy(() => import('./pages/admin/AdminCompoundsPage'));
const AdminUnitsPage = lazy(() => import('./pages/admin/AdminUnitsPage'));
const AdminBookingsPage = lazy(() => import('./pages/admin/AdminBookingsPage'));
const MarketingOverviewPage = lazy(() => import('./pages/admin/marketing/MarketingOverviewPage'));
const MarketingAnnouncementPage = lazy(() => import('./pages/admin/marketing/MarketingAnnouncementPage'));
const MarketingPopupPage = lazy(() => import('./pages/admin/marketing/MarketingPopupPage'));
const MarketingSeoPage = lazy(() => import('./pages/admin/marketing/MarketingSeoPage'));
const MarketingTrackingPage = lazy(() => import('./pages/admin/marketing/MarketingTrackingPage'));
const MarketingCampaignsPage = lazy(() => import('./pages/admin/marketing/MarketingCampaignsPage'));
const AdminSyncPage = lazy(() => import('./pages/admin/AdminSyncPage'));
const AdminHomepagePage = lazy(() => import('./pages/admin/AdminHomepagePage'));
const AdminPagesPage = lazy(() => import('./pages/admin/AdminPagesPage'));
const AdminContentListsPage = lazy(() => import('./pages/admin/AdminContentListsPage'));
const AdminBusinessPage = lazy(() => import('./pages/admin/AdminBusinessPage'));

export default function App() {
  return (
    <AdminAuthProvider>
      <BrowserRouter>
        <SiteProvider>
        <LocaleProvider>
          <ThemeProvider>
            <WishlistProvider>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/home" element={<Navigate to="/" replace />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/listings/:slug" element={<ListingDetailPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/booking-success" element={<BookingSuccessPage />} />
                  <Route path="/sign-in" element={<Navigate to="/admin/login" replace />} />
                  <Route path="/wishlist" element={<WishlistPage />} />
                  <Route path="/careers" element={<CareersPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/compounds" element={<CompoundsPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/faq" element={<FaqPage />} />
                  <Route path="/owners" element={<BecomeAHostPage />} />
                  <Route path="/host-onboarding" element={<BecomeAHostPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/refund-policy" element={<RefundPage />} />

                  <Route path="/admin/login" element={<AdminLoginPage />} />
                  <Route path="/admin" element={<AdminGuard />}>
                    <Route element={<AdminLayout />}>
                      <Route index element={<AdminDashboardPage />} />
                      <Route path="slideshow" element={<AdminSlideshowPage />} />
                      <Route path="destinations" element={<AdminDestinationsPage />} />
                      <Route path="compounds" element={<AdminCompoundsPage />} />
                      <Route path="units" element={<AdminUnitsPage />} />
                      <Route path="sync" element={<AdminSyncPage />} />
                      <Route path="bookings" element={<AdminBookingsPage />} />
                      <Route path="homepage" element={<AdminHomepagePage />} />
                      <Route path="pages" element={<AdminPagesPage />} />
                      <Route path="content" element={<AdminContentListsPage />} />
                      <Route path="marketing" element={<MarketingOverviewPage />} />
                      <Route path="marketing/announcement" element={<MarketingAnnouncementPage />} />
                      <Route path="marketing/popup" element={<MarketingPopupPage />} />
                      <Route path="marketing/seo" element={<MarketingSeoPage />} />
                      <Route path="marketing/tracking" element={<MarketingTrackingPage />} />
                      <Route path="marketing/campaigns" element={<MarketingCampaignsPage />} />
                      <Route path="settings" element={<AdminBusinessPage />} />
                    </Route>
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
              <MarketingPixels />
              <SeoManager />
              <PromoPopup />
              <WhatsAppFAB />
            </WishlistProvider>
          </ThemeProvider>
        </LocaleProvider>
        </SiteProvider>
      </BrowserRouter>
    </AdminAuthProvider>
  );
}
