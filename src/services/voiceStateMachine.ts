import type { VoiceInteractionState } from '@/stores/voiceStore'

export const VOICE_TRANSITIONS: Record<VoiceInteractionState, VoiceInteractionState[]> = {
  IDLE: ['LISTENING_FOR_WAKE_WORD', 'LISTENING', 'ERROR'],
  LISTENING_FOR_WAKE_WORD: ['LISTENING', 'IDLE', 'ERROR'],
  LISTENING: ['PROCESSING', 'IDLE', 'ERROR'],
  PROCESSING: ['SPEAKING', 'FOLLOW_UP_LISTENING', 'IDLE', 'ERROR'],
  SPEAKING: ['LISTENING', 'FOLLOW_UP_LISTENING', 'IDLE', 'ERROR'],
  FOLLOW_UP_LISTENING: ['PROCESSING', 'IDLE', 'ERROR'],
  ERROR: ['IDLE', 'LISTENING_FOR_WAKE_WORD', 'LISTENING'],
}

export function canTransition(from: VoiceInteractionState, to: VoiceInteractionState): boolean {
  return from === to || VOICE_TRANSITIONS[from].includes(to)
}
