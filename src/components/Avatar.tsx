"use client";

import { useState } from "react";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

type AvatarProps = {
  /** Profile display name — used to derive the initials fallback. */
  name: string;
  /** Public URL to the avatar image, or null/undefined to fall back to initials. */
  src?: string | null;
  /** User id — used to derive a stable per-user gradient color. */
  id?: string;
  size?: AvatarSize;
  className?: string;
};

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-2xl",
};

/**
 * Deterministic gradient pair picker. Hashes the input (user id or name) to
 * one of a curated palette so the same user always gets the same color
 * across every page, and different users are visually distinguishable in
 * lists.
 */
const PALETTE: [string, string][] = [
  ["from-blue-200 to-blue-100", "text-blue-900"],
  ["from-emerald-200 to-emerald-100", "text-emerald-900"],
  ["from-amber-200 to-amber-100", "text-amber-900"],
  ["from-rose-200 to-rose-100", "text-rose-900"],
  ["from-violet-200 to-violet-100", "text-violet-900"],
  ["from-cyan-200 to-cyan-100", "text-cyan-900"],
  ["from-indigo-200 to-indigo-100", "text-indigo-900"],
  ["from-teal-200 to-teal-100", "text-teal-900"],
];

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function Avatar({
  name,
  src,
  id,
  size = "md",
  className = "",
}: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const showImage = src && !errored;

  // Stable per-user palette index based on id, falling back to name.
  const seed = id ?? name;
  const palette = PALETTE[hashString(seed) % PALETTE.length];
  const initials = getInitials(name);

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${SIZE_CLASSES[size]} ${className}`}
      aria-label={name}
    >
      {showImage ? (
        // Plain <img> (not next/image) is intentional here: avatars are
        // rendered at five different sizes via Tailwind classes, next/image
        // requires fixed dimensions + remotePatterns config for Supabase
        // storage, and `loading="lazy"` + `decoding="async"` already give
        // us the LCP/bandwidth wins we need at this scale.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setErrored(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${palette[0]} font-bold ${palette[1]}`}
        >
          {initials}
        </div>
      )}
    </div>
  );
}