import flattenColorPalette from 'tailwindcss/lib/util/flattenColorPalette'

// Exposes every Tailwind color as a global CSS variable (e.g. var(--blue-500)),
// required by the AuroraBackground component.
function addVariablesForColors({ addBase, theme }) {
  const allColors = flattenColorPalette(theme('colors'))
  const newVars = Object.fromEntries(
    Object.entries(allColors).map(([key, val]) => [`--${key}`, val]),
  )
  addBase({ ':root': newVars })
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#04100E',
          900: '#061613',
          800: '#0A201C',
          700: '#0E2A25',
        },
        teal: {
          50: '#EAFBF7',
          100: '#CFF6ED',
          200: '#9FEEDD',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0B766D',
        },
        gold: {
          200: '#FCE4A6',
          300: '#F7CF72',
          400: '#F2B53B',
          500: '#E09E1F',
          600: '#C0820F',
        },
        cream: '#E9F4F1',
        mute: '#8AA8A1',
      },
      fontFamily: {
        display: ['"Cabinet Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['"Switzer"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.02em',
      },
      maxWidth: {
        page: '1200px',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(45,212,191,0.18), 0 30px 80px -40px rgba(45,212,191,0.55)',
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 30px 60px -30px rgba(0,0,0,0.8)',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        aurora: {
          from: { backgroundPosition: '50% 50%, 50% 50%' },
          to: { backgroundPosition: '350% 50%, 350% 50%' },
        },
      },
      animation: {
        marquee: 'marquee 32s linear infinite',
        floaty: 'floaty 6s ease-in-out infinite',
        pulseRing: 'pulseRing 2.4s ease-out infinite',
        aurora: 'aurora 25s linear infinite',
      },
    },
  },
  plugins: [addVariablesForColors],
}
