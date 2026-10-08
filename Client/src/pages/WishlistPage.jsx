import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import ListingCard, { ListingCardSkeleton } from '../components/ListingCard';
import PageHero from '../components/ui/PageHero';
import { useWishlist } from '../context/WishlistContext';
import { useLocale } from '../context/LocaleContext';
import api from '../api/client';

/** Saved stays live in this browser only (localStorage) — no guest account needed */
export default function WishlistPage() {
  const { ids } = useWishlist();
  const { t } = useLocale();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getListings()
      .then((res) => {
        if (!cancelled) setItems((res.items || []).filter((l) => ids.includes(l.id)));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  return (
    <div>
      <Header />
      <main>
        <PageHero eyebrow={t('wishlist.eyebrow')} title={t('wishlist.title')} lede={t('wishlist.lede')} />
        <section className="prime-container pb-28">
          {loading && ids.length ? (
            <div className="grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 xl:grid-cols-4">
              {ids.slice(0, 4).map((id) => (
                <ListingCardSkeleton key={id} />
              ))}
            </div>
          ) : !items.length ? (
            <div className="border-y border-prime-line px-6 py-20 text-center">
              <p className="font-display text-display-md font-medium text-prime-ink">{t('wishlist.emptyTitle')}</p>
              <p className="mx-auto mt-4 max-w-md text-[15px] font-light text-prime-muted">
                {t('wishlist.emptyBody')}
              </p>
              <Link to="/search" className="prime-btn mt-8">
                {t('about.explore')}
              </Link>
            </div>
          ) : (
            <div className="grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 xl:grid-cols-4">
              {items.map((u) => (
                <ListingCard key={u.id} listing={u} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
