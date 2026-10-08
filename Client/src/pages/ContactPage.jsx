import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import PageHero from '../components/ui/PageHero';
import Reveal from '../components/ui/Reveal';
import { brand, whatsappHref } from '../theme/brand';
import api from '../api/client';
import { useLocale } from '../context/LocaleContext';
import { useSite } from '../context/SiteContext';

export default function ContactPage() {
  const { t, term } = useLocale();
  useSite();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      await api.sendContact({ name, email, message });
      setSent(true);
    } catch (err) {
      setError(err.message || 'Could not send message');
    } finally {
      setSending(false);
    }
  }

  const channels = [
    { label: t('common.whatsapp'), value: t('contact.whatsappValue'), href: whatsappHref(`Hi ${brand.shortName} — I have a question.`), external: true },
    { label: t('contact.email'), value: brand.email, href: `mailto:${brand.email}` },
    { label: t('contact.phone'), value: brand.phoneDisplay, href: `tel:${brand.phone || brand.whatsapp}` },
    { label: t('contact.office'), value: term(brand.address) },
  ];

  return (
    <div>
      <Header />
      <main>
        <PageHero eyebrow={t('contact.eyebrow')} title={t('contact.title')} lede={t('contact.lede')} />

        <section className="prime-container grid gap-16 pb-28 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
          <Reveal as="ul" className="border-t border-prime-line">
            {channels.map((c) => {
              const inner = (
                <>
                  <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-prime-muted">{c.label}</span>
                  <span className="mt-2 flex items-center justify-between gap-4 font-display text-[1.45rem] font-medium text-prime-ink sm:text-[1.6rem]">
                    <span className="min-w-0 [overflow-wrap:anywhere]">{c.value}</span>
                    {c.href ? (
                      <ArrowUpRight size={20} strokeWidth={1.25} className="shrink-0 text-prime-muted transition group-hover:text-prime-gold-deep rtl:-scale-x-100" />
                    ) : null}
                  </span>
                </>
              );
              return (
                <li key={c.label} className="border-b border-prime-line">
                  {c.href ? (
                    <a
                      href={c.href}
                      target={c.external ? '_blank' : undefined}
                      rel={c.external ? 'noreferrer' : undefined}
                      className="group flex flex-col py-7"
                    >
                      {inner}
                    </a>
                  ) : (
                    <div className="flex flex-col py-7">{inner}</div>
                  )}
                </li>
              );
            })}
          </Reveal>

          <Reveal delay={120}>
            {sent ? (
              <div className="bg-prime-mist p-10 md:p-14">
                <p className="prime-eyebrow text-prime-gold-deep">{t('contact.received')}</p>
                <p className="mt-5 font-display text-display-md font-medium text-prime-ink">{t('contact.thanks')}</p>
                <p className="mt-4 text-[15px] font-light text-prime-muted">{t('contact.thanksBody')}</p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="bg-prime-surface p-8 shadow-premium md:p-12">
                <p className="font-display text-[2rem] font-medium text-prime-ink">{t('contact.formTitle')}</p>
                {error ? <p className="mt-4 text-sm text-red-700" role="alert">{error}</p> : null}
                <div className="mt-6 space-y-2">
                  <label className="block">
                    <span className="sr-only">{t('contact.name')}</span>
                    <input
                      required
                      autoComplete="name"
                      className="prime-field"
                      placeholder={t('contact.name')}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="sr-only">{t('contact.emailPlaceholder')}</span>
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      className="prime-field"
                      placeholder={t('contact.emailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="sr-only">{t('contact.message')}</span>
                    <textarea
                      required
                      rows={5}
                      className="prime-field resize-y"
                      placeholder={t('contact.message')}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </label>
                </div>
                <button type="submit" disabled={sending} className="prime-btn mt-10 w-full sm:w-auto">
                  {sending ? t('contact.sending') : t('contact.send')}
                </button>
              </form>
            )}
          </Reveal>
        </section>
      </main>
      <Footer />
    </div>
  );
}
