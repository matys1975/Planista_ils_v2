/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans:    ['IBM Plex Sans', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Source Serif 4', 'Georgia', 'serif'],
        mono:    ['IBM Plex Mono', 'Courier New', 'monospace'],
      },
      colors: {
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* Institutional Slate extended palette */
        navy: {
          deep: '#1B2E4B',
          dark: '#2E4A73',
          mid:  '#4A7BB5',
        },
        gold:        '#D4AA5F',
        cream: {
          DEFAULT: '#F7F4EE',
          dark:    '#F0EBE1',
          header:  '#EEE9DF',
        },
        'warm-border': '#E0D9CC',
        /* Status colors */
        status: {
          'active-bg':  'hsl(var(--status-active-bg))',
          'active-bg0': 'hsl(var(--status-active-bg))',
          'active-fg':  'hsl(var(--status-active-fg))',
          'warning-bg': 'hsl(var(--status-warning-bg))',
          'warning-bg0': 'hsl(var(--status-warning-bg))',
          'warning-fg': 'hsl(var(--status-warning-fg))',
          'danger-bg':  'hsl(var(--status-danger-bg))',
          'danger-bg0': 'hsl(var(--status-danger-bg))',
          'danger-fg':  'hsl(var(--status-danger-fg))',
          'info-bg':    'hsl(var(--status-info-bg))',
          'info-bg0':   'hsl(var(--status-info-bg))',
          'info-fg':    'hsl(var(--status-info-fg))',
          'neutral-bg': 'hsl(var(--status-neutral-bg))',
          'neutral-fg': 'hsl(var(--status-neutral-fg))',
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
