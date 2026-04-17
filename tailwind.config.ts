import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Georgia", "ui-serif", "serif"]
      },
      colors: {
        ink: "#0a0a0a",
        paper: "#fafaf7",
        accent: "#b8935a"
      }
    }
  },
  plugins: []
};

export default config;
