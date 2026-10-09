/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        noir: {
          bg: '#0c1014',
          panel: '#121a24',
          border: '#1e293b',
          deep: '#0a0e13',
        },
        police: {
          DEFAULT: '#2563eb',
          light: '#3b82f6',
        },
        evidence: {
          DEFAULT: '#d97706',
          light: '#f59e0b',
        },
        alert: '#dc2626',
        steel: '#94a3b8',
        cork: '#3b2a1a',
      },
      fontFamily: {
        sans: ['Heebo', 'Rubik', 'Arial', 'sans-serif'],
        display: ['"Frank Ruhl Libre"', 'Heebo', 'serif'],
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0.45)' },
          '50%': { boxShadow: '0 0 0 8px rgba(245, 158, 11, 0)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        siren: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        pulseGlow: 'pulseGlow 1.8s ease-in-out infinite',
        fadeUp: 'fadeUp 0.25s ease-out',
        siren: 'siren 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
