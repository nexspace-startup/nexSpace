/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.css",        // include your Setup.css layer file
  ],
  theme: {
    extend: {
      fontFamily: {
        manrope: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        clashGrotesk: ['Clash Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        
      },
    },
  },
  plugins: [],
};


