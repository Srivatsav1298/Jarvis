import { useEffect, useState } from 'react'
import { audioService } from '@/services/audio'

/** Returns the current audio level (0..1) sampled on an interval. */
export function useAudioLevel(fps = 12): number {
  const [level, setLevel] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setLevel(audioService.getLevel())
    }, Math.round(1000 / fps))
    return () => window.clearInterval(id)
  }, [fps])

  return level
}

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
