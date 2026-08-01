import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[STARC] boundary caught:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid h-screen w-screen place-items-center bg-bg p-6">
          <div className="glass-raised w-full max-w-sm rounded-2xl p-6 text-center">
            <p className="text-sm font-semibold text-soft-white">A subsystem faulted, Sir.</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {this.state.error.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-[10px] border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-medium text-soft-white transition-colors hover:bg-white/10"
            >
              Restart STARC
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
