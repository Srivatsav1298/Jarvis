import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import { useState } from 'react'
import { HiOutlineCheck, HiOutlineClipboard } from 'react-icons/hi2'
import { cn } from '@/utils/cn'

function CodeBlock({
  inline,
  className,
  children,
}: {
  inline?: boolean
  className?: string
  children?: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const isBlock = !inline
  const lang = /language-(\w+)/.exec(className ?? '')?.[1]

  if (!isBlock) {
    return (
      <code className="rounded-md border border-white/10 bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.85em] text-accent">
        {children}
      </code>
    )
  }

  const copy = () => {
    const text = String(children).replace(/\n$/, '')
    void navigator.clipboard?.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-white/[0.08] bg-graphite/70">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          {lang ?? 'code'}
        </span>
        <button
          onClick={copy}
          aria-label="Copy code"
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted transition-colors hover:bg-white/[0.06] hover:text-soft-white"
        >
          {copied ? <HiOutlineCheck className="size-3 text-ok" /> : <HiOutlineClipboard className="size-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 text-[12.5px] leading-relaxed">
        <code className={cn('font-mono', className)}>{children}</code>
      </pre>
    </div>
  )
}

const components: Components = {
  code: CodeBlock,
  pre: ({ children }) => <>{children}</>,
  p: ({ children }) => <p className="my-2.5 leading-relaxed">{children}</p>,
  a: ({ children, href }) => (
    <a
      href={href}
      className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="my-2.5 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2.5 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="marker:text-muted">{children}</li>,
  h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-bold text-soft-white">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-bold text-soft-white">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-3 text-[15px] font-semibold text-soft-white">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-1 mt-3 text-[13px] font-semibold text-soft-white">{children}</h4>,
  strong: ({ children }) => <strong className="font-semibold text-soft-white">{children}</strong>,
  hr: () => <hr className="my-3 border-white/[0.07]" />,
  blockquote: ({ children }) => (
    <blockquote className="my-2.5 border-l-2 border-accent/40 bg-white/[0.03] py-1.5 pl-3 pr-2 text-silver">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-white/[0.07]">
      <table className="w-full text-[12.5px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-white/10 bg-white/[0.04] px-3 py-2 text-left font-semibold text-soft-white">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-b border-white/[0.05] px-3 py-2 text-silver">{children}</td>,
}

export function Markdown({ content }: { content: string }) {
  return (
    <div className="text-[13.5px] text-silver">
      <ReactMarkdown rehypePlugins={[rehypeHighlight]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
