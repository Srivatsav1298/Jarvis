import { useEffect, useState } from 'react'
import { Card, PanelHeader, Icon } from '@/components/ui'
import { fetchWeather } from '@/services/intelligence'
import { motion } from 'framer-motion'
import type { Weather } from '@/types'

function weatherIcon(condition: string): string {
  const c = condition.toLowerCase()
  if (c.includes('thunder')) return 'bolt'
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower') || c.includes('snow') || c.includes('fog')) return 'cloud'
  if (c.includes('clear')) return 'sun'
  return 'cloud'
}

export function WeatherCard() {
  const [weather, setWeather] = useState<Weather | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchWeather(controller.signal)
      .then(setWeather)
      .catch(() => setWeather(null))
    return () => controller.abort()
  }, [])

  if (!weather) return null

  return (
    <Card className="p-4">
      <PanelHeader
        title="Weather — Oslo"
        subtitle="Live conditions · Open-Meteo"
        icon={<Icon name={weatherIcon(weather.condition)} className="size-4" />}
      />

      <div className="mt-4 flex items-center gap-4">
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="font-mono text-4xl font-semibold text-soft-white"
        >
          {weather.temperatureC}°
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-soft-white">{weather.condition}</p>
          <p className="text-[11px] text-muted">
            Feels {weather.feelsLikeC}° · {weather.humidity}% humidity · {weather.windKmh} km/h wind
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {weather.daily.map((day, i) => (
          <div
            key={day.date}
            className="rounded-lg border border-white/[0.05] bg-white/[0.03] px-1 py-2 text-center"
          >
            <p className="text-[10px] text-muted">
              {i === 0 ? 'Today' : new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}
            </p>
            <p className="mt-1 text-[10px] leading-tight text-silver">{day.condition}</p>
            <p className="mt-1 font-mono text-[11px] text-soft-white">
              {day.tempMaxC}° <span className="text-muted">{day.tempMinC}°</span>
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}
