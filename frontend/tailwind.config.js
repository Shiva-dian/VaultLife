/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Sora: geometric sans-serif — renders numbers with perfect clarity
        display: ['"Sora"', 'system-ui', 'sans-serif'],
        // DM Sans: clean humanist for body text
        body:    ['"DM Sans"', 'system-ui', 'sans-serif'],
        // DM Mono: for account numbers, codes
        mono:    ['"DM Mono"', 'monospace'],
      },
      colors: {
        blue: {
          50:  '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
          800: '#1e40af', 900: '#1e3a8a', 950: '#172554',
        },
      },
      animation: {
        'fade-in':   'fadeIn 0.4s ease-out forwards',
        'slide-up':  'slideUp 0.35s ease-out forwards',
        'slide-right':'slideRight 0.4s ease-out forwards',
        'pulse-slow':'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-sm': 'bounceSm 1s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { from:{ opacity:'0' }, to:{ opacity:'1' } },
        slideUp:   { from:{ opacity:'0', transform:'translateY(16px)' }, to:{ opacity:'1', transform:'translateY(0)' } },
        slideRight:{ from:{ opacity:'0', transform:'translateX(-16px)' }, to:{ opacity:'1', transform:'translateX(0)' } },
        bounceSm:  { '0%,100%':{ transform:'translateY(0)' }, '50%':{ transform:'translateY(-4px)' } },
      },
      boxShadow: {
        'card':     '0 2px 12px rgba(0,0,0,0.06)',
        'card-hover':'0 8px 28px rgba(0,0,0,0.10)',
        'blue-glow':'0 0 32px rgba(37,99,235,0.20)',
      },
    },
  },
  plugins: [],
}
