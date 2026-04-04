import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

export function MarkdownMessage({ content, className = '' }: MarkdownMessageProps) {
  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Code blocks
          code({ className: codeClassName, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName || '');
            const isInline = !match;

            if (isInline) {
              return (
                <code
                  className="bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded text-[13px] font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <code className={codeClassName} {...props}>
                {children}
              </code>
            );
          },
          // Wrap pre blocks with copy button and language label
          pre({ children, ...props }) {
            return (
              <div className="relative group my-3">
                <pre
                  className="bg-[#1e1e1e] rounded-lg p-4 overflow-x-auto text-[13px] leading-5 font-mono border border-[var(--border)]"
                  {...props}
                >
                  {children}
                </pre>
                <button
                  className="absolute top-2 right-2 px-2 py-1 rounded text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--text-primary)] transition-all"
                  onClick={() => {
                    const text = (children as React.ReactElement)?.props?.children;
                    if (typeof text === 'string') {
                      navigator.clipboard.writeText(text);
                    }
                  }}
                >
                  Copy
                </button>
              </div>
            );
          },
          // Headings
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold mt-3 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-2 mb-1">{children}</h3>
          ),
          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>
          ),
          // Paragraphs
          p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-[var(--accent)] hover:text-[var(--accent-hover)] underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[var(--accent)] pl-3 my-2 text-[var(--text-secondary)] italic">
              {children}
            </blockquote>
          ),
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-[var(--border)] px-3 py-1.5 bg-[var(--bg-tertiary)] text-left font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-[var(--border)] px-3 py-1.5">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
