import { useEffect } from 'react'

export type HotkeyHandler = (e: KeyboardEvent) => void

export interface HotkeyBinding {
  /** `mod+k`, `g o`, `escape` … */
  keys: string
  handler: HotkeyHandler
  /** When set, the shortcut only fires while this element (or its descendants) has focus. */
  scope?: HTMLElement
}

function normalize(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.metaKey) parts.push('mod')
  if (e.ctrlKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  const key = e.key.toLowerCase()
  if (!['meta', 'control', 'alt', 'shift'].includes(key)) parts.push(key)
  return parts.join('+')
}

function matches(binding: string, pressed: string): boolean {
  const a = binding.split('+').sort()
  const b = pressed.split('+').sort()
  return a.length === b.length && a.every((k, i) => k === b[i])
}

export function useHotkeys(bindings: HotkeyBinding[]): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const isTyping =
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))

      for (const b of bindings) {
        const keys = b.keys.toLowerCase()
        const modOnly = keys.startsWith('mod+') || keys.startsWith('ctrl+')
        if (isTyping && !modOnly && keys !== 'escape') continue
        if (b.scope && b.scope.contains(document.activeElement)) continue
        if (matches(keys, normalize(e))) {
          e.preventDefault()
          b.handler(e)
          return
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [bindings])
}

export function useGlobalHotkeys(keys: string, handler: HotkeyHandler): void {
  useHotkeys([{ keys, handler }])
}
