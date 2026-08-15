/**
 * theme-engine.ts
 * -----------------------------------------------------------------------------
 * Client-side theme engine for the multi-theme selector system.
 *
 * Responsibilities:
 *   1. Theme presets (system / light / dark / emerald / sunset) + a "custom"
 *      mode generated from an uploaded image.
 *   2. HTML5 Canvas palette extraction — samples an image, computes its average
 *      RGB, and derives accessible surface/primary/text colors from it.
 *   3. WCAG 2.1 AA contrast enforcement — exact relative luminance + contrast
 *      against pure white (#ffffff) and pure black (#000000), always picking
 *      the more readable text color.
 *   4. Persistence to localStorage and application of `data-theme` + the
 *      `.dark` class (for Tailwind's class-based dark variant) + custom CSS
 *      custom properties (--bg / --card-bg / --border / --primary / --text).
 *
 * The FOUC-prevention inline script in `src/app/layout.tsx` re-applies the
 * persisted values before React hydrates, so this module is only used for
 * interactive changes (and re-applied on mount to stay in sync).
 */

export type ThemeMode =
  | "system"
  | "light"
  | "dark"
  | "emerald"
  | "sunset"
  | "custom";

export interface CustomThemePayload {
  /** Average color of the uploaded image (hex), used as the page background. */
  bg: string;
  /** Semi-transparent overlay color for cards/surfaces (rgba). */
  cardBg: string;
  /** Semi-transparent overlay color for borders (rgba). */
  border: string;
  /** Vivid accent color used for links/actions (hex). */
  primary: string;
  /** Chosen readable text color — "#ffffff" or "#000000". */
  text: string;
  /** Exact contrast ratio between `text` and `bg`. Always >= 4.5 (AA). */
  contrast: number;
  /** Small data-URL thumbnail of the source image (for the preview UI). */
  thumbnail?: string;
}

export interface ThemePrefs {
  mode: ThemeMode;
  custom: CustomThemePayload | null;
}

export const THEME_STORAGE_KEY = "hb-theme-prefs";

/** Fired on `window` whenever a theme is applied so listeners can re-sync. */
export const THEME_CHANGE_EVENT = "hb-theme-change";

export const DEFAULT_PREFS: ThemePrefs = { mode: "system", custom: null };

export const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System default" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "emerald", label: "Emerald" },
  { value: "sunset", label: "Sunset" },
  { value: "custom", label: "Custom (from image)" },
];

const WHITE = "#ffffff";
const BLACK = "#000000";

const CUSTOM_VARS = ["--bg", "--card-bg", "--border", "--primary", "--text"];

/* ────────────────────────────────────────────────────────────────────────────
 * Color math
 * ──────────────────────────────────────────────────────────────────────────── */

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.1 relative luminance for an sRGB color (0–255 channels). */
export function relativeLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

/** WCAG 2.1 contrast ratio between two relative luminance values. */
export function contrastRatio(l1: number, l2: number): number {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
  const int = parseInt(m, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) =>
    Math.round(clamp(n, 0, 255))
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h / 6, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hue2rgb(p, q, h + 1 / 3) * 255,
    g: hue2rgb(p, q, h) * 255,
    b: hue2rgb(p, q, h - 1 / 3) * 255,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Text color selection (WCAG 2.1 AA)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Evaluates contrast of `bg` against pure white and pure black, returning the
 * color with the higher ratio. Because contrast-to-white × contrast-to-black
 * is always ~21, the chosen ratio is guaranteed to be >= sqrt(21) ≈ 4.58:1,
 * satisfying WCAG 2.1 AA for normal text.
 */
export function pickTextColor(
  rgb: { r: number; g: number; b: number },
): { color: string; ratio: number } {
  const lum = relativeLuminance(rgb.r, rgb.g, rgb.b);
  const whiteRatio = contrastRatio(1, lum); // luminance of #ffffff is 1
  const blackRatio = contrastRatio(lum, 0); // luminance of #000000 is 0
  return whiteRatio >= blackRatio
    ? { color: WHITE, ratio: whiteRatio }
    : { color: BLACK, ratio: blackRatio };
}

/** Derives a vivid, contrasting accent from the average color of the image. */
function derivePrimary(
  avg: { r: number; g: number; b: number },
  isDark: boolean,
): string {
  const { h, s } = rgbToHsl(avg.r, avg.g, avg.b);
  // Grayscale images have no meaningful hue — fall back to a friendly blue.
  const hue = s < 0.05 ? 222 : h;
  const sat = Math.max(s, 0.55);
  const light = isDark ? 0.66 : 0.42;
  const rgb = hslToRgb(hue, sat, light);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Image palette extraction (HTML5 Canvas)
 * ──────────────────────────────────────────────────────────────────────────── */

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the image file."));
    };
    img.src = url;
  });
}

const SAMPLE_SIZE = 64; // downscaled sample grid — plenty for an average
const THUMB_SIZE = 120;

/**
 * Samples an uploaded image with the Canvas API, averages its RGB, and builds
 * an accessible theme payload (bg + semi-transparent card/border overlays +
 * vivid primary + WCAG-AA text color).
 */
