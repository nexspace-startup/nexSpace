/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F9F9F9",
        primary: "#212121",
        lightBlue: "#EFF5FF",
        midBlue: "#D5E5FF",
        logoBlue: "#4285F4",
      },
    },
  },
  plugins: [],
}
