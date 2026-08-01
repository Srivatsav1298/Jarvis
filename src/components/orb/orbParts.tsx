import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function glowTexture(): THREE.Texture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(244,246,250,0.95)')
  grad.addColorStop(0.25, 'rgba(167,227,255,0.55)')
  grad.addColorStop(0.6, 'rgba(167,227,255,0.12)')
  grad.addColorStop(1, 'rgba(167,227,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

/** Innermost luminous core with breathing energy sphere. */
export function Core({ intensityRef }: { intensityRef: React.RefObject<number> }) {
  const tex = useMemo(() => glowTexture(), [])
  const coreRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const haloRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const i = intensityRef.current
    const breathe = 1 + Math.sin(t * 0.9) * 0.05 * (0.4 + i)

    if (coreRef.current) {
      coreRef.current.scale.setScalar(breathe)
      const mat = coreRef.current.material as THREE.MeshBasicMaterial
      mat.color.setHSL(0.58, 0.1, 0.9 + i * 0.08)
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1.4 + Math.sin(t * 0.7) * 0.12 * i)
      const mat = glowRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.35 + i * 0.4
    }
    if (haloRef.current) {
      haloRef.current.rotation.y += 0.002 + i * 0.004
      const mat = haloRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.12 + i * 0.2
    }
  })

  return (
    <group>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.52, 48, 48]} />
        <meshBasicMaterial color="#f4f6fa" toneMapped={false} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.05, 32, 32]} />
        <meshBasicMaterial
          map={tex}
          transparent
          opacity={0.4}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={haloRef}>
        <icosahedronGeometry args={[0.95, 2]} />
        <meshBasicMaterial
          wireframe
          transparent
          opacity={0.12}
          color="#a7e3ff"
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/** Layered glass shells rotating at opposing rates. */
export function Shells({ intensityRef }: { intensityRef: React.RefObject<number> }) {
  const outer = useRef<THREE.Mesh>(null)
  const inner = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const dt = state.clock.getDelta()
    const i = intensityRef.current
    if (outer.current) {
      outer.current.rotation.y += dt * (0.04 + i * 0.1)
      outer.current.rotation.x += dt * 0.012
    }
    if (inner.current) {
      inner.current.rotation.y -= dt * (0.06 + i * 0.14)
      inner.current.rotation.z += dt * 0.02
    }
  })

  return (
    <group>
      <mesh ref={outer}>
        <icosahedronGeometry args={[1.55, 1]} />
        <meshPhysicalMaterial
          transparent
          opacity={0.05}
          color="#ffffff"
          roughness={0.2}
          metalness={0.1}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={inner}>
        <icosahedronGeometry args={[1.3, 1]} />
        <meshBasicMaterial
          wireframe
          transparent
          opacity={0.08}
          color="#9aa3ad"
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/** Gunmetal metallic torus frame. */
export function Frame() {
  const g1 = useRef<THREE.Group>(null)
  const g2 = useRef<THREE.Group>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (g1.current) g1.current.rotation.z = Math.PI / 2 + Math.sin(t * 0.2) * 0.08
    if (g2.current) g2.current.rotation.x = Math.PI / 2.2 + Math.cos(t * 0.15) * 0.06
  })

  const ringMat = (
    <meshStandardMaterial
      color="#2a2e36"
      metalness={0.95}
      roughness={0.35}
      transparent
      opacity={0.9}
    />
  )

  return (
    <group>
      <group ref={g1}>
        <mesh>
          <torusGeometry args={[1.9, 0.018, 16, 96]} />
          {ringMat}
        </mesh>
      </group>
      <group ref={g2}>
        <mesh>
          <torusGeometry args={[2.05, 0.012, 16, 96]} />
          {ringMat}
        </mesh>
        <mesh>
          <torusGeometry args={[2.2, 0.008, 16, 96]} />
          <meshStandardMaterial
            color="#3a3f47"
            metalness={0.9}
            roughness={0.4}
            transparent
            opacity={0.6}
          />
        </mesh>
      </group>
    </group>
  )
}

/** Swirling particle field. */
export function Particles({ count = 320, intensityRef }: { count?: number; intensityRef: React.RefObject<number> }) {
  const pointsRef = useRef<THREE.Points>(null)

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      const r = 1.7 + Math.random() * 1.4
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)
    }
    return pos
  }, [count])

  useFrame((state) => {
    if (!pointsRef.current) return
    const i = intensityRef.current
    pointsRef.current.rotation.y += state.clock.getDelta() * (0.05 + i * 0.12)
    const mat = pointsRef.current.material as THREE.PointsMaterial
    mat.size = 0.02 + i * 0.02
    mat.opacity = 0.35 + i * 0.4
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#cdd6e0"
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

/** Expanding energy pulse rings, pooled. */
export function Pulses({ intensityRef }: { intensityRef: React.RefObject<number> }) {
  const spawnAcc = useRef(0)
  const POOL = 6

  const build = () => {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.74, 64),
      new THREE.MeshBasicMaterial({
        color: '#a7e3ff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    )
    mesh.visible = false
    return { mesh, life: 0, mat: mesh.material as THREE.MeshBasicMaterial }
  }

  const pool = useMemo(() => Array.from({ length: POOL }, build), [])

  useFrame((state) => {
    const dt = state.clock.getDelta()
    const t = state.clock.elapsedTime
    const i = intensityRef.current

    spawnAcc.current += dt
    const interval = Math.max(0.35, 1.6 - i * 0.9)
    if (spawnAcc.current > interval) {
      spawnAcc.current = 0
      const ring = pool.find((r) => r.life <= 0)
      if (ring) {
        ring.mesh.visible = true
        ring.life = 1
        ring.mesh.scale.setScalar(0.4)
        ring.mesh.lookAt(0, 0, 0)
        ring.mesh.rotation.z = Math.PI / 2
      }
    }

    for (const ring of pool) {
      if (ring.life <= 0) continue
      ring.life -= dt * 0.45
      if (ring.life <= 0) {
        ring.mesh.visible = false
        continue
      }
      const s = 0.4 + (1 - ring.life) * 2.6
      ring.mesh.scale.setScalar(s)
      ring.mesh.position.setScalar(0)
      ring.mesh.rotation.y = t * 0.2
      ring.mat.opacity = ring.life * 0.4 * i
    }
  })

  return (
    <group>
      {pool.map((ring, idx) => (
        <primitive key={idx} object={ring.mesh} />
      ))}
    </group>
  )
}

/** Concentric sound-reactive rings around the core. */
export function SoundRings({ levelRef }: { levelRef: React.RefObject<number> }) {
  const rings = useRef<Array<THREE.Mesh | null>>([])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const level = levelRef.current
    rings.current.forEach((mesh, idx) => {
      if (!mesh) return
      const phase = idx * 0.33
      const wave = Math.max(0, Math.sin(t * (2.2 + idx * 0.3) + phase)) * level
      const scale = 1.25 + idx * 0.12 + wave * 0.35
      mesh.scale.setScalar(scale)
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.opacity = 0.06 + level * 0.18 + wave * 0.08
    })
  })

  return (
    <group>
      {[0, 1, 2].map((idx) => (
        <mesh
          key={idx}
          ref={(el) => {
            rings.current[idx] = el
          }}
        >
          <ringGeometry args={[0.74 + idx * 0.22, 0.76 + idx * 0.22, 64]} />
          <meshBasicMaterial
            color="#a7e3ff"
            transparent
            opacity={0.08}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  )
}
