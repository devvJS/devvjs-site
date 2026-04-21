/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        charcoal: '#0d0f12',
        'accent-green': '#39ff14',
        'accent-cyan': '#00e5ff',
        'text-primary': '#e2e8f0',
        'text-secondary': '#4a5568',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}