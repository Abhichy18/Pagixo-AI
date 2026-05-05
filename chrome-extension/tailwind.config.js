/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx,html}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        pagixo: {
          primary: '#4F46E5',
          'primary-light': '#6366F1',
          'primary-dark': '#4338CA',
          accent: '#10B981',
          'accent-light': '#34D399',
          'accent-dark': '#059669',
          surface: '#1E1B4B',
          'surface-light': '#312E81',
          bg: '#0F0D2E',
          'bg-card': '#1A1744',
          text: '#E0E7FF',
          'text-muted': '#A5B4FC',
          error: '#EF4444',
          warning: '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'scan-line': 'scanLine 1.5s ease-in-out infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(79, 70, 229, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(79, 70, 229, 0.6)' },
        },
        slideIn: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '50%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(-100%)' },
        },
      },
      boxShadow: {
        'glow': '0 0 15px rgba(79, 70, 229, 0.4)',
        'glow-accent': '0 0 15px rgba(16, 185, 129, 0.4)',
      },
    },
  },
  plugins: [],
};
