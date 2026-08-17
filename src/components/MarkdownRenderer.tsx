"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders Pip's markdown replies inside the theme-aware chat bubble.
 * Uses the theme's 4-tier text hierarchy tokens (hb-* classes) so text
 * always contrasts with the bubble surface in every theme — including
 * image-generated custom themes where the surface and text colors flip.
 */
export function MarkdownRenderer({ text }: { text: string }) {
  return (
    <div className="pip-markdown hb-body-text text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="hb-page-title my-2 text-lg">{children}</h1>,
          h2: ({ children }) => <h2 className="hb-section-title my-2 text-base">{children}</h2>,
          h3: ({ children }) => <h3 className="hb-section-title my-2 text-sm">{children}</h3>,
          h4: ({ children }) => <h4 className="hb-section-title my-2 text-sm">{children}</h4>,
          h5: ({ children }) => <h5 className="hb-section-title my-2 text-sm">{children}</h5>,
          h6: ({ children }) => <h6 className="hb-section-title my-2 text-sm">{children}</h6>,
          p: ({ children }) => <p className="my-1.5">{children}</p>,
          ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="hb-link">
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="hb-pip-code rounded px-1 py-0.5 font-mono text-xs">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="hb-pip-code-block my-2 overflow-x-auto rounded-lg p-3 font-mono text-xs leading-relaxed [&_code]:bg-transparent [&_code]:p-0 [&_code]:rounded-none">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="hb-pip-quote my-2 pl-3">{children}</blockquote>
          ),
          hr: () => <hr className="hb-pip-rule my-3" />,
          table: ({ children }) => (
            <table className="my-2 w-full border-collapse text-xs">{children}</table>
          ),
          th: ({ children }) => <th className="hb-pip-cell px-2 py-1 font-semibold">{children}</th>,
          td: ({ children }) => <td className="hb-pip-cell px-2 py-1">{children}</td>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
