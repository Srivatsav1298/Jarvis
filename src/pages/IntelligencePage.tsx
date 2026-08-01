import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PageContainer, PageHeader } from '@/features/shared/PageContainer'
import { ARTICLES, NEWS_CATEGORIES } from '@/services/intelligence'
import type { Article, NewsCategory } from '@/types'
import { Badge, Tabs } from '@/components/ui'
import { HiOutlineArrowRight, HiOutlineArrowTopRightOnSquare } from 'react-icons/hi2'

function ArticleCard({ article, index }: { article: Article; index: number }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: (index % 6) * 0.04, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="glass flex flex-col rounded-card p-4 transition-colors hover:border-white/10"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          {article.category}
        </span>
        <div className="flex items-center gap-2">
          <Badge tone="accent">{article.relevance}%</Badge>
          <span className="text-[10px] text-muted">{article.time}</span>
        </div>
      </div>

      <h3 className="mt-2 text-[15px] font-semibold leading-snug tracking-tight text-soft-white">
        {article.title}
      </h3>

      <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-silver">{article.summary}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {article.tags.map((t) => (
          <span key={t} className="rounded-md border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-silver">
            #{t}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <span className="text-[11px] text-muted">{article.source}</span>
        <a
          href={article.sourceUrl}
          aria-label={`Open article from ${article.source}`}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/10"
        >
          Original source <HiOutlineArrowTopRightOnSquare className="size-3" />
        </a>
      </div>
    </motion.article>
  )
}

export default function IntelligencePage() {
  const [category, setCategory] = useState<NewsCategory | 'All'>('All')
  const [query, setQuery] = useState('')

  const filtered = ARTICLES.filter((a) => {
    if (category !== 'All' && a.category !== category) return false
    if (query && !`${a.title} ${a.summary} ${a.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
      return false
    return true
  }).sort((a, b) => b.relevance - a.relevance)

  const topRelevance = filtered.filter((a) => a.relevance >= 90)

  return (
    <PageContainer className="p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1400px]">
        <PageHeader
          eyebrow="Intelligence"
          title="Research Feed"
          subtitle="Relevance-ranked signals · summaries first, sources second"
          actions={
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter intelligence…"
              aria-label="Filter intelligence"
              className="h-9 w-52 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 text-sm text-soft-white placeholder:text-muted/60 focus:outline-none"
            />
          }
        />

        <Tabs
          className="mb-5"
          items={[{ id: 'All', label: 'All' }, ...NEWS_CATEGORIES.map((c) => ({ id: c, label: c }))]}
          active={category}
          onChange={(id) => setCategory(id as NewsCategory | 'All')}
        />

        <AnimatePresence mode="popLayout">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((a, i) => (
              <ArticleCard key={a.id} article={a} index={i} />
            ))}
          </div>
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="mt-10 text-center text-sm text-muted">No intelligence matches, Sir.</div>
        )}

        {topRelevance.length > 0 && (
          <div className="mt-6">
            <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              <HiOutlineArrowRight className="size-3.5 text-accent" />
              Why these matter to you
            </p>
            <div className="rounded-2xl border border-accent/15 bg-accent/[0.04] p-4">
              <p className="text-[12.5px] leading-relaxed text-silver">
                STARC prioritized <span className="font-semibold text-soft-white">{topRelevance.length} items above 90% relevance</span> because they
                intersect your active projects — vector search optimization, CUDA inference work, and the job search. The rest of the feed remains
                indexed for on-demand review.
              </p>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
