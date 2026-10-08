export const tokens = {
  // --- Identity ---
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

  // --- Colour ---
  accent: "#FF4D2D",
  accentHover: "#E04425",
  accentMuted: "rgba(255,77,45,0.12)",
  bg: "#F8F7F4",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  surfaceSunken: "#F0EFEA",
  text: "#1A1A1A",
  textSecondary: "#6B6B6B",
  captionText: "#FFFFFF",
  captionShadow: "rgba(0, 0, 0, 0.55)",
  border: "rgba(0, 0, 0, 0.08)",
  overlay: "rgba(0, 0, 0, 0.35)",
  success: "#16A34A",
  warning: "#D97706",
  error: "#DC2626",

  // --- Type scale (9:16) ---
  type: {
    heroWord: { size: 180, weight: 700 as const, lineHeight: 1 },
    headline: { size: 100, weight: 700 as const, lineHeight: 1.1 },
    bigNumber: { size: 150, weight: 600 as const, lineHeight: 1 },
    label: { size: 32, weight: 500 as const, letterSpacing: "0.1em", lineHeight: 1.3 },
    caption: { size: 42, weight: 600 as const, lineHeight: 1.2 },
    body: { size: 20, weight: 400 as const, lineHeight: 1.5 },
  },

  // --- Type scale (16:9) ---
  type16x9: {
    heroWord: { size: 260, weight: 700 as const, lineHeight: 1 },
    headline: { size: 116, weight: 700 as const, lineHeight: 1.1 },
    bigNumber: { size: 170, weight: 600 as const, lineHeight: 1 },
    label: { size: 40, weight: 500 as const, letterSpacing: "0.1em", lineHeight: 1.3 },
    caption: { size: 46, weight: 600 as const, lineHeight: 1.2 },
    body: { size: 22, weight: 400 as const, lineHeight: 1.5 },
  },

  // --- Spacing (4px base) ---
  space: [0, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128] as const,

  // --- Corner radii ---
  radius: {
    sm: 8,
    md: 12,
    lg: 24,
    xl: 40,
    full: 9999,
  },

  // --- Shadows ---
  shadow: {
    sm: "0 1px 3px rgba(0,0,0,0.06)",
    md: "0 4px 16px rgba(0,0,0,0.08)",
    lg: "0 8px 32px rgba(0,0,0,0.10)",
    xl: "0 16px 48px rgba(0,0,0,0.12)",
    focus: "0 0 0 3px rgba(255,77,45,0.3)",
  },

  // --- Line weight (icons, dividers) ---
  lineWeight: {
    thin: 1,
    regular: 2,
    thick: 3,
  },

  // --- Safe zones (px, origin top-left) ---
  safeZones: {
    "9:16": { top: 250, bottom: 420, left: 40, right: 40 },
    "16:9": { top: 40, bottom: 40, left: 40, right: 40 },
  },
} as const;

export type Tokens = typeof tokens;
