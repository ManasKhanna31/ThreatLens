/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        threat: {
          base: 'var(--tl-bg-base, #0C0A09)',
          surface: 'var(--tl-bg-surface, #141210)',
          elevated: 'var(--tl-card-bg, #1A1714)',
          amber: '#D97706',
          gold: '#F59E0B',
          text: 'var(--tl-text-primary, #F5F0E8)',
          muted: 'var(--tl-text-muted, #8A7F72)',
        },
      },
      boxShadow: {
        panel: '0 20px 52px rgba(0, 0, 0, 0.42)',
        warm: '0 0 20px rgba(245, 158, 11, 0.08)',
      },
    },
  },
  plugins: [],
};
