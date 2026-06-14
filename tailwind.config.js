/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // Form fields build their class names dynamically (`md:col-span-${span}`);
  // Tailwind's JIT can't see those, so keep them around explicitly.
  safelist: [
    "col-span-1", "col-span-2", "col-span-3", "col-span-4", "col-span-5", "col-span-6",
    "col-span-7", "col-span-8", "col-span-9", "col-span-10", "col-span-11", "col-span-12",
    "md:col-span-1", "md:col-span-2", "md:col-span-3", "md:col-span-4", "md:col-span-5", "md:col-span-6",
    "md:col-span-7", "md:col-span-8", "md:col-span-9", "md:col-span-10", "md:col-span-11", "md:col-span-12",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        doc: ["Arial", "Helvetica", "sans-serif"],
        docSerif: ['"Times New Roman"', "Times", "serif"],
      },
      colors: {
        ink: {
          50: "#f6f7fb",
          100: "#eceff7",
          200: "#d6dcec",
          300: "#aab3cf",
          400: "#7e89b1",
          500: "#5c6892",
          600: "#454f74",
          700: "#363e5b",
          800: "#262c41",
          900: "#171a27",
          950: "#0c0e17",
        },
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#b8d0ff",
          300: "#8ab0ff",
          400: "#5c87ff",
          500: "#3a62f0",
          600: "#2a47cf",
          700: "#2238a3",
          800: "#1d2f7f",
          900: "#172560",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)",
        pop: "0 10px 35px -10px rgba(58, 98, 240, 0.45)",
        sheet: "0 2px 8px rgba(15, 23, 42, 0.08), 0 24px 60px -20px rgba(15, 23, 42, 0.25)",
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
};
