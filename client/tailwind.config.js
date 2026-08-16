/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        clinic: {
          ink: "#172026",
          panel: "#ffffff",
          mist: "#eef3f1",
          line: "#d7e0dd",
          teal: "#196f63",
          deep: "#25424c",
          muted: "#63726f",
          soft: "#dcefed"
        }
      },
      fontFamily: {
        sans: [
          "Plus Jakarta Sans",
          "DM Sans",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ],
        display: [
          "Plus Jakarta Sans",
          "DM Sans",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
};
