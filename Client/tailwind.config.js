/** Theme colour from a CSS variable that still supports `/60`-style opacity modifiers. */
const themed =
  (name) =>
  ({ opacityValue } = {}) =>
    opacityValue === undefined || opacityValue === '1'
      ? `var(${name})`
      : `color-mix(in srgb, var(${name}) calc(${opacityValue} * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // Legacy *-opacity-* utilities would wrap every theme colour in color-mix()
  corePlugins: {
    backgroundOpacity: false,
    textOpacity: false,
    borderOpacity: false,
    divideOpacity: false,
    placeholderOpacity: false,
    ringOpacity: false,
  },
  theme: {
    extend: {
      colors: {
        prime: {
          // --prime-fg flips in dark; --prime-night stays brand-dark for bands
          ink: themed('--prime-fg'),
          night: themed('--prime-night'),
          charcoal: themed('--prime-charcoal'),
          gold: themed('--prime-gold'),
          'gold-soft': themed('--prime-gold-soft'),
          'gold-deep': themed('--prime-gold-deep'),
          muted: themed('--prime-muted'),
          line: themed('--prime-line'),
          sand: themed('--prime-sand'),
          mist: themed('--prime-mist'),
          dune: themed('--prime-dune'),
          surface: themed('--prime-surface'),
          white: themed('--prime-white'),
        },
        // Sub-brand colours from the corporate identity guidelines (Pantone → RGB)
        brand: {
          gold: '#8C704D', // PMS 874C — the key in the logo
          black: '#231F20', // Black 100% — Prime Hospitality
          residence: '#58595B', // Black 80% — Prime Residence
          select: '#8C2433', // PMS 202C — Prime Select
          inn: '#00671B', // PMS 7728C — Prime Inn
          cowork: '#1E355E', // PMS 534C — Prime Co-Work
          holidays: '#005D67', // PMS 5473C — Prime Holidays
        },
      },
      fontFamily: {
        // Montserrat is the corporate typeface for every English text; GE Thameen's
        // stand-in for Arabic is Noto Kufi Arabic.
        display: ['"Montserrat Variable"', 'Montserrat', '"Noto Kufi Arabic"', 'system-ui', 'sans-serif'],
        sans: ['"Montserrat Variable"', 'Montserrat', '"Noto Kufi Arabic"', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        prime: '1440px',
      },
      // Viewport heights divided by the large-screen zoom (see index.css)
      minHeight: {
        screen: 'calc(100vh / var(--ui-zoom, 1))',
        'vh-100': 'calc(100svh / var(--ui-zoom, 1))',
        'vh-72': 'calc(72svh / var(--ui-zoom, 1))',
        'vh-78': 'calc(78svh / var(--ui-zoom, 1))',
      },
      height: {
        'dvh-100': 'calc(100dvh / var(--ui-zoom, 1))',
        'dvh-modal': 'min(54rem, calc(100dvh / var(--ui-zoom, 1) - 3rem))',
      },
      maxHeight: {
        'dvh-90': 'calc(90dvh / var(--ui-zoom, 1))',
      },
      letterSpacing: {
        brand: '0.32em',
        premium: '0.2em',
      },
      fontSize: {
        'display-2xl': [
          'clamp(2.6rem, 7vw, 6.5rem)',
          { lineHeight: '0.98', letterSpacing: '-0.035em', fontWeight: '300' },
        ],
        'display-xl': [
          'clamp(2.2rem, 5vw, 4.4rem)',
          { lineHeight: '1.02', letterSpacing: '-0.03em', fontWeight: '300' },
        ],
        'display-lg': [
          'clamp(1.9rem, 3.6vw, 3.2rem)',
          { lineHeight: '1.08', letterSpacing: '-0.025em', fontWeight: '300' },
        ],
        'display-md': [
          'clamp(1.45rem, 2.2vw, 2rem)',
          { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '400' },
        ],
      },
      boxShadow: {
        premium: '0 24px 60px rgba(35, 31, 32, 0.08)',
        'premium-lg': '0 32px 80px rgba(35, 31, 32, 0.14)',
      },
      transitionTimingFunction: {
        prime: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
