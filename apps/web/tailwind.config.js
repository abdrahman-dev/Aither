/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Nunito is the only documented typeface (UIUX_Design_Guidelines.md §1)
        sans: ["Nunito", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"]
      },
      colors: {
        // §2.1 Backgrounds & Surfaces
        "map-base": "#EEF4F8", // App background / map base
        surface: "#F8FAFC", // Solid cards/inputs
        glass: "rgba(255, 255, 255, 0.96)", // Glassmorphism panel (opaque variant)
        "glass-soft": "rgba(255, 255, 255, 0.88)", // Glassmorphism panel (translucent variant)
        "success-highlight": "#F0FDF9", // Success/cool highlights
        // §2.2 Text Colors
        primary: "#1E293B", // Primary text (Slate 800)
        secondary: "#64748B", // Secondary text (Slate 500)
        tertiary: "#94A3B8", // Tertiary text / icons (Slate 400)
        disabled: "#CBD5E1", // Disabled text (Slate 300)
        // §2.3 Brand & Action Colors
        brand: "#38BDF8", // Primary brand / cool route (Sky 400)
        "brand-secondary": "#34D399", // Secondary accent (Emerald 400)
        "brand-mid": "#0EA5E9", // Primary gradient midpoint (Sky 500)
        // §3.1 Borders
        "border-subtle": "#E2EAF3",
        // §2.4 Semantic / Heat Risk Colors
        "risk-high": "#FCA5A5", // High heat background (Red 300)
        "risk-high-text": "#DC2626", // High heat text (Red 600)
        "risk-moderate": "#FDBA74", // Moderate heat background (Orange 300)
        "risk-moderate-text": "#C2410C", // Moderate heat text (Orange 700)
        "risk-moderate-toggle": "#F97316", // Moderate heat toggle (Orange 500)
        "risk-low": "#FDE68A", // Low heat background (Amber 200)
        "risk-low-text": "#059669" // Low heat text (Emerald 600)
      },
      // §3.1 Border Radius
      borderRadius: {
        panel: "20px", // Main panels & cards
        control: "14px", // Inputs & standard buttons (documented 12-14px)
        pill: "9999px" // Badges/pills
      },
      // §3.2 Shadows
      boxShadow: {
        card: "0 8px 32px rgba(30, 41, 59, 0.10), 0 2px 8px rgba(30, 41, 59, 0.06)",
        "button-primary": "0 6px 20px rgba(56, 189, 248, 0.35)",
        "top-bar": "0 4px 20px rgba(30, 41, 59, 0.08)"
      },
      // §2.3 Primary gradient (buttons)
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #38BDF8 0%, #0EA5E9 50%, #34D399 100%)"
      }
    }
  },
  plugins: []
};