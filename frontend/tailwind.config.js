/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand purple — replaces old amber
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4338ca', // primary CTA colour
          700: '#3730a3',
          800: '#312e81',
          900: '#1e1b4b',
          950: '#0f0e2a',
        },
        // Surface tokens
        surface: {
          DEFAULT: '#0f0e2a', // top navbar (dark navy)
          light:   '#f8f9fa', // page background
          card:    '#ffffff', // panel / card background
          lighter: '#f1f3f5', // subtle panel variant
        },
        // Neutral border / text helpers
        border:  '#e5e7eb',
        muted:   '#6b7280',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
