import { lazy } from 'react'

const OverviewPage = lazy(() => import('@/pages/OverviewPage'))
const AssistantPage = lazy(() => import('@/pages/AssistantPage'))
const WorkspacePage = lazy(() => import('@/pages/WorkspacePage'))
const CareerPage = lazy(() => import('@/pages/CareerPage'))
const IntelligencePage = lazy(() => import('@/pages/IntelligencePage'))
const AutomationPage = lazy(() => import('@/pages/AutomationPage'))
const MemoryPage = lazy(() => import('@/pages/MemoryPage'))
const SystemPage = lazy(() => import('@/pages/SystemPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

export const PAGE_LAZY: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  overview: OverviewPage,
  assistant: AssistantPage,
  workspace: WorkspacePage,
  career: CareerPage,
  intelligence: IntelligencePage,
  automation: AutomationPage,
  memory: MemoryPage,
  system: SystemPage,
  settings: SettingsPage,
}
