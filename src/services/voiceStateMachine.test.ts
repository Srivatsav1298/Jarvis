import { describe, expect, it } from 'vitest'
import { canTransition } from '@/services/voiceStateMachine'

describe('voice state machine', () => {
  it('allows the hands-free happy path', () => {
    expect(canTransition('IDLE', 'LISTENING_FOR_WAKE_WORD')).toBe(true)
    expect(canTransition('LISTENING_FOR_WAKE_WORD', 'LISTENING')).toBe(true)
    expect(canTransition('LISTENING', 'PROCESSING')).toBe(true)
    expect(canTransition('PROCESSING', 'SPEAKING')).toBe(true)
    expect(canTransition('SPEAKING', 'FOLLOW_UP_LISTENING')).toBe(true)
    expect(canTransition('FOLLOW_UP_LISTENING', 'PROCESSING')).toBe(true)
  })

  it('allows interruption and recovery but rejects impossible jumps', () => {
    expect(canTransition('SPEAKING', 'LISTENING')).toBe(true)
    expect(canTransition('ERROR', 'IDLE')).toBe(true)
    expect(canTransition('IDLE', 'SPEAKING')).toBe(false)
    expect(canTransition('LISTENING_FOR_WAKE_WORD', 'PROCESSING')).toBe(false)
  })
})
