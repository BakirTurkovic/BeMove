/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: "#FF2D55",
        ink: "#1C1C1E",
        muted: "#8E8E93",
        canvas: "#F8F9FA",
        blush: "#FFE5EC"
      }
    }
  },
  plugins: []
};
