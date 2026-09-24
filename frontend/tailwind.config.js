/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f2f5fa',
          100: '#e3e9f4',
          200: '#c3d0e6',
          300: '#94a9cf',
          400: '#5e7cb2',
          500: '#3d5c96',
          600: '#2c467a',
          700: '#233a63',
          800: '#1b2c4b',
          900: '#121f37',
          950: '#0b1526',
        },
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcdaff',
          300: '#8ec2ff',
          400: '#599fff',
          500: '#2f7bf6',
          600: '#1a5ee0',
          700: '#164bb6',
          800: '#173f90',
          900: '#183872',
        },
        teal: {
          50: '#effefa',
          100: '#c9fdf0',
          200: '#94f9e2',
          300: '#56eed0',
          400: '#26d8ba',
          500: '#0dbba1',
          600: '#059483',
          700: '#08766a',
          800: '#0b5d55',
          900: '#0d4d47',
        },
      },
      fontFamily: {
        sans: ['Tajawal', 'Cairo', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.05), 0 1px 3px rgba(16, 24, 40, 0.08)',
        pop: '0 12px 32px -8px rgba(16, 24, 40, 0.18)',
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.25rem' },
    },
  },
  plugins: [],
};
