import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#8B1A2E',
          50: '#fdf2f4',
          100: '#fce7eb',
          200: '#f9c2cb',
          300: '#f48fa0',
          400: '#e85070',
          500: '#8B1A2E',
          600: '#7a1628',
          700: '#641220',
          800: '#4e0e19',
          900: '#380a12',
        },
        smc: {
          dark: '#0d1117',
          darker: '#0a0d12',
          card: '#161b22',
          border: '#30363d',
          text: '#c9d1d9',
          muted: '#8b949e',
        },
        success: '#3fb950',
        warning: '#d29922',
        danger: '#f85149',
        info: '#58a6ff',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