export async function extractPaletteFromImage(
  file: File,
): Promise<CustomThemePayload> {
  const img = await loadImage(file);

  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = SAMPLE_SIZE;
  sampleCanvas.height = SAMPLE_SIZE;
  const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  if (!sampleCtx) throw new Error("Canvas is not supported in this browser.");
  sampleCtx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const { data } = sampleCtx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    // Skip fully-transparent pixels so they don't skew the average.
    if (data[i + 3] < 128) continue;
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
    count++;
  }
  if (count === 0) throw new Error("The image appears to be empty.");
  const avg = { r: rSum / count, g: gSum / count, b: bSum / count };
  const bg = rgbToHex(avg.r, avg.g, avg.b);

  const { color: text, ratio } = pickTextColor(avg);
  const isDark = text === WHITE;

  // Semi-transparent overlays scale naturally over any background while
  // keeping separation between surfaces. Direction follows the text color so
  // text stays readable on cards (dark overlay + white text; light overlay +
  // black text).
  const cardBg = isDark
    ? "rgba(0, 0, 0, 0.38)"
    : "rgba(255, 255, 255, 0.72)";
  const border = isDark
    ? "rgba(255, 255, 255, 0.18)"
    : "rgba(0, 0, 0, 0.14)";
  const primary = derivePrimary(avg, isDark);

  // Small thumbnail for the settings preview UI.
  let thumbnail: string | undefined;
  try {
    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = THUMB_SIZE;
    thumbCanvas.height = THUMB_SIZE;
    const thumbCtx = thumbCanvas.getContext("2d");
    if (thumbCtx) {
      thumbCtx.drawImage(img, 0, 0, THUMB_SIZE, THUMB_SIZE);
      thumbnail = thumbCanvas.toDataURL("image/jpeg", 0.72);
    }
  } catch {
    thumbnail = undefined;
  }

  return { bg, cardBg, border, primary, text, contrast: ratio, thumbnail };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Applying & resolving themes
 * ──────────────────────────────────────────────────────────────────────────── */

/** Resolves a preference to a concrete theme (system → light/dark). */
export function resolveMode(prefs: ThemePrefs): ThemeMode {
  if (prefs.mode !== "system") return prefs.mode;
  const prefersDark =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

function isResolvedDark(
  resolved: ThemeMode,
  custom: CustomThemePayload | null,
): boolean {
  if (resolved === "dark") return true;
  if (resolved === "custom") return custom?.text === WHITE;
  return false;
}

/** Whether the resolved theme renders as a dark surface (light text). */
export function isDarkMode(prefs: ThemePrefs): boolean {
  return isResolvedDark(resolveMode(prefs), prefs.custom);
}

let systemListenerAttached = false;

/** Re-applies the theme when the OS light/dark preference changes while the
    "system" mode is active, so the UI flips live without a reload. */
function ensureSystemListener(): void {
  if (systemListenerAttached) return;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return;
  }
  systemListenerAttached = true;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    const prefs = loadTheme();
    if (prefs.mode === "system") applyTheme(prefs);
  };
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", onChange);
  } else if (typeof mq.addListener === "function") {
    mq.addListener(onChange);
  }
}

function clearCustomVars(root: HTMLElement): void {
  for (const v of CUSTOM_VARS) root.style.removeProperty(v);
}

/**
 * Applies the given preferences to the document: sets `data-theme`, toggles
 * the `.dark` class (Tailwind class-based dark variant), and — for custom
 * themes — injects the dynamic CSS custom properties on <html>.
 */
export function applyTheme(prefs: ThemePrefs): void {
  if (typeof document === "undefined") return;
  ensureSystemListener();
  const root = document.documentElement;
  const resolved = resolveMode(prefs);

  root.setAttribute("data-theme", resolved);
  root.classList.toggle("dark", isResolvedDark(resolved, prefs.custom));

  clearCustomVars(root);
  if (resolved === "custom" && prefs.custom) {
    const c = prefs.custom;
    root.style.setProperty("--bg", c.bg);
    root.style.setProperty("--card-bg", c.cardBg);
    root.style.setProperty("--border", c.border);
    root.style.setProperty("--primary", c.primary);
    root.style.setProperty("--text", c.text);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Persistence
 * ──────────────────────────────────────────────────────────────────────────── */

export function saveTheme(prefs: ThemePrefs): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can throw (private mode / quota) — theme still applies live.
  }
}

const VALID_MODES: ThemeMode[] = [
  "system",
  "light",
  "dark",
  "emerald",
  "sunset",
  "custom",
];

function sanitizeCustom(value: unknown): CustomThemePayload | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (typeof p.bg !== "string" || typeof p.text !== "string") return null;
  return value as CustomThemePayload;
}

export function loadTheme(): ThemePrefs {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<ThemePrefs>;
    if (!parsed || !VALID_MODES.includes(parsed.mode as ThemeMode)) {
      return DEFAULT_PREFS;
    }
    const mode = parsed.mode as ThemeMode;
    const custom = sanitizeCustom(parsed.custom);
    // "custom" without a valid palette is meaningless — fall back to defaults.
    if (mode === "custom" && !custom) return DEFAULT_PREFS;
    return { mode, custom };
  } catch {
    // Corrupt storage — fall through to defaults.
  }
  return DEFAULT_PREFS;
}

/** Applies a preset and persists it. */
export function applyPreset(mode: Exclude<ThemeMode, "custom">): void {
  // Retain any previously-generated custom palette so the user can switch
  // back to it from the dropdown without re-uploading their image.
  const existing = loadTheme();
  const prefs: ThemePrefs = { mode, custom: existing.custom };
  saveTheme(prefs);
  applyTheme(prefs);
}

/** Extracts a palette from an image, then applies + persists it. */
export async function applyCustomFromImage(
  file: File,
): Promise<ThemePrefs> {
  const custom = await extractPaletteFromImage(file);
  const prefs: ThemePrefs = { mode: "custom", custom };
  saveTheme(prefs);
  applyTheme(prefs);
  return prefs;
}

/** Clears dynamic image overlays and returns to OS/preset defaults. */
export function resetTheme(): void {
  saveTheme(DEFAULT_PREFS);
  applyTheme(DEFAULT_PREFS);
}
