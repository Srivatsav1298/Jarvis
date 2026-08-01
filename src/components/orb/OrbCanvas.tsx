import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbScene } from './OrbScene'

export function OrbCanvas({
  active,
  reducedMotion,
}: {
  active: boolean
  reducedMotion: boolean
}) {
  if (!active) {
    return (
      <div
        aria-hidden
        className="grid h-full w-full place-items-center opacity-40"
      >
        <div className="size-[min(52vw,340px)] rounded-full border border-white/[0.07]" />
      </div>
    )
  }

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 6], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      frameloop={reducedMotion ? 'never' : 'always'}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 3, 5]} intensity={30} color="#ffffff" />
      <pointLight position={[-5, -2, 3]} intensity={20} color="#a7e3ff" />
      <Suspense fallback={null}>
        <OrbScene />
      </Suspense>
    </Canvas>
  )
}
