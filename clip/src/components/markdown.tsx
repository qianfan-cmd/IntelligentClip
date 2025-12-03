import { cn } from "@/lib/utils"
import React, { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"

interface MarkdownProps {
  markdown: string
  className?: string
}

const MarkdownComponents = {
  h1: ({ node, ...props }: any) => (
    <h1
      className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100"
      {...props}
    />
  ),
  h2: ({ node, ...props }: any) => (
    <h2
      className="text-xl font-semibold mt-4 mb-2 text-gray-800 dark:text-gray-100"
      {...props}
    />
  ),
  h3: ({ node, ...props }: any) => (
    <h3
      className="text-lg font-semibold mt-3 mb-1 text-gray-800 dark:text-gray-100"
      {...props}
    />
  ),
  strong: ({ node, ...props }: any) => (
    <strong className="font-bold text-gray-800 dark:text-gray-200" {...props} />
  ),
  em: ({ node, ...props }: any) => (
    <i className="italic text-gray-700 dark:text-gray-300" {...props} />
  ),
  a: ({ node, ...props }: any) => (
    <a
      className="text-blue-500 hover:text-blue-700 underline dark:text-blue-400 dark:hover:text-blue-300"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  blockquote: ({ node, ...props }: any) => (
    <blockquote
      className="border-l-4 border-gray-500 pl-4 italic my-2 text-gray-700 dark:text-gray-300"
      {...props}
    />
  ),
  ul: ({ node, ...props }: any) => (
    <ul className="list-disc ml-5 my-2 space-y-1" {...props} />
  ),
  ol: ({ node, ...props }: any) => (
    <ol className="list-decimal ml-5 my-2 space-y-1" {...props} />
  ),
  li: ({ node, ...props }: any) => (
    <li
      className="text-[12px] leading-relaxed text-gray-600 dark:text-gray-300"
      {...props}
    />
  ),
  p: ({ node, ...props }: any) => (
    <div
      className="text-[12px] leading-relaxed mb-2 text-gray-600 dark:text-gray-300"
      {...props}
    />
  ),
  code: ({ node, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || "")
    return (
      <code
        className={cn(
          "bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 text-[11px] font-mono",
          className
        )}
        {...props}>
        {children}
      </code>
    )
  }
}

export default function Markdown({ markdown, className }: MarkdownProps) {
  return (
    <ReactMarkdown
      className={cn("prose dark:prose-invert max-w-none", className)}
      remarkPlugins={[remarkGfm, remarkMath]}
      components={MarkdownComponents}>
      {markdown || ""}
    </ReactMarkdown>
  )
}
