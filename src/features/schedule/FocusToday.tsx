import { Card, PanelHeader, Icon, Badge } from '@/components/ui'
import { WEATHER, UPCOMING } from '@/services/schedule'
import { motion } from 'framer-motion'

export function FocusToday() {
  return (
    <Card className="p-4">
      <PanelHeader
        title="Today's Focus"
        subtitle={`${WEATHER.city} · ${WEATHER.condition}`}
        icon={<Icon name="target" className="size-4" />}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.06] bg-graphite/50 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              Weather
            </span>
            <Icon name="cloud" className="size-4 text-accent" />
          </div>
          <div className="mt-2 flex items-end justify-between">
            <div>
              <p className="font-mono text-2xl font-semibold text-soft-white">{WEATHER.tempC}°C</p>
              <p className="text-[11px] text-muted">
                {WEATHER.tempF}°F · rain {WEATHER.chanceRain}%
              </p>
            </div>
            <Badge tone="ok">{WEATHER.favorable ? 'Favorable' : 'Unfavorable'}</Badge>
          </div>
          <p className="mt-2 text-[11px] text-muted">Wind {WEATHER.wind} · evening run is clear</p>
        </div>

        <div className="space-y-2">
          {UPCOMING.slice(0, 2).map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
                <Icon name={u.kind === 'interview' ? 'users' : 'calendar'} className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-soft-white">{u.title}</p>
                <p className="text-[10px] text-muted">
                  {u.day} · {u.date} · {u.time}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Card>
  )
}
