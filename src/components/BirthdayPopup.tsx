"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { BirthdaySetting } from "@/lib/types";

type BirthdayPopupProps = {
  setting: BirthdaySetting | null;
  userId: string;
};

const SEEN_KEY_PREFIX = "hb-birthday-popup-seen";
const CONFETTI_COLORS = ["#2563eb", "#f59e0b", "#16a34a", "#e11d48", "#9333ea", "#0891b2"];

function confettiStyle(index: number): CSSProperties {
  const angle = (index * 137.5) % 360;
  const radians = (angle * Math.PI) / 180;
  const distance = 150 + (index % 5) * 34;
  const x = Math.round(Math.cos(radians) * distance);
  const y = Math.round(Math.sin(radians) * distance + 70 + (index % 4) * 18);

  return {
    "--birthday-x": `${x}px`,
    "--birthday-y": `${y}px`,
    "--birthday-rotate": `${(index % 2 === 0 ? 1 : -1) * (180 + (index % 5) * 40)}deg`,
    "--birthday-delay": `${(index % 7) * 55}ms`,
    "--birthday-color": CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    "--birthday-width": `${6 + (index % 3) * 2}px`,
    "--birthday-height": `${10 + (index % 4) * 3}px`,
  } as CSSProperties;
}

export function BirthdayPopup({ setting, userId }: BirthdayPopupProps) {
  const storageKey = `${SEEN_KEY_PREFIX}:${userId}`;
  const activationKey = setting
    ? `${setting.id}:${setting.activated_at ?? setting.updated_at}`
    : "inactive";
  const [open, setOpen] = useState(false);
  const pieces = useMemo(() => Array.from({ length: 32 }, (_, index) => index), []);

  useEffect(() => {
    if (!setting?.active) {
      // localStorage is the external source of truth for the popup's initial
      // visibility. This state sync is intentional after client hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      return;
    }

    try {
      const seen = window.localStorage.getItem(storageKey);
      setOpen(seen !== activationKey);
    } catch {
      // A blocked or full storage area should not prevent the celebration.
      setOpen(true);
    }
  }, [activationKey, setting?.active, storageKey]);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      window.localStorage.setItem(storageKey, activationKey);
    } catch {
      // The popup is still dismissed for this render if storage is unavailable.
    }
  }, [activationKey, storageKey]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dismiss, open]);

  if (!open || !setting?.active) return null;

  return (
    <div className="hb-birthday-layer">
      <div className="hb-birthday-confetti" aria-hidden="true">
        {pieces.map((piece) => (
          <span
            key={piece}
            className="hb-birthday-confetti-piece"
            style={confettiStyle(piece)}
          />
        ))}
      </div>
      <div
        className="hb-birthday-backdrop"
        role="presentation"
        onClick={dismiss}
      />
      <section
        className="hb-birthday-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hb-birthday-title"
        aria-describedby="hb-birthday-message"
      >
        <button
          type="button"
          className="hb-birthday-close"
          onClick={dismiss}
          aria-label="Close birthday message"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="m6 6 12 12" />
            <path d="m18 6-12 12" />
          </svg>
        </button>
        <div className="hb-birthday-cake" aria-hidden="true">
          <span>🎂</span>
        </div>
        <p className="hb-birthday-kicker">A little celebration</p>
        <h2 id="hb-birthday-title" className="hb-birthday-title">
          Happy birthday, {setting.celebrant_name}!
        </h2>
        <p id="hb-birthday-message" className="hb-birthday-message">
          Hope you have a brilliant day.
        </p>
        <button type="button" className="button hb-birthday-button" onClick={dismiss}>
          Thanks!
        </button>
      </section>
    </div>
  );
}
