import { motion } from 'framer-motion'
import { Card, PanelHeader, Icon, Badge } from '@/components/ui'
import { TODAY } from '@/services/schedule'
import { useNavigate } from 'react-router-dom'
import { HiOutlineArrowRight } from 'react-icons/hi2'
import { cn } from '@/utils/cn'

const TYPE_STYLE: Record<string, { icon: string; tone: string; label: string }> = {
  focus: { icon: 'target', tone: 'text-accent border-accent/20 bg-accent/10', label: 'Focus' },
  meeting: { icon: 'users', tone: 'text-silver border-white/10 bg-white/[0.06]', label: 'Meeting' },
  task: { icon: 'check', tone: 'text-ok border-ok/20 bg-ok/10', label: 'Task' },
  reminder: { icon: 'clock', tone: 'text-warn border-warn/20 bg-warn/10', label: 'Reminder' },
  deadline: { icon: 'rocket', tone: 'text-danger border-danger/20 bg-danger/10', label: 'Deadline' },
}

export function UpcomingSchedule({ className }: { className?: string }) {
  const navigate = useNavigate()
  const next = TODAY.slice(0, 5)

  return (
    <Card className={cn('p-4', className)}>
      <PanelHeader
        title="Upcoming Schedule"
        subtitle="Today's timeline"
        icon={<Icon name="calendar" className="size-4" />}
        action={
          <button
            onClick={() => navigate('/system')}
            aria-label="View full schedule"
            className="grid size-7 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-soft-white"
          >
            <HiOutlineArrowRight className="size-3.5" />
          </button>
        }
      />
      <div className="mt-4 space-y-1">
        {next.map((e, i) => {
          const s = TYPE_STYLE[e.type]
          const done = e.done
          return (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.03]"
            >
              <span className={cn('w-11 shrink-0 font-mono text-[11px] text-muted', done && 'line-through opacity-50')}>
                {e.time}
              </span>
              <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg border', s.tone)}>
                <Icon name={s.icon} className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-[13px] font-medium text-soft-white', done && 'opacity-50')}>
                  {e.title}
                </p>
                {e.detail && <p className="truncate text-[11px] text-muted">{e.detail}</p>}
              </div>
              {e.important && (
                <Badge tone="accent">
                  {e.type === 'deadline' ? 'Due today' : 'Priority'}
                </Badge>
              )}
            </motion.div>
          )
        })}
      </div>
    </Card>
  )
}
