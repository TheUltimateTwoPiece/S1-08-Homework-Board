"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownRenderer({ text }: { text: string }) {
  return (
    <div className="pip-markdown prose prose-sm prose-slate max-w-none dark:prose-invert
      prose-headings:text-white dark:prose-headings:text-white
      prose-p:text-white dark:prose-p:text-white
      prose-li:text-white dark:prose-li:text-white
      prose-strong:text-white dark:prose-strong:text-white
      prose-code:bg-slate-700 dark:prose-code:bg-slate-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:text-white dark:prose-code:text-white
      prose-a:text-blue-300 dark:prose-a:text-blue-300
      prose-blockquote:text-white prose-table:text-white
      [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
    ">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
