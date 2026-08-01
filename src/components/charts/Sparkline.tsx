import { motion } from 'framer-motion'
import { useId } from 'react'
import { areaPath, smoothPath, toPoints } from './path'

export function Sparkline({
  data,
  width = 120,
  height = 36,
  stroke = 'rgba(167,227,255,0.85)',
  fill,
  strokeWidth = 1.5,
  min,
  max,
  className,
}: {
  data: number[]
  width?: number
  height?: number
  stroke?: string
  fill?: string
  strokeWidth?: number
  min?: number
  max?: number
  className?: string
}) {
  const gid = useId().replace(/:/g, '')
  const pts = toPoints(data, width, height, 2, min, max)
  const line = smoothPath(pts)
  const area = areaPath(pts, height)

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={`sg-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fill} stopOpacity="0.35" />
              <stop offset="100%" stopColor={fill} stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path
            d={area}
            fill={`url(#sg-${gid})`}
            animate={{ d: area }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </>
      )}
      <motion.path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        animate={{ d: line }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </svg>
  )
}

export function AreaChart({
  data,
  width = 200,
  height = 64,
  color = '#A7E3FF',
  className,
}: {
  data: number[]
  width?: number
  height?: number
  color?: string
  className?: string
}) {
  const gid = useId().replace(/:/g, '')
  const pts = toPoints(data, width, height, 3)
  const line = smoothPath(pts)
  const area = areaPath(pts, height)

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={`ac-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={area} fill={`url(#ac-${gid})`} animate={{ d: area }} transition={{ duration: 0.5 }} />
      <motion.path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        animate={{ d: line }}
        transition={{ duration: 0.5 }}
      />
    </svg>
  )
}
