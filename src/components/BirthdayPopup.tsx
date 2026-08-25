"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { BirthdaySetting } from "@/lib/types";

type BirthdayPopupProps = {
  setting: BirthdaySetting | null;
  userId: string;
  /** IANA timezone the celebration day is measured in (APP_TIME_ZONE). */
  timeZone: string;
  /** Today's calendar date in `timeZone` as YYYY-MM-DD. */
  todayString: string;
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

function dateStringInTimeZone(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function BirthdayPopup({ setting, userId, timeZone, todayString }: BirthdayPopupProps) {
  const storageKey = `${SEEN_KEY_PREFIX}:${userId}`;
  const activationKey = setting
    ? `${setting.id}:${setting.activated_at ?? setting.updated_at}`
    : "inactive";
  const [open, setOpen] = useState(false);
  const pieces = useMemo(() => Array.from({ length: 32 }, (_, index) => index), []);
  const activationTimestamp = setting?.active
    ? setting.activated_at ?? setting.updated_at
    : null;

  useEffect(() => {
    if (!setting?.active) {
      // localStorage is the external source of truth for the banner's initial
      // visibility. This state sync is intentional after client hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      return;
    }

    // A celebration is a single-day event: it only runs on the calendar day
    // (in the school's timezone) it was activated. Once midnight rolls over,
    // the banner must not keep appearing — the admin would otherwise have to
    // remember to turn it off to stop it "extending into the next day".
    const activationDay = dateStringInTimeZone(activationTimestamp, timeZone);
    if (activationDay !== todayString) {
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
  }, [activationKey, activationTimestamp, setting?.active, storageKey, timeZone, todayString]);

  useEffect(() => {
    if (!open) return;

    const timeoutId = window.setTimeout(() => {
      setOpen(false);
      try {
        window.localStorage.setItem(storageKey, activationKey);
      } catch {
        // The banner still disappears if storage is unavailable.
      }
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [activationKey, open, storageKey]);

  if (!open || !setting?.active) return null;

  return (
    <div className="hb-birthday-layer" role="status" aria-live="polite" aria-atomic="true">
      <div className="hb-birthday-confetti" aria-hidden="true">
        {pieces.map((piece) => (
          <span
            key={piece}
            className="hb-birthday-confetti-piece"
            style={confettiStyle(piece)}
          />
        ))}
      </div>
      <div className="hb-birthday-banner">
        <p className="hb-birthday-kicker">Birthday celebration</p>
        <p className="hb-birthday-title">Happy birthday, {setting.celebrant_name}!</p>
        <p className="hb-birthday-message">Hope you have a brilliant day.</p>
      </div>
    </div>
  );
}
