import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useOrbStore, intensityFor } from '@/stores/orbStore'
import { audioService } from '@/services/audio'
import { Core, Frame, Particles, Pulses, Shells, SoundRings } from './orbParts'

export function OrbScene() {
  const mode = useOrbStore((s) => s.mode)
  const engagement = useOrbStore((s) => s.engagement)
  const intensityRef = useRef(intensityFor(mode))
  const levelRef = useRef(0)
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    intensityRef.current = intensityFor(mode) + engagement * 0.4
  }, [mode, engagement])

  useFrame((state, delta) => {
    levelRef.current = audioService.getLevel()
    const t = state.clock.elapsedTime
    const i = intensityRef.current
    const group = groupRef.current
    if (!group) return

    const breathe = 1 + Math.sin(t * 0.9) * 0.018 * (0.4 + i)
    group.scale.setScalar(breathe)

    const targetY = state.pointer.x * 0.42
    const targetX = state.pointer.y * 0.26
    group.rotation.y += (targetY - group.rotation.y) * Math.min(1, delta * 3)
    group.rotation.x += (targetX - group.rotation.x) * Math.min(1, delta * 3)
  })

  return (
    <group ref={groupRef}>
      <Frame />
      <Shells intensityRef={intensityRef} />
      <Core intensityRef={intensityRef} />
      <SoundRings levelRef={levelRef} />
      <Pulses intensityRef={intensityRef} />
      <Particles intensityRef={intensityRef} />
    </group>
  )
}
