import { useState } from 'react';
import PageBlocks from '../components/pageBuilder/Blocks';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import PageHero from '../components/ui/PageHero';
import Img from '../components/ui/Img';
import Reveal from '../components/ui/Reveal';
import api from '../api/client';
import { useLocale } from '../context/LocaleContext';
import { useSite } from '../context/SiteContext';

const HERO = 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2400&q=72';
const SIDE = 'https://images.unsplash.com/photo-1600121848594-d8644e57abab?auto=format&fit=crop&w=1400&q=72';

const FIELDS = [
  { key: 'name', placeholderKey: 'owners.name', required: true, autoComplete: 'name' },
  { key: 'email', placeholderKey: 'owners.email', required: true, type: 'email', autoComplete: 'email' },
  { key: 'phone', placeholderKey: 'owners.phone', required: true, type: 'tel', autoComplete: 'tel' },
  { key: 'location', placeholderKey: 'owners.location' },
];

export default function BecomeAHostPage() {
  const { t } = useLocale();
  const { site } = useSite();
  const images = site.pages?.owners || {};
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', location: '', details: '' });
  const steps = [1, 2, 3].map((n) => ({ title: t(`owners.step${n}Title`), body: t(`owners.step${n}Body`) }));

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      await api.sendPartnerInquiry(form);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Could not submit inquiry');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <Header overHero />
      <main>
        <PageHero image={images.heroImage || HERO} editImage="owners.heroImage" eyebrow={t('owners.eyebrow')} title={t('owners.title')} lede={t('owners.lede')}>
          <a href="#inquiry" className="prime-btn-ghost prime-fade-up mt-10" style={{ animationDelay: '240ms' }}>
            {t('owners.cta')}
          </a>
        </PageHero>
        <PageBlocks
          page="owners"
          sections={{
            main: (
              <>

        <section className="prime-section">
          <div className="prime-container">
            <Reveal className="mb-14 max-w-2xl md:mb-20">
              <p className="prime-eyebrow text-prime-gold-deep">{t('owners.howEyebrow')}</p>
              <h2 className="mt-6 font-display text-display-lg font-medium text-prime-ink text-balance">{t('owners.howTitle')}</h2>
            </Reveal>
            <div className="grid gap-0 md:grid-cols-3">
              {steps.map((s, i) => (
                <Reveal
                  key={i}
                  delay={i * 110}
                  className="border-t border-prime-line py-10 md:border-e md:px-10 md:first:ps-0 md:last:border-e-0"
                >
                  <span className="font-display text-[3.5rem] font-medium leading-none text-prime-gold/70">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-6 font-display text-[1.7rem] font-medium text-prime-ink">{s.title}</h3>
                  <p className="mt-3 text-[15px] font-light leading-[1.8] text-prime-muted">{s.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="inquiry" className="scroll-mt-[var(--prime-header-h)] bg-prime-mist">
          <div className="grid lg:grid-cols-2">
            <div className="relative hidden min-h-[640px] lg:block">
              <Img data-edit-image="page:owners.sideImage" src={images.sideImage || SIDE} alt="" sizes="50vw" className="absolute inset-0 h-full w-full object-cover" />
            </div>
            <div className="px-5 py-20 sm:px-8 md:py-28 lg:px-16 xl:px-24">
              {sent ? (
                <Reveal className="max-w-lg">
                  <p className="prime-eyebrow text-prime-gold-deep">{t('owners.received')}</p>
                  <h2 className="mt-5 font-display text-display-lg font-medium text-prime-ink">{t('owners.thanks')}</h2>
                  <p className="prime-lede mt-6">{t('owners.thanksBody')}</p>
                </Reveal>
              ) : (
                <Reveal className="max-w-lg">
                  <p className="prime-eyebrow text-prime-gold-deep">{t('owners.inquiryEyebrow')}</p>
                  <h2 className="mt-5 font-display text-display-lg font-medium text-prime-ink">{t('owners.formTitle')}</h2>
                  <p className="prime-lede mt-5">{t('owners.formBody')}</p>
                  <form onSubmit={onSubmit} className="mt-10 space-y-2">
                    {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
                    {FIELDS.map((f) => (
                      <label key={f.key} className="block">
                        <span className="sr-only">{t(f.placeholderKey)}</span>
                        <input
                          required={f.required}
                          type={f.type || 'text'}
                          autoComplete={f.autoComplete}
                          className="prime-field"
                          placeholder={t(f.placeholderKey)}
                          value={form[f.key]}
                          onChange={(e) => setField(f.key, e.target.value)}
                        />
                      </label>
                    ))}
                    <label className="block">
                      <span className="sr-only">{t('owners.details')}</span>
                      <textarea
                        rows={4}
                        className="prime-field resize-y"
                        placeholder={t('owners.details')}
                        value={form.details}
                        onChange={(e) => setField('details', e.target.value)}
                      />
                    </label>
                    <div className="pt-8">
                      <button type="submit" disabled={sending} className="prime-btn w-full sm:w-auto">
                        {sending ? t('owners.sending') : t('owners.submit')}
                      </button>
                    </div>
                  </form>
                </Reveal>
              )}
            </div>
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
