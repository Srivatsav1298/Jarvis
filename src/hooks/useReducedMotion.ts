import { useEffect, useState } from 'react'
import { usePrefersReducedMotion as useFmPrefersReducedMotion } from 'framer-motion'
import { useUIStore } from '@/stores/uiStore'

export function useReducedMotion(): boolean {
  const systemPrefers = useFmPrefersReducedMotion()
  const setting = useUIStore((s) => s.reducedMotion)
  return setting || systemPrefers === true
}

/** Tracks `prefers-reduced-motion` at the system level for CSS + banner hints. */
export function useSystemPrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => setPrefers(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return prefers
}

/** Sync the system preference into the store on mount. */
export function useSyncReducedMotion(): void {
  const prefers = useSystemPrefersReducedMotion()
  useEffect(() => {
    useUIStore.setState({ systemReducedMotion: prefers })
  }, [prefers])
}
