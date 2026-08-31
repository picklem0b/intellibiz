import type { Config } from "tailwindcss";

const config: Config = {
   darkMode: "class",
   content: [
      "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
   ],
   theme: {
      extend: {
         colors: {
            brand: {
               50: "#eef2ff",
               100: "#e0e7ff",
               200: "#c7d2fe",
               300: "#a5b4fc",
               400: "#818cf8",
               500: "#6366f1",
               600: "#4f46e5",
               700: "#4338ca",
               800: "#3730a3",
               900: "#312e81",
               950: "#1e1b4b"
            },
            background: "hsl(var(--background))",
            foreground: "hsl(var(--foreground))",
            muted: {
               DEFAULT: "hsl(var(--muted))",
               foreground: "hsl(var(--muted-foreground))"
            },
            border: "hsl(var(--border))",
            ring: "hsl(var(--ring))"
         },
         fontFamily: {
            sans: ["Inter", "system-ui", "sans-serif"],
            mono: ["JetBrains Mono", "Fira Code", "monospace"]
         },
         typography: {
            DEFAULT: {
               css: {
                  maxWidth: "none"
               }
            }
         }
      }
   },
   plugins: [require("@tailwindcss/typography")]
};

export default config;
