/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Conflict badge palette (CONSTRAINTS.md: hard=red, soft=amber)
        hard: "#dc2626",
        soft: "#d97706",
      },
    },
  },
  plugins: [],
};
