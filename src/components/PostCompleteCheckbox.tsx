import { togglePostComplete } from "@/actions/completions";

type PostCompleteCheckboxProps = {
  postId: string;
  completed: boolean;
  compact?: boolean;
};

export function PostCompleteCheckbox({
  postId,
  completed,
  compact = false,
}: PostCompleteCheckboxProps) {
  return (
    <form action={togglePostComplete} className="shrink-0">
      <input type="hidden" name="postId" value={postId} />
      <button
        type="submit"
        aria-label={completed ? "Mark as not done" : "Mark as done"}
        title={completed ? "Mark as not done" : "Mark as done"}
        className={`group flex items-center gap-2 rounded-lg border transition ${
          compact ? "p-2" : "px-3 py-2"
        } ${
          completed
            ? "border-green-300 bg-green-50 text-green-700 hover:border-green-400 hover:bg-green-100"
            : "border-slate-300 bg-white text-slate-600 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700"
        }`}
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
            completed
              ? "border-green-600 bg-green-600 text-white"
              : "border-slate-400 bg-white group-hover:border-indigo-500"
          }`}
        >
          {completed && (
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
          )}
        </span>
        {!compact && (
          <span className="text-sm font-medium">
            {completed ? "Done" : "Mark done"}
          </span>
        )}
      </button>
    </form>
  );
}
