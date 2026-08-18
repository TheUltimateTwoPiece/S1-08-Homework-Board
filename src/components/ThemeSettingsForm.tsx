"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyCustomFromImage,
  applyPreset,
  applyTheme,
  buildCustomTheme,
  contrastRatio,
  DEFAULT_PREFS,
  hexToRgb,
  loadTheme,
  relativeLuminance,
  resetTheme,
  rgbToHex,
  saveTheme,
  suggestAccessibleTextColor,
  THEME_OPTIONS,
  type CustomThemePayload,
  type ThemeMode,
  type ThemePrefs,
} from "@/lib/theme-engine";

type Swatches = {
  bg: string;
  surface: string;
  text: string;
  primary: string;
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED = "image/*";
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function readSwatches(): Swatches {
  const cs = getComputedStyle(document.documentElement);
  const read = (v: string) => cs.getPropertyValue(v).trim();
  return {
    bg: read("--hb-surface-muted"),
    surface: read("--hb-surface"),
    text: read("--hb-text"),
    primary: read("--hb-blue"),
  };
}

function contrastOf(swatches: Swatches): { ratio: number | null; aa: boolean } {
  const bg = hexToRgb(swatches.bg);
  const text = hexToRgb(swatches.text);
  if (!bg || !text) return { ratio: null, aa: false };
  const ratio = contrastRatio(
    relativeLuminance(bg.r, bg.g, bg.b),
    relativeLuminance(text.r, text.g, text.b),
  );
  return { ratio, aa: ratio >= 4.5 };
}

/** WCAG contrast between two hex colors, or null if either isn't a hex. */
function ratioBetween(bgHex: string, textHex: string): number | null {
  const bg = hexToRgb(bgHex);
  const text = hexToRgb(textHex);
  if (!bg || !text) return null;
  return contrastRatio(
    relativeLuminance(bg.r, bg.g, bg.b),
    relativeLuminance(text.r, text.g, text.b),
  );
}

const SWATCH_LABELS: { key: keyof Swatches; label: string; hint: string }[] = [
  { key: "bg", label: "Background", hint: "Page canvas" },
  { key: "surface", label: "Surface", hint: "Cards & panels" },
  { key: "text", label: "Text", hint: "Main text" },
  { key: "primary", label: "Primary", hint: "Actions & links" },
];

/** Hex text field that only commits well-formed values; otherwise reverts. */
function HexField({
  id,
  value,
  onCommit,
}: {
  id: string;
  value: string;
  onCommit: (hex: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  // Value changed externally (eyedropper pick, colour picker, new upload) —
  // re-sync the draft during render, the React-recommended way.
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }
  const commit = () => {
    let v = draft.trim();
    if (v && !v.startsWith("#")) v = `#${v}`;
    if (HEX_RE.test(v)) onCommit(v.toLowerCase());
    else setDraft(value);
  };
  return (
    <input
      id={id}
      type="text"
      inputMode="text"
      spellCheck={false}
      autoComplete="off"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
      className="hb-input w-full rounded-lg px-2 py-1 font-mono text-[11px]"
      placeholder="#rrggbb"
      aria-label="Colour hex value"
    />
  );
}

/** Maps a click/hover position on the rendered image to canvas pixel coords. */
function pixelFromEvent(
  e: React.MouseEvent<HTMLImageElement>,
  canvas: HTMLCanvasElement,
): { x: number; y: number } | null {
  const rect = e.currentTarget.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const x = Math.min(
    canvas.width - 1,
    Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width)),
  );
  const y = Math.min(
    canvas.height - 1,
    Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height)),
  );
  return { x, y };
}

function EyedropperIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="m2 22 1-1h3l9-9" />
      <path d="M3 21v-3l9-9" />
      <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
    </svg>
  );
}

