import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Badge, Button, Card, Icon, ProgressBar, ProgressRing, SearchInput, Switch } from '@/components/ui'

describe('UI primitives', () => {
  it('renders a Button and fires onClick', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Deploy</Button>)
    const btn = screen.getByRole('button', { name: 'Deploy' })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders a Button in loading state', () => {
    render(<Button loading>Running</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('renders Badge tones', () => {
    render(<Badge tone="ok">Healthy</Badge>)
    expect(screen.getByText('Healthy')).toBeInTheDocument()
  })

  it('renders Card with children', () => {
    render(<Card data-testid="card"><span>content</span></Card>)
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('renders Icon for a known name and null for unknown', () => {
    const { rerender } = render(<Icon name="cpu" />)
    expect(document.querySelector('svg')).toBeInTheDocument()
    rerender(<Icon name="does-not-exist" />)
    expect(document.querySelector('svg')).not.toBeInTheDocument()
  })

  it('renders ProgressBar with aria attributes', () => {
    render(<ProgressBar value={0.6} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '60')
  })

  it('renders ProgressRing with nested content', () => {
    render(<ProgressRing value={0.4}><span>40</span></ProgressRing>)
    expect(screen.getByText('40')).toBeInTheDocument()
  })

  it('Switch toggles aria-checked on click', () => {
    function Controlled() {
      const [on, setOn] = useState(false)
      return <Switch checked={on} onChange={setOn} label="Sound" />
    }
    render(<Controlled />)
    const sw = screen.getByRole('switch')
    expect(sw).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(sw)
    expect(sw).toHaveAttribute('aria-checked', 'true')
  })

  it('SearchInput reports value changes', () => {
    const onChange = vi.fn()
    render(<SearchInput placeholder="Find…" onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText('Find…'), { target: { value: 'test' } })
    expect(onChange).toHaveBeenCalledWith('test')
  })
})
