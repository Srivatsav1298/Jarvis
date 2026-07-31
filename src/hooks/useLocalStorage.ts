import { useCallback, useEffect, useRef, useState } from 'react'

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  const keyRef = useRef(key)
  keyRef.current = key

  useEffect(() => {
    try {
      window.localStorage.setItem(keyRef.current, JSON.stringify(value))
    } catch {
      /* storage unavailable */
    }
  }, [value])

  const reset = useCallback(() => setValue(initial), [initial])

  return [value, setValue, reset] as const
}

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeStored<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}
