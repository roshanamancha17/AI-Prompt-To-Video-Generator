import type { Config } from 'tailwindcss';

// Design direction: "editing bay" — a production-studio feel (Notion x Canva x Linear),
// built around a slate/ink surface, a warm signal-amber for attention states, and a
// cool mint-cyan for "ready/approved" states — evoking a film review suite rather than
// a generic SaaS dashboard.
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0B0E11',
          900: '#12161A',
          800: '#1A1F24',
          700: '#242A31',
          600: '#323941',
          500: '#4B535C',
        },
        paper: {
          100: '#F5F4F1',
          200: '#E9E7E1',
        },
        signal: {
          amber: '#E8A33D',
          amberDim: '#8A6528',
        },
        ready: {
          mint: '#63D9B5',
          mintDim: '#3A7A66',
        },
        alert: {
          red: '#E2604F',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui'],
        body: ['var(--font-body)', 'ui-sans-serif', 'system-ui'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular'],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
    },
  },
  plugins: [],
};

export default config;
