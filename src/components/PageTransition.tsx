"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

type PageTransitionProps = {
  children: ReactNode;
};

/**
 * Snappy page entrance. We DON'T block navigation on a manual exit timer
 * (the previous version ate 150ms on every route change); instead we let
 * Next.js render the new page immediately and animate only the entrance,
 * which feels instant under the finger.
 *
 * The entrance is keyed on pathname so a re-mount of the same page (e.g.
 * after a server action revalidate) replays the spring-in.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const [mountedKey, setMountedKey] = useState(pathname);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPath.current) {
      setMountedKey(pathname);
      prevPath.current = pathname;
    }
  }, [pathname]);

  return (
    <div key={mountedKey} className="hb-page-enter">
      {children}
    </div>
  );
}