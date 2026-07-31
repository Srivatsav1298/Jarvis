# STARC — AI Operating System Design

**Date:** 2026-08-01
**Status:** Approved
**Stack:** React 19 · TypeScript (strict) · Vite 8 · TailwindCSS 4 · Framer Motion 12 · Zustand 5 · React Router 7 · React Three Fiber 9 + Drei 10 · react-resizable-panels · react-markdown + rehype-highlight · react-icons · Vitest 4

## Vision

STARC (Sir's Tactical AI Research Companion) is a premium AI operating system, not a chatbot, dashboard, or collection of pages. It is an intelligent OS where AI works continuously in the background, proactively organizing information, automating workflows, and surfacing what matters most.

The entire interface is designed around one question:
**"What has STARC already done for Sir, what is it doing now, and what should Sir focus on next?"**

## Experience Goals

- A luxury operating system / billion-dollar AI platform / calm, focused command center.
- STARC always feels alive and busy with meaningful activity — never "Idle."
- Never overwhelming, noisy, or flashy. Clarity over spectacle.

## Architecture

One unified SPA with a persistent shell:

- Floating left navigation rail (glass, hover-expand, animated indicator)
- Top intelligent status bar (greeting, clock, AI status, internet, notifications, command palette, profile)
- Bottom subtle system strip
- Central workspace
- Dockable, resizable right AI Memory panel
- Global command palette (`⌘K`), modal layer, notification system

All data flows through a local mock-services layer (`services/`) so a real backend can be swapped in later without touching components. Zustand stores are the single source of truth.

## Design Tokens

Dark mode only.

| Token | Value |
|---|---|
| `bg` | `#05060A` |
| `graphite` | `#0B0D13` |
| `charcoal` | `#14161C` |
| `gunmetal` | `#1E2128` |
| `steel` | `#2A2E36` |
| `soft-white` | `#F4F6FA` |
| `silver` | `#9AA3AD` |
| `muted` | `#6B7280` |
| `accent` | `#A7E3FF` (very soft cyan, used sparingly) |

- Glass system: subtle transparency, layered blur, ambient light, 1px `white/5` borders, premium shadows, metallic top-edge highlight.
- Type: Inter (UI/display) + JetBrains Mono (console/metrics/code only), self-hosted via `@fontsource`.
- Motion: spring defaults, soft fades, panel transitions, card lift, hover elevation, parallax, ambient glow, progress pulses, orb breathing.

## The Starc Orb

Original energy-core (no movie prop reproduction). R3F scene with layered glass shells, metallic gunmetal torus frame, subtle particle system, energy pulses, expanding rings, and WebAudio-driven sound-reactive rings (simulated analyser, optional mic).

Orb modes: `idle · monitoring · listening · thinking · speaking · processing · completed`. Calm when inactive; energetic only when the AI is actively working. Hover = cursor parallax + tilt. Reduced-motion = static frame. Pauses off-screen (IntersectionObserver) and on hidden tab. Capped DPR, low particle count.

Presence replaces "Idle" with meaningful activity, e.g. *Monitoring your workspace*, *Watching the job market*, *Preparing today's schedule*, *Ready for your next command*.

## Views (lazy routes)

| Route | Page | Purpose |
|---|---|---|
| `/overview` | AI Briefing | "Good morning, Sir" — what STARC did, is doing, and focus next; current activity; orb; today's focus; quick actions; upcoming schedule; career summary; memory snapshot; recent intelligence; system health |
| `/assistant` | Chat | Streaming responses, markdown + code highlighting, pinned/searchable conversations, quick prompts, suggestions, voice mode, thinking indicator, `/` commands |
| `/workspace` | Dockable workspace | Notes · Files · Projects · Browser · Terminal (resizable panels, persisted layout) |
| `/career` | Job intelligence | Opportunity cards (company, role, location, salary, remote, visa, match %, interview probability, AI recommendation, growth, competition, skills, expected salary, AI summary) + Apply/Save/Compare/Ask STARC/Tailor Resume/Cover Letter |
| `/intelligence` | Intelligence feed | Relevance-first summaries + source links; categories AI, Programming, Technology, Research, Cybersecurity, Finance, Career |
| `/automation` | Automations | Job Scan, Email Summary, Calendar Optimization, Daily Briefing, Reminder Engine, Resume Monitor, Knowledge Capture with status + run simulation |
| `/memory` | AI memory | Projects, Goals, Preferences, Pinned Context, Recent Conversations, Important Facts, Timeline, search; `localStorage` persisted |
| `/system` | Health | Battery/CPU/RAM/Storage/Temperature/Internet/Mic/Camera/AI engine — simple health summaries with expandable details |
| `/settings` | Settings | Sound, reduced motion, appearance, data, about |

Navigation sections: Overview · Assistant · Workspace · Career · Intelligence · Automation · Memory · System · Settings.

## Data Flow

- `MetricsSimulator` — smooth noise-walk, 1s tick, 60-point ring buffers.
- `ChatService` — abortable async token-stream generator producing markdown + code.
- `BriefingService` — composes the daily briefing from mock activity.
- `JobsService`, `IntelligenceService`, `ScheduleService`, `AutomationService`, `MemoryService` (localStorage), `AudioService` (WebAudio).

## Accessibility & Performance

- Full keyboard navigation, ARIA, focus rings, high contrast in dark scheme, `prefers-reduced-motion` honored globally.
- Route-level code splitting, transform-only GPU animations, memoization, lazy orb mount, off-screen/hidden-tab animation pause, capped DPR.

## Folder Structure

```
src/
  app/          providers, router, App, ErrorBoundary
  components/   ui/ design system, orb/, charts/
  layouts/      shell, sidebar, topbar, statusstrip, memorydock
  pages/        routed views
  features/     feature-scoped components
  animations/   framer-motion variants/springs
  hooks/        shared hooks
  services/     mock data + simulators
  stores/       zustand stores
  utils/        cn, format
  assets/       static assets
  styles/       tokens.css, index.css
  icons/        icon re-exports
  types/        domain types
```

## Quality Bar

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all green.
- Strict typing, no duplicated logic, consistent naming, scalable structure.
- Every pixel intentional; every panel answers a question.
