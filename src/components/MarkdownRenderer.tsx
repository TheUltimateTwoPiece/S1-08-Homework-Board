"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders Pip's markdown replies inside the always-dark slate-800 bubble.
 * Uses plain Tailwind utilities (NOT the `prose` plugin, which isn't installed)
 * and forces light text + dark code surfaces so every element keeps WCAG-AA
 * contrast against the bubble in BOTH light and dark mode.
 */
export function MarkdownRenderer({ text }: { text: string }) {
  return (
    <div className="pip-markdown text-sm leading-relaxed text-white dark:text-white [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="my-2 text-lg font-bold text-white dark:text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="my-2 text-base font-bold text-white dark:text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="my-2 text-sm font-bold text-white dark:text-white">{children}</h3>,
          h4: ({ children }) => <h4 className="my-2 text-sm font-semibold text-white dark:text-white">{children}</h4>,
          h5: ({ children }) => <h5 className="my-2 text-sm font-semibold text-white dark:text-white">{children}</h5>,
          h6: ({ children }) => <h6 className="my-2 text-sm font-semibold text-white dark:text-white">{children}</h6>,
          p: ({ children }) => <p className="my-1.5 text-white dark:text-white">{children}</p>,
          ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5 text-white dark:text-white">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5 text-white dark:text-white">{children}</ol>,
          li: ({ children }) => <li className="text-white dark:text-white">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-white dark:text-white">{children}</strong>,
          em: ({ children }) => <em className="italic text-white dark:text-white">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 underline underline-offset-2 hover:text-blue-200 dark:text-blue-300 dark:hover:text-blue-200"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-slate-700 px-1 py-0.5 font-mono text-xs text-white dark:bg-slate-700 dark:text-white">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-lg border border-slate-700 bg-slate-900 p-3 font-mono text-xs leading-relaxed text-white dark:border-slate-700 dark:bg-slate-900 dark:text-white [&_code]:bg-transparent [&_code]:p-0 [&_code]:rounded-none">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-slate-500 pl-3 text-white dark:border-slate-500 dark:text-white">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-slate-600 dark:border-slate-600" />,
          table: ({ children }) => (
            <table className="my-2 w-full border-collapse text-xs text-white dark:text-white">{children}</table>
          ),
          th: ({ children }) => (
            <th className="border border-slate-600 px-2 py-1 font-semibold text-white dark:text-white">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-slate-600 px-2 py-1 text-white dark:text-white">{children}</td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
