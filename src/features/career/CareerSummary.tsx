import { useNavigate } from 'react-router-dom'
import { Card, PanelHeader, Icon, Badge, ProgressRing } from '@/components/ui'
import { JOBS } from '@/services/jobs'
import { jobLogoHue } from '@/services/jobs'
import { formatSalary } from '@/utils/format'
import { motion } from 'framer-motion'
import { HiOutlineArrowRight } from 'react-icons/hi2'

export function CareerSummary() {
  const navigate = useNavigate()
  const top = JOBS.filter((j) => j.aiRecommendation === 'top').slice(0, 2)

  return (
    <Card className="p-4">
      <PanelHeader
        title="Career Summary"
        subtitle={`${JOBS.length} active matches · ${JOBS.filter((j) => j.status === 'interview').length} interviews`}
        icon={<Icon name="briefcase" className="size-4" />}
        action={
          <button
            onClick={() => navigate('/career')}
            aria-label="Open career"
            className="grid size-7 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-soft-white"
          >
            <HiOutlineArrowRight className="size-3.5" />
          </button>
        }
      />
      <div className="mt-4 space-y-2">
        {top.map((j, i) => (
          <motion.button
            key={j.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            onClick={() => navigate('/career')}
            className="flex w-full items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.03] p-3 text-left transition-colors hover:border-accent/20 hover:bg-white/[0.05]"
          >
            <span
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 font-semibold text-soft-white"
              style={{
                backgroundImage: `linear-gradient(135deg, hsl(${jobLogoHue(j.company)} 25% 22%), hsl(${jobLogoHue(j.company)} 35% 13%))`,
              }}
            >
              {j.company[0]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-soft-white">{j.role}</p>
              <p className="truncate text-[11px] text-muted">
                {j.company} · {formatSalary(j.salary.min, j.salary.max)}
              </p>
            </div>
            <ProgressRing value={j.match / 100} size={38} stroke={3.5}>
              <span className="font-mono text-[9px] text-soft-white">{j.match}</span>
            </ProgressRing>
          </motion.button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Badge tone="accent">Top matches</Badge>
        <span className="text-[10px] text-muted">
          2 new roles matched in the last 6h
        </span>
      </div>
    </Card>
  )
}
