import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "S1-08 Homework Board",
  description: "Daily homework posts for your class",
};

// Runs before first paint to apply the saved theme (preset, system-resolved,
// or a custom image-generated palette) and prevent a flash of the default
// theme. Mirrors `src/lib/theme-engine.ts` — kept dependency-free + inline so
// it executes synchronously in <head> without waiting on the JS bundle.
const themeInitScript = `
(function () {
  try {
    var key = "hb-theme-prefs";
    var raw = localStorage.getItem(key);
    var prefs = raw ? JSON.parse(raw) : null;
    var modes = ["light", "dark", "emerald", "sunset", "custom"];
    var mode =
      prefs && prefs.mode && modes.indexOf(prefs.mode) !== -1
        ? prefs.mode
        : "system";
    var resolved = mode;
    if (mode === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    var custom =
      prefs && prefs.custom && typeof prefs.custom === "object"
        ? prefs.custom
        : null;
    // "custom" without a valid palette is meaningless — fall back to light.
    if (resolved === "custom" && !custom) resolved = "light";
    var el = document.documentElement;
    el.setAttribute("data-theme", resolved);
    var isDark =
      resolved === "dark" ||
      (resolved === "custom" && custom.text === "#ffffff");
    el.classList.toggle("dark", isDark);
    if (resolved === "custom" && custom) {
      el.style.setProperty("--bg", custom.bg || "");
      el.style.setProperty("--card-bg", custom.cardBg || "");
      el.style.setProperty("--border", custom.border || "");
      el.style.setProperty("--primary", custom.primary || "");
      el.style.setProperty("--text", custom.text || "");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <AppShell>{children}</AppShell>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
