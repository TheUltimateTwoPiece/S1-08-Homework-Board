"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type PendingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingContent?: ReactNode;
  showSpinner?: boolean;
};

export function PendingButton({
  pendingContent,
  showSpinner = true,
  className,
  disabled,
  children,
  ...props
}: PendingButtonProps) {
  const { pending } = useFormStatus();
  const content = pending && pendingContent !== undefined ? pendingContent : children;

  return (
    <button
      {...props}
      disabled={disabled || pending}
      className={`${className ?? ""} ${pending ? "hb-btn--pending" : ""}`}
    >
      {pending && showSpinner ? <span className="hb-spinner" aria-hidden="true" /> : null}
      {content}
    </button>
  );
}