export function ThemeSettingsForm() {
  const [prefs, setPrefs] = useState<ThemePrefs>(DEFAULT_PREFS);
  const [mounted, setMounted] = useState(false);
  const [swatches, setSwatches] = useState<Swatches | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [picking, setPicking] = useState<keyof Swatches | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pickerFailed, setPickerFailed] = useState(false);
  const [hoverColor, setHoverColor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const custom: CustomThemePayload | null = prefs.custom;

  // The recommended (then user-tweaked) scheme — only editable while the
  // custom theme is active; presets fall back to read-only CSS swatches.
  const editable: Swatches | null =
    prefs.mode === "custom" && custom
      ? {
          bg: custom.bg,
          surface: custom.cardBg,
          text: custom.text,
          primary: custom.primary,
        }
      : null;

  useEffect(() => {
    const loaded = loadTheme();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(loaded);
    // The eyedropper's blob URL only lives for the upload session — restore
    // the picker source from the persisted thumbnail so "Pick" also works
    // after a fresh page load (or when switching back to a saved custom
    // theme).
    if (loaded.custom?.thumbnail) {
      setImageUrl(loaded.custom.thumbnail);
    }
    setMounted(true);
  }, []);

  // Re-read resolved CSS vars whenever the active theme changes.
  useEffect(() => {
    if (!mounted) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSwatches(readSwatches());
  }, [prefs, mounted]);

  // Load the uploaded image into a sampling canvas for the eyedropper.
  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.onload = () => {
      const MAX_SAMPLE = 2048;
      const scale = Math.min(
        1,
        MAX_SAMPLE / Math.max(img.naturalWidth, img.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvasRef.current = canvas;
      }
    };
    img.src = imageUrl;
    return () => {
      URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const handlePresetChange = useCallback((value: ThemeMode) => {
    setError(null);
    setPicking(null);
    setHoverColor(null);
    if (value === "custom") {
      // Re-apply the retained custom palette generated from an image.
      const stored = loadTheme();
      if (stored.custom) {
        const next: ThemePrefs = { mode: "custom", custom: stored.custom };
        saveTheme(next);
        applyTheme(next);
        setPrefs(next);
      }
      return;
    }
    applyPreset(value);
    // Re-read so any retained custom palette stays available in the dropdown.
    setPrefs(loadTheme());
  }, []);

  const processFile = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image. Upload a JPG, PNG, WebP, or GIF.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(
        `Image is too large (${Math.round(file.size / 1024)} KB). Max 10 MB.`,
      );
      return;
    }
    setBusy(true);
    try {
      const next = await applyCustomFromImage(file);
      setPrefs(next);
      setImageUrl(URL.createObjectURL(file));
      setPickerFailed(false);
      setPicking(null);
      setHoverColor(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't build a palette from that image. Try another one.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      void processFile(file);
    },
    [processFile],
  );

  const handleReset = useCallback(() => {
    setError(null);
    resetTheme();
    setPrefs(DEFAULT_PREFS);
    setPicking(null);
    setHoverColor(null);
    setPickerFailed(false);
    setImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const copyValue = useCallback((value: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied(null), 1400);
    }
  }, []);

  /** Applies an edited palette immediately (live preview + persistence). */
  const commitEdits = useCallback(
    (patch: Partial<Swatches>) => {
      if (!custom) return;
      setError(null);
      const nextEditable: Swatches = {
        bg: patch.bg ?? custom.bg,
        surface: patch.surface ?? custom.cardBg,
        text: patch.text ?? custom.text,
        primary: patch.primary ?? custom.primary,
      };
      const payload = buildCustomTheme({
        bg: nextEditable.bg,
        surface: nextEditable.surface,
        primary: nextEditable.primary,
        text: nextEditable.text,
        thumbnail: custom.thumbnail,
      });
      const next: ThemePrefs = { mode: "custom", custom: payload };
      saveTheme(next);
      applyTheme(next);
      setPrefs(next);
    },
    [custom],
  );

  /** Samples the pixel under the cursor on the rendered image. */
  const sampleAt = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !picking) return;
      const px = pixelFromEvent(e, canvas);
      if (!px) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const d = ctx.getImageData(px.x, px.y, 1, 1).data;
      commitEdits({ [picking]: rgbToHex(d[0], d[1], d[2]) });
      setPicking(null);
      setHoverColor(null);
    },
    [picking, commitEdits],
  );

  const hoverAt = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (!picking) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const px = pixelFromEvent(e, canvas);
      if (!px) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const d = ctx.getImageData(px.x, px.y, 1, 1).data;
      setHoverColor(rgbToHex(d[0], d[1], d[2]));
    },
    [picking],
  );

  // Text contrast against BOTH the page background and card surfaces — text
  // renders on cards, so a pick that fails either deserves the warning.
  const textContrast = (() => {
    if (!editable) return null;
    const candidates: { ratio: number; bg: string }[] = [];
    const bgRatio = ratioBetween(editable.bg, editable.text);
    const surfaceRatio = ratioBetween(editable.surface, editable.text);
    if (bgRatio !== null) candidates.push({ ratio: bgRatio, bg: editable.bg });
    if (surfaceRatio !== null) {
      candidates.push({ ratio: surfaceRatio, bg: editable.surface });
    }
    if (candidates.length === 0) return null;
    return candidates.reduce((a, b) => (b.ratio < a.ratio ? b : a));
  })();

  // Flagged whenever the text color fails AA anywhere, with a similar
  // suggested replacement tuned against whichever surface is worst.
  const textWarning = (() => {
    if (!textContrast || textContrast.ratio >= 4.5 || !editable) return null;
    return {
      ratio: textContrast.ratio,
      suggestion: suggestAccessibleTextColor(editable.text, textContrast.bg),
    };
  })();
  const textSuggestion = textWarning?.suggestion ?? null;

  const badge = (() => {
    if (editable) {
      const worst = textContrast;
      return worst === null
        ? null
        : { ratio: worst.ratio, aa: worst.ratio >= 4.5 };
    }
    return swatches ? contrastOf(swatches) : null;
  })();

  const pickingLabel = picking
    ? SWATCH_LABELS.find((s) => s.key === picking)?.label ?? ""
    : "";

  return (
    <div className="hb-card-surface space-y-8 p-6 sm:p-8">
      {/* ── Preset selector ─────────────────────── */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <div className="hb-bento-icon-box" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <circle cx="13.5" cy="6.5" r="2.5" />
              <circle cx="17.5" cy="10.5" r="2.5" />
              <circle cx="8.5" cy="7.5" r="2.5" />
              <circle cx="6.5" cy="12.5" r="2.5" />
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
            </svg>
          </div>
          <h2 className="hb-card-title text-base">Theme</h2>
        </div>

        <label
          htmlFor="theme-preset"
          className="hb-card-section mb-1.5 block text-sm"
        >
          Choose a theme
        </label>
        <select
          id="theme-preset"
          value={prefs.mode}
          onChange={(e) => handlePresetChange(e.target.value as ThemeMode)}
          className="hb-input w-full max-w-md rounded-lg px-3 py-2.5 text-sm"
          disabled={!mounted || busy}
        >
          {THEME_OPTIONS.map((opt) =>
            opt.value === "custom" && !custom ? null : (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ),
          )}
        </select>
        <p className="hb-card-meta mt-2 text-xs">
          System default follows your device's light/dark setting.
        </p>
      </section>

      {/* ── Image → theme generator ─────────────── */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <div className="hb-bento-icon-box" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
          <h2 className="hb-card-title text-base">Generate Theme from Image</h2>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label="Generate theme from image: upload or drop an image"
          aria-disabled={busy}
          onClick={() => !busy && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!busy) fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition ${
            dragActive
              ? "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40"
              : "border-slate-200 bg-slate-50/60 hover:border-blue-300 hover:bg-blue-50/40 dark:border-stone-700 dark:bg-stone-800/50 dark:hover:border-blue-500 dark:hover:bg-blue-950/30"
          } ${busy ? "cursor-wait opacity-60" : "cursor-pointer"}`}
        >
          {busy ? (
            <>
              <span className="hb-spinner" aria-hidden="true" />
              <p className="hb-card-body text-sm">Sampling your image...</p>
            </>
          ) : custom?.thumbnail ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={custom.thumbnail}
                alt="Uploaded image used for the current theme"
                className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-stone-700"
              />
              <div>
                <p className="hb-card-section text-sm">
                  Theme generated from your image
                </p>
                <p className="hb-card-meta mt-0.5 text-xs">
                  Drop a new image to replace it, or click to browse.
                </p>
              </div>
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8 text-slate-400 dark:text-stone-400"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div>
                <p className="hb-card-section text-sm">
                  Drag & drop an image here
                </p>
                <p className="hb-card-meta mt-0.5 text-xs">
                  or click to browse — we'll recommend a colour scheme from it
                  that you can tweak with the eyedropper.
                </p>
              </div>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              void processFile(file);
              e.target.value = "";
            }}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      </section>

      {/* ── Live preview + editable palette ─────── */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="hb-bento-icon-box" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M12 3v18" />
                <path d="M5 7h14" />
                <path d="M5 12h14" />
                <path d="M5 17h14" />
              </svg>
            </div>
            <h2 className="hb-card-title text-base">Live preview & palette</h2>
          </div>

          {badge?.ratio != null && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                badge.aa
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
              }`}
              title="WCAG 2.1 AA contrast of text against the background and card surfaces"
            >
              {badge.aa ? "✓ AA" : "✕ Below AA"} {badge.ratio.toFixed(1)}:1
            </span>
          )}
        </div>

        {editable && (
          <p className="hb-card-meta mb-3 text-xs">
            Here's the colour scheme we recommend from your image — tweak any
            colour with the eyedropper, hex field, or colour picker, and it
            applies instantly.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Mock dashboard surface rendered with the *live* CSS vars */}
          <div
            className="rounded-xl border p-4"
            style={{
              background: "var(--hb-surface-muted)",
              borderColor: "var(--hb-border)",
              color: "var(--hb-text)",
            }}
          >
            <div
              className="rounded-lg border p-4 shadow-sm"
              style={{
                background: "var(--hb-surface)",
                borderColor: "var(--hb-border)",
              }}
            >
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--hb-text)" }}
              >
                Homework board
              </p>
              <p
                className="mt-1 text-xs"
                style={{ color: "var(--hb-text-muted)" }}
              >
                Due Friday · Mathematics
              </p>
              <span
                className="mt-3 inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: "var(--hb-btn-bg)" }}
              >
                Mark complete
              </span>
            </div>
          </div>

          {/* Swatch editors (read-only tiles for presets) */}
          <div className="grid grid-cols-2 gap-3">
            {SWATCH_LABELS.map(({ key, label, hint }) => {
              const value = editable
                ? editable[key]
                : (swatches?.[key] ?? "");
              const copiedThis = copied === value && value !== "";
              const isEditing = editable !== null;
              return (
                <div
                  key={key}
                  className="relative flex flex-col gap-2 rounded-lg border border-slate-200 p-2.5 transition hover:border-blue-300 dark:border-stone-700 dark:hover:border-blue-500"
                >
                  <div
                    className={`flex items-center gap-2 ${isEditing ? "pr-11" : ""}`}
                  >
                    <span
                      className="h-8 w-8 shrink-0 rounded-md ring-1 ring-inset ring-black/10"
                      style={{ background: value || "transparent" }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="hb-card-section text-[11px] font-semibold">
                        {label}
                      </div>
                      <div className="hb-card-meta text-[10px]">{hint}</div>
                    </div>
                  </div>

                  {/* Icon-only eyedropper pinned to the card's top-right corner */}
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => setPicking((p) => (p === key ? null : key))}
                      disabled={busy}
                      title={
                        picking === key
                          ? `Cancel picking the ${label.toLowerCase()} colour`
                          : `Pick the ${label.toLowerCase()} colour from your image`
                      }
                      aria-label={
                        picking === key
                          ? `Cancel picking the ${label.toLowerCase()} colour`
                          : `Pick the ${label.toLowerCase()} colour from your image`
                      }
                      aria-pressed={picking === key}
                      className={`absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:opacity-50 ${
                        picking === key
                          ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300"
                          : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:border-blue-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
                      }`}
                    >
                      <EyedropperIcon />
                    </button>
                  )}

                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <HexField
                        id={`swatch-hex-${key}`}
                        value={value}
                        onCommit={(hex) => commitEdits({ [key]: hex })}
                      />
                      <input
                        type="color"
                        value={value}
                        onChange={(e) =>
                          commitEdits({ [key]: e.target.value })
                        }
                        title="Open colour picker"
                        aria-label={`${label} colour picker`}
                        className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-slate-200 bg-white p-0.5 dark:border-stone-700 dark:bg-stone-800"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="hb-card-body truncate font-mono text-[10px]">
                        {value || "—"}
                      </span>
                      {value && (
                        <button
                          type="button"
                          onClick={() => copyValue(value)}
                          className="hb-card-meta shrink-0 text-[10px] uppercase tracking-wider transition hover:text-slate-700 dark:hover:text-stone-200"
                        >
                          {copiedThis ? "Copied!" : "Copy"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Text contrast warning + similar-colour suggestion */}
        {textWarning && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <span aria-hidden="true">⚠️</span>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <span className="font-semibold">Low text contrast.</span>{" "}
                  Your text colour only has{" "}
                  <span className="font-semibold">
                    {textWarning.ratio.toFixed(1)}:1
                  </span>{" "}
                  contrast against your background or card surfaces — below the
                  4.5:1 WCAG AA minimum for readable text.
                </p>
              </div>
              {textSuggestion && (
                <button
                  type="button"
                  onClick={() => commitEdits({ text: textSuggestion.color })}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-stone-900 dark:text-amber-200 dark:hover:bg-amber-950/60"
                >
                  Use suggested colour {textSuggestion.color}{" "}
                  <span className="opacity-70">
                    ({textSuggestion.ratio.toFixed(1)}:1)
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Eyedropper picker */}
        {picking && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900 dark:bg-blue-950/20">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-700 dark:text-stone-200">
                <span className="font-semibold">
                  Pick the {pickingLabel.toLowerCase()} colour
                </span>{" "}
                — click anywhere on your image. Hover to preview.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPicking(null);
                  setHoverColor(null);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700/50"
              >
                Cancel
              </button>
            </div>
            {imageUrl && !pickerFailed ? (
              <div className="relative mx-auto w-fit cursor-crosshair">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Your uploaded image — click to pick a colour from it"
                  onClick={sampleAt}
                  onMouseMove={hoverAt}
                  onMouseLeave={() => setHoverColor(null)}
                  onError={() => setPickerFailed(true)}
                  className="max-h-96 w-auto max-w-full rounded-lg object-contain ring-1 ring-slate-200 dark:ring-stone-700"
                />
                {hoverColor && (
                  <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 font-mono text-[11px] text-white">
                    <span
                      className="h-3 w-3 rounded-sm ring-1 ring-white/40"
                      style={{ background: hoverColor }}
                      aria-hidden="true"
                    />
                    {hoverColor}
                  </div>
                )}
              </div>
            ) : (
              <p className="hb-card-meta text-sm">
                {pickerFailed
                  ? "Couldn't display that image. Re-upload it to pick colours from it."
                  : "Re-upload your image to pick colours from it."}
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── Footer / reset ──────────────────────── */}
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6 dark:border-stone-700">
        <p className="hb-card-meta text-sm">
          Your theme is saved to this browser and applied instantly.
        </p>
        <button
          type="button"
          onClick={handleReset}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700/50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Reset to default
        </button>
      </div>
    </div>
  );
}
