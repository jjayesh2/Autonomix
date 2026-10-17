/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#08090C',
        surface: '#0D0F14',
        card: '#11141A',
        elevated: '#171A22',
        border: 'rgba(255, 255, 255, 0.08)',
        'card-border': 'rgba(255, 255, 255, 0.08)',
        'card-border-hover': 'rgba(255, 255, 255, 0.16)',
        text: {
          main: '#F3F4F6',
          secondary: '#9CA3AF',
          muted: '#6B7280',
        },
        primary: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          400: '#819BFF',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
        },
        accent: {
          blue: '#819BFF',
          violet: '#9B8AFF',
          cyan: '#06B6D4',
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#F43F5E'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      boxShadow: {
        'glow-blue': '0 0 25px -5px rgba(129, 155, 255, 0.15)',
        'glow-violet': '0 0 25px -5px rgba(155, 138, 255, 0.15)',
        'glow-accent': '0 0 35px -5px rgba(129, 155, 255, 0.25)',
        'glow-cyan': '0 0 30px -5px rgba(6, 182, 212, 0.35)',
        'card-elevated': '0 10px 30px -10px rgba(0, 0, 0, 0.8), 0 0 1px 1px rgba(255, 255, 255, 0.08)',
        'card-hover': '0 15px 35px -10px rgba(0, 0, 0, 0.9), 0 0 20px -5px rgba(129, 155, 255, 0.12)',
      },
      animation: {
        'entrance-bg': 'entranceBg 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'entrance-nav': 'entranceNav 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'entrance-heading': 'entranceHeading 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'entrance-card': 'entranceCard 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'radar-sweep': 'radarSweep 4s linear infinite',
        'packet-flow': 'packetFlow 2s linear infinite',
        'float-slow': 'floatSlow 6s ease-in-out infinite',
        'cyber-pulse': 'cyberPulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        entranceBg: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        entranceNav: {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        entranceHeading: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        entranceCard: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        radarSweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        packetFlow: {
          '0%': { strokeDashoffset: '40' },
          '100%': { strokeDashoffset: '0' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        cyberPulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(1.03)' },
        },
      },
    },
  },
  plugins: [],
}
