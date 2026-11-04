import { Link } from 'react-router-dom';
import PageBlocks from '../components/pageBuilder/Blocks';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import PageHero from '../components/ui/PageHero';
import Reveal from '../components/ui/Reveal';
import { useLocale } from '../context/LocaleContext';
import { useSite } from '../context/SiteContext';

const HERO = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2400&q=72';

export default function CareersPage() {
  const { t } = useLocale();
  const { site } = useSite();
  const careers = site.pages?.careers || {};
  const roles = careers.roles || [];

  return (
    <div>
      <Header overHero />
      <main>
        <PageHero image={careers.heroImage || HERO} eyebrow={t('careers.eyebrow')} title={t('careers.title')} lede={t('careers.lede')} />
        <PageBlocks
          page="careers"
          sections={{
            main: (
              <>

        <section className="prime-section">
          <div className="prime-container grid gap-14 lg:grid-cols-[0.8fr_1.6fr] lg:gap-24">
            <Reveal>
              <p className="prime-eyebrow text-prime-gold-deep">{t('careers.openRoles')}</p>
              <h2 className="mt-6 font-display text-display-md font-medium text-prime-ink">
                {roles.length ? t('careers.count', { count: roles.length }) : t('careers.none')}
              </h2>
              <p className="mt-5 text-[15px] font-light leading-relaxed text-prime-muted">{t('careers.body')}</p>
            </Reveal>

            <ul className="border-t border-prime-line">
              {roles.map((r, i) => (
                <Reveal as="li" key={`${r.title}-${i}`} delay={i * 80} className="border-b border-prime-line">
                  <Link
                    to="/contact"
                    className="group flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <h3 className="font-display text-[1.8rem] font-medium leading-tight text-prime-ink transition-colors group-hover:text-prime-gold-deep">
                        {r.title}
                      </h3>
                      <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.24em] text-prime-muted">
                        {[r.location, r.type].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className="prime-link">{t('careers.apply')}</span>
                  </Link>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
              </>
            ),
          }}
        />
      </main>
      <Footer />
    </div>
  );
}
