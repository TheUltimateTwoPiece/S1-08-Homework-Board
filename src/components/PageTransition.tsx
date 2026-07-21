"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

type PageTransitionProps = {
  children: ReactNode;
};

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState("enter");
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPath.current) {
      setTransitionStage("exit");
      const timer = setTimeout(() => {
        setDisplayChildren(children);
        setTransitionStage("enter");
        prevPath.current = pathname;
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setDisplayChildren(children);
    }
  }, [pathname, children]);

  return (
    <div
      className={`transition-all duration-150 ${
        transitionStage === "enter"
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-2"
      }`}
    >
      {displayChildren}
    </div>
  );
}
