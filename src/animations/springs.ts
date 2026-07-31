import type { Transition } from 'framer-motion'

export const softSpring: Transition = {
  type: 'spring',
  stiffness: 220,
  damping: 26,
  mass: 0.8,
}

export const springLite: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 32,
  mass: 0.6,
}

export const breathe: Transition = {
  duration: 3.2,
  ease: 'easeInOut',
  repeat: Infinity,
  repeatType: 'reverse',
}

export const slowSpin: Transition = {
  duration: 28,
  ease: 'linear',
  repeat: Infinity,
}

export const pulse: Transition = {
  duration: 1.6,
  ease: 'easeInOut',
  repeat: Infinity,
  repeatType: 'reverse',
}
