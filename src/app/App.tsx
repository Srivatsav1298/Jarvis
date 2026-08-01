import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Suspense, useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { navItemById } from '@/layouts/nav'
import { LoadingState } from '@/components/ui'
import type { ViewId } from '@/types'
import { PAGE_LAZY } from './lazyPages'
import { Shell } from '@/layouts/Shell'
import { useSyncReducedMotion } from '@/hooks/useReducedMotion'

const VIEWS: Array<{ id: ViewId; path: string }> = [
  { id: 'overview', path: '/' },
  { id: 'assistant', path: '/assistant' },
  { id: 'workspace', path: '/workspace' },
  { id: 'career', path: '/career' },
  { id: 'intelligence', path: '/intelligence' },
  { id: 'automation', path: '/automation' },
  { id: 'memory', path: '/memory' },
  { id: 'system', path: '/system' },
  { id: 'settings', path: '/settings' },
]

function PageLoader() {
  return (
    <div className="grid h-full place-items-center">
      <LoadingState label="Loading workspace" />
    </div>
  )
}

function RoutedContent() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {VIEWS.map((v) => (
          <Route key={v.id} path={v.path} element={<PageComponent id={v.id} />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

function PageComponent({ id }: { id: ViewId }) {
  const setActiveView = useUIStore((s) => s.setActiveView)

  useEffect(() => {
    const nav = navItemById(id)
    if (nav) setActiveView(nav.id)
  }, [id, setActiveView])

  const Cmp = PAGE_LAZY[id]
  if (!Cmp) return null
  return (
    <Suspense fallback={<PageLoader />}>
      <Cmp />
    </Suspense>
  )
}

export function App() {
  useSyncReducedMotion()
  return (
    <Shell>
      <RoutedContent />
    </Shell>
  )
}
