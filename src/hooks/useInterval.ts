import { useEffect, useReducer, useRef } from 'react'

export function useInterval(callback: () => void, delay: number | null): void {
  const saved = useRef(callback)
  saved.current = callback

  useEffect(() => {
    if (delay === null) return
    const id = window.setInterval(() => saved.current(), delay)
    return () => window.clearInterval(id)
  }, [delay])
}

export function useIsTabActive(): boolean {
  const [tick, force] = useReducer((x: number) => x + 1, 0)
  const active = useRef(!document.hidden)

  useEffect(() => {
    const onVis = () => {
      active.current = !document.hidden
      force()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  void tick
  return active.current
}
