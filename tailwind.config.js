/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eaf5ff',
          100: '#d0eaff',
          200: '#a6d6ff',
          300: '#7cc1ff',
          400: '#53acff',
          500: '#2a97ff', // Semi Blue-ish
          600: '#006add',
          700: '#004fa3',
          800: '#00356b',
          900: '#001b36',
        },
        gray: {
          50: '#f9f9fa', // Semi bg
          100: '#f4f5f6',
          200: '#e6e8ea',
          300: '#c6cace',
          400: '#a7abb0',
          500: '#888d92',
          600: '#6b7075',
          700: '#4f5358',
          800: '#32363a',
          900: '#1c1f23', // Semi text
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}