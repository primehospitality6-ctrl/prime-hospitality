import { useEffect } from 'react';
import { brand, whatsappHref, whatsappLines } from '../theme/brand';
import { useSite } from '../context/SiteContext';
import { useLocale } from '../context/LocaleContext';

const COPY = {
  en: {
    eyebrow: 'Prime Hospitality',
    title: ["We're", 'Preparing', 'Something', 'Big'],
    body: 'A new way to book your Prime stay is almost here. Thank you for your patience. We will be live very soon.',
    soon: 'Launching soon',
    ask: 'Have an inquiry? We are on WhatsApp.',
    cta: 'Chat with us on WhatsApp',
    message: 'Hi Prime, I have an inquiry.',
    lang: 'عربي',
  },
  ar: {
    eyebrow: 'برايم للضيافة',
    title: ['نُحضّر', 'لشيء', 'كبير'],
    body: 'طريقة جديدة لحجز إقامتك مع برايم أصبحت قريبة جداً. شكراً لصبركم، سنكون متاحين قريباً.',
    soon: 'قريباً',
    ask: 'لديك استفسار؟ تواصل معنا عبر واتساب.',
    cta: 'تواصل معنا عبر واتساب',
    message: 'مرحباً برايم، لدي استفسار.',
    lang: 'English',
  },
};

function WhatsAppIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.91-7.01Zm-7.01 15.24h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.29Z"
      />
    </svg>
  );
}

/**
 * Coming-soon landing page shown to the public until launch.
 * Dark and gold, with a slow light show, a word-by-word headline reveal and a WhatsApp button.
 */
export default function ComingSoonPage() {
  useSite(); // re-render once the business settings (WhatsApp number) arrive
  const { locale, toggleLocale } = useLocale();
  const copy = COPY[locale === 'ar' ? 'ar' : 'en'];
  const line = whatsappLines()[0];
  const href = whatsappHref(copy.message, line?.number || brand.whatsapp);

  useEffect(() => {
    const prev = document.title;
    document.title = `${brand.name || 'Prime Hospitality'} — ${COPY.en.soon}`;
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <main dir={locale === 'ar' ? 'rtl' : 'ltr'} className="cs-root relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-[#0f0d0a] text-white">
      <style>{CSS}</style>

      {/* Light show */}
      <div className="cs-orb cs-orb-1" aria-hidden />
      <div className="cs-orb cs-orb-2" aria-hidden />
      <div className="cs-orb cs-orb-3" aria-hidden />
      <div className="cs-grid" aria-hidden />
      <div className="cs-grain" aria-hidden />
      <div className="cs-particles" aria-hidden>
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} style={{ '--i': i, '--x': `${(i * 53) % 100}%`, '--d': `${9 + (i % 6) * 2.2}s`, '--s': `${2 + (i % 3)}px` }} />
        ))}
      </div>

      <header className="relative z-10 flex items-center justify-between px-5 pt-6 sm:px-10 sm:pt-8">
        <img src={brand.logoLight} alt={brand.name} width="640" height="228" className="cs-fade h-7 w-auto sm:h-9" style={{ '--delay': '0.1s' }} />
        <button
          type="button"
          onClick={toggleLocale}
          className="cs-fade rounded-full border border-white/15 px-4 py-2 text-[12px] font-medium tracking-wide text-white/80 backdrop-blur transition hover:border-white/40 hover:text-white"
          style={{ '--delay': '0.2s' }}
        >
          {copy.lang}
        </button>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-5 py-16 text-center sm:px-10">
        <p className="cs-fade inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.42em] text-[#d9bf94]" style={{ '--delay': '0.3s' }}>
          <span className="cs-line" aria-hidden />
          {copy.eyebrow}
          <span className="cs-line" aria-hidden />
        </p>

        <h1 className="mt-7 font-display text-[clamp(2.6rem,9vw,6.75rem)] font-extralight leading-[1.02] tracking-[-0.035em]">
          {copy.title.map((word, i) => (
            <span key={`${locale}-${word}`} className="cs-word-wrap">
              <span className={`cs-word ${i === copy.title.length - 1 ? 'cs-gold' : ''}`} style={{ '--delay': `${0.45 + i * 0.16}s` }}>
                {word}
              </span>
            </span>
          ))}
        </h1>

        <p className="cs-fade mt-8 max-w-xl text-[15px] font-light leading-[1.85] text-white/65 sm:text-[17px]" style={{ '--delay': '1.2s' }}>
          {copy.body}
        </p>

        <div className="cs-fade mt-10 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.3em] text-white/50" style={{ '--delay': '1.4s' }}>
          <span className="cs-dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          {copy.soon}
        </div>

        <div className="cs-fade mt-14 flex flex-col items-center gap-4" style={{ '--delay': '1.6s' }}>
          <p className="text-[14px] text-white/70">{copy.ask}</p>
          <a href={href} target="_blank" rel="noopener noreferrer" className="cs-wa group">
            <span className="cs-wa-pulse" aria-hidden />
            <WhatsAppIcon className="relative h-5 w-5" />
            <span className="relative">{copy.cta}</span>
          </a>
          {line?.number ? (
            <a href={href} target="_blank" rel="noopener noreferrer" dir="ltr" className="text-[13px] tabular-nums text-white/45 transition hover:text-white/80">
              {line.number}
            </a>
          ) : null}
        </div>
      </section>

      <footer className="cs-fade relative z-10 px-5 pb-7 text-center text-[11px] tracking-[0.2em] text-white/30 sm:pb-9" style={{ '--delay': '1.8s' }}>
        © {new Date().getFullYear()} {brand.name || 'Prime Hospitality'}
      </footer>
    </main>
  );
}

const CSS = `
.cs-root { font-family: inherit; }
.cs-orb { position:absolute; border-radius:50%; filter:blur(90px); opacity:.55; z-index:-1; will-change:transform; }
.cs-orb-1 { width:46vmax; height:46vmax; left:-14vmax; top:-16vmax; background:radial-gradient(circle,#8c704d 0%,transparent 65%); animation:cs-float1 18s ease-in-out infinite; }
.cs-orb-2 { width:40vmax; height:40vmax; right:-12vmax; bottom:-14vmax; background:radial-gradient(circle,#5e4a31 0%,transparent 65%); animation:cs-float2 22s ease-in-out infinite; }
.cs-orb-3 { width:26vmax; height:26vmax; left:50%; top:46%; margin:-13vmax 0 0 -13vmax; background:radial-gradient(circle,rgba(217,191,148,.35) 0%,transparent 65%); animation:cs-breathe 9s ease-in-out infinite; }
.cs-grid { position:absolute; inset:0; z-index:-1; opacity:.07;
  background-image:linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px);
  background-size:72px 72px; mask-image:radial-gradient(ellipse at center,#000 10%,transparent 70%); -webkit-mask-image:radial-gradient(ellipse at center,#000 10%,transparent 70%);
  animation:cs-grid 40s linear infinite; }
.cs-grain { position:absolute; inset:-50%; z-index:-1; opacity:.06; pointer-events:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
  animation:cs-grain 1.2s steps(4) infinite; }
.cs-particles { position:absolute; inset:0; z-index:-1; overflow:hidden; pointer-events:none; }
.cs-particles span { position:absolute; bottom:-10px; left:var(--x); width:var(--s); height:var(--s); border-radius:50%;
  background:#d9bf94; box-shadow:0 0 10px 2px rgba(217,191,148,.6); opacity:0;
  animation:cs-rise var(--d) linear infinite; animation-delay:calc(var(--i) * -0.9s); }
.cs-fade { opacity:0; animation:cs-fade-up .9s cubic-bezier(.2,.8,.2,1) forwards; animation-delay:var(--delay,0s); }
.cs-word-wrap { display:inline-block; overflow:hidden; padding:0 .04em .08em; vertical-align:top; }
.cs-word-wrap + .cs-word-wrap { margin-inline-start:.22em; }
.cs-word { display:inline-block; transform:translateY(105%); animation:cs-word 1s cubic-bezier(.2,.8,.2,1) forwards; animation-delay:var(--delay,0s); }
.cs-gold { font-weight:500; background:linear-gradient(100deg,#b8996b 0%,#f3e2b8 40%,#b8996b 60%,#8c704d 100%); background-size:220% 100%;
  -webkit-background-clip:text; background-clip:text; color:transparent;
  animation:cs-word 1s cubic-bezier(.2,.8,.2,1) forwards, cs-shine 5s ease-in-out 1.6s infinite; animation-delay:var(--delay,0s), 1.6s; }
.cs-line { display:inline-block; width:34px; height:1px; background:linear-gradient(90deg,transparent,#d9bf94,transparent); }
.cs-dots { display:inline-flex; gap:5px; }
.cs-dots i { width:5px; height:5px; border-radius:50%; background:#d9bf94; animation:cs-dot 1.4s ease-in-out infinite; }
.cs-dots i:nth-child(2) { animation-delay:.2s; } .cs-dots i:nth-child(3) { animation-delay:.4s; }
.cs-wa { position:relative; display:inline-flex; align-items:center; gap:10px; min-height:54px; padding:0 28px; border-radius:999px;
  background:#25d366; color:#06281a; font-weight:600; font-size:15px; letter-spacing:.01em;
  box-shadow:0 14px 34px -12px rgba(37,211,102,.65); transition:transform .25s ease, box-shadow .25s ease; }
.cs-wa:hover { transform:translateY(-2px); box-shadow:0 18px 40px -12px rgba(37,211,102,.8); }
.cs-wa:active { transform:translateY(0); }
.cs-wa-pulse { position:absolute; inset:0; border-radius:inherit; border:2px solid #25d366; animation:cs-pulse 2.4s ease-out infinite; }
@keyframes cs-float1 { 0%,100% { transform:translate(0,0) scale(1); } 50% { transform:translate(8vmax,6vmax) scale(1.1); } }
@keyframes cs-float2 { 0%,100% { transform:translate(0,0) scale(1); } 50% { transform:translate(-7vmax,-5vmax) scale(1.15); } }
@keyframes cs-breathe { 0%,100% { transform:scale(.85); opacity:.35; } 50% { transform:scale(1.15); opacity:.7; } }
@keyframes cs-grid { to { background-position:72px 72px, 72px 72px; } }
@keyframes cs-grain { 0% { transform:translate(0,0); } 25% { transform:translate(-5%,3%); } 50% { transform:translate(4%,-4%); } 75% { transform:translate(-3%,-2%); } 100% { transform:translate(0,0); } }
@keyframes cs-rise { 0% { transform:translateY(0) scale(.6); opacity:0; } 12% { opacity:.9; } 80% { opacity:.5; } 100% { transform:translateY(-105vh) scale(1.2); opacity:0; } }
@keyframes cs-fade-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
@keyframes cs-word { to { transform:translateY(0); } }
@keyframes cs-shine { 0%,100% { background-position:100% 0; } 50% { background-position:0 0; } }
@keyframes cs-dot { 0%,80%,100% { transform:scale(.5); opacity:.3; } 40% { transform:scale(1); opacity:1; } }
@keyframes cs-pulse { 0% { transform:scale(1); opacity:.7; } 100% { transform:scale(1.35,1.6); opacity:0; } }
@media (prefers-reduced-motion: reduce) {
  .cs-orb, .cs-grid, .cs-grain, .cs-particles span, .cs-dots i, .cs-wa-pulse { animation:none !important; }
  .cs-fade, .cs-word { animation:none !important; opacity:1; transform:none; }
  .cs-gold { animation:none !important; }
}
`;
