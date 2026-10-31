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
          boutique: '#1E355E', // PMS 534C — Prime Boutique
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
      borderRadius: {
        btn: '0.625rem',
      },
      fontSize: {
        'display-2xl': [
          'clamp(2.85rem, 7.5vw, 7.25rem)',
          { lineHeight: '0.95', letterSpacing: '-0.04em', fontWeight: '200' },
        ],
        'display-xl': [
          'clamp(2.35rem, 5.4vw, 4.85rem)',
          { lineHeight: '1.0', letterSpacing: '-0.035em', fontWeight: '200' },
        ],
        'display-lg': [
          'clamp(2rem, 3.8vw, 3.5rem)',
          { lineHeight: '1.06', letterSpacing: '-0.03em', fontWeight: '300' },
        ],
        'display-md': [
          'clamp(1.5rem, 2.3vw, 2.15rem)',
          { lineHeight: '1.14', letterSpacing: '-0.02em', fontWeight: '300' },
        ],
      },
      boxShadow: {
        premium: '0 18px 48px rgba(35, 31, 32, 0.05)',
        'premium-lg': '0 28px 72px rgba(35, 31, 32, 0.09)',
      },
      transitionTimingFunction: {
        prime: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
