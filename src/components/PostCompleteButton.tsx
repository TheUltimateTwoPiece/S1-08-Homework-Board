"use client";

import { useFormStatus } from "react-dom";

type PostCompleteButtonProps = {
  completed: boolean;
  compact?: boolean;
};

export function PostCompleteButton({
  completed,
  compact = false,
}: PostCompleteButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      aria-label={completed ? "Mark as not done" : "Mark as done"}
      title={completed ? "Mark as not done" : "Mark as done"}
      disabled={pending}
      className={`group flex items-center gap-2 rounded-lg border transition ${
        compact ? "p-2" : "px-3 py-2"
      } ${
        completed ? "hb-check-btn--done" : "hb-check-btn--todo"
      } ${pending ? "hb-check-btn--pending" : ""}`}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
          completed ? "hb-check-icon--done" : "hb-check-icon--todo"
        }`}
      >
        {pending ? (
          <span className="hb-spinner" aria-hidden="true" />
        ) : (
          completed && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                clipRule="evenodd"
              />
            </svg>
          )
        )}
      </span>
      {!compact && (
        <span className="text-sm font-medium">
          {pending ? "Saving..." : completed ? "Done" : "Mark done"}
        </span>
      )}
    </button>
  );
}
