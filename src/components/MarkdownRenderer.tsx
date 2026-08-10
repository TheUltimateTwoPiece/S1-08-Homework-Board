"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownRenderer({ text }: { text: string }) {
  return (
    <div className="pip-markdown prose prose-sm prose-slate max-w-none dark:prose-invert
      prose-headings:text-slate-900 dark:prose-headings:text-slate-100
      prose-p:text-slate-700 dark:prose-p:text-slate-300
      prose-li:text-slate-700 dark:prose-li:text-slate-300
      prose-strong:text-slate-900 dark:prose-strong:text-slate-100
      prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
      prose-a:text-blue-600 dark:prose-a:text-blue-400
      [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
    ">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
