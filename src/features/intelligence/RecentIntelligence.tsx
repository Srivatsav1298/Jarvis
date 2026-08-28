import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, PanelHeader, Icon, Badge } from '@/components/ui'
import { fetchArticles } from '@/services/intelligence'
import { motion } from 'framer-motion'
import { HiOutlineArrowRight } from 'react-icons/hi2'
import type { Article } from '@/types'

export function RecentIntelligence() {
  const navigate = useNavigate()
  const [articles, setArticles] = useState<Article[]>([])

  useEffect(() => {
    const controller = new AbortController()
    fetchArticles('All', controller.signal)
      .then(setArticles)
      .catch(() => setArticles([]))
    return () => controller.abort()
  }, [])

  const recent = [...articles].sort((a, b) => b.relevance - a.relevance).slice(0, 4)

  return (
    <Card className="p-4">
      <PanelHeader
        title="Recent Intelligence"
        subtitle="Ranked by relevance to you"
        icon={<Icon name="newspaper" className="size-4" />}
        action={
          <button
            onClick={() => navigate('/intelligence')}
            aria-label="Open intelligence"
            className="grid size-7 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-soft-white"
          >
            <HiOutlineArrowRight className="size-3.5" />
          </button>
        }
      />

      <div className="mt-4 space-y-1">
        {recent.map((a, i) => (
          <motion.button
            key={a.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => navigate('/intelligence')}
            className="flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                  {a.category}
                </span>
                <span className="text-[10px] text-muted">· {a.time}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug text-soft-white">
                {a.title}
              </p>
            </div>
            <Badge tone="accent">{a.relevance}</Badge>
          </motion.button>
        ))}
      </div>
    </Card>
  )
}
