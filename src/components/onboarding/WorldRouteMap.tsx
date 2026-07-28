'use client'

import { motion } from 'framer-motion'

type Point = { x: number; y: number }

const CENTER: Point = { x: 150, y: 150 }

const ROUTES: { name: string; dest: Point; control: Point; delay: number }[] = [
  { name: 'Bali', dest: { x: 60, y: 70 }, control: { x: 127.6, y: 84.6 }, delay: 0 },
  { name: 'Iceland', dest: { x: 235, y: 55 }, control: { x: 167.2, y: 79.8 }, delay: 0.35 },
  { name: 'Peru', dest: { x: 258, y: 185 }, control: { x: 193.5, y: 199.8 }, delay: 0.7 },
  { name: 'Morocco', dest: { x: 185, y: 255 }, control: { x: 199.8, y: 191.7 }, delay: 1.05 },
  { name: 'Japan', dest: { x: 65, y: 215 }, control: { x: 86.8, y: 155.5 }, delay: 1.4 },
]

function bezierPoint(t: number, p0: Point, p1: Point, p2: Point): Point {
  const mt = 1 - t
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  }
}

const SAMPLE_COUNT = 28
const MARKER_TRACKS = ROUTES.map(r => {
  const cx: number[] = []
  const cy: number[] = []
  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const p = bezierPoint(i / SAMPLE_COUNT, CENTER, r.control, r.dest)
    cx.push(p.x)
    cy.push(p.y)
  }
  return { cx, cy }
})

const DOT_GRID: Point[] = (() => {
  const pts: Point[] = []
  for (let x = 10; x <= 290; x += 24) {
    for (let y = 10; y <= 290; y += 24) {
      const dx = x - CENTER.x
      const dy = y - CENTER.y
      if (Math.sqrt(dx * dx + dy * dy) > 40) pts.push({ x, y })
    }
  }
  return pts
})()

export function WorldRouteMap() {
  return (
    <div className="relative w-full aspect-square max-w-[340px] mx-auto">
      <svg viewBox="0 0 300 300" className="w-full h-full overflow-visible">
        {DOT_GRID.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.1} fill="rgba(255,255,255,0.1)" />
        ))}

        {ROUTES.map((r, i) => {
          const d = `M ${CENTER.x} ${CENTER.y} Q ${r.control.x} ${r.control.y} ${r.dest.x} ${r.dest.y}`
          return (
            <motion.path
              key={r.name}
              d={d}
              fill="none"
              stroke="rgba(240,235,227,0.35)"
              strokeWidth={1.4}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.1, delay: 0.4 + r.delay, ease: 'easeInOut' }}
            />
          )
        })}

        {ROUTES.map((r, i) => (
          <motion.circle
            key={`marker-${r.name}`}
            r={3.2}
            fill="#F0EBE3"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              cx: MARKER_TRACKS[i].cx,
              cy: MARKER_TRACKS[i].cy,
            }}
            transition={{
              opacity: { duration: 2.6, repeat: Infinity, repeatDelay: 0.6, times: [0, 0.08, 0.92, 1], delay: 1.6 + r.delay },
              cx: { duration: 2.6, repeat: Infinity, repeatDelay: 0.6, ease: 'linear', delay: 1.6 + r.delay },
              cy: { duration: 2.6, repeat: Infinity, repeatDelay: 0.6, ease: 'linear', delay: 1.6 + r.delay },
            }}
            style={{ filter: 'drop-shadow(0 0 4px rgba(240,235,227,0.9))' }}
          />
        ))}

        {ROUTES.map((r, i) => (
          <motion.g
            key={`dest-${r.name}`}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 1.3 + r.delay }}
            style={{ transformOrigin: `${r.dest.x}px ${r.dest.y}px` }}
          >
            <circle cx={r.dest.x} cy={r.dest.y} r={5} fill="#F0EBE3" />
            <circle cx={r.dest.x} cy={r.dest.y} r={9} fill="none" stroke="rgba(240,235,227,0.4)" strokeWidth={1} />
            <text
              x={r.dest.x}
              y={r.dest.y - 13}
              textAnchor="middle"
              fontSize={10}
              fontWeight={700}
              fill="rgba(255,255,255,0.55)"
            >
              {r.name}
            </text>
          </motion.g>
        ))}

        <motion.circle
          cx={CENTER.x}
          cy={CENTER.y}
          r={7}
          fill="#F0EBE3"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />
        <motion.circle
          cx={CENTER.x}
          cy={CENTER.y}
          r={7}
          fill="none"
          stroke="rgba(240,235,227,0.5)"
          strokeWidth={1.5}
          animate={{ r: [7, 26, 7], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeOut' }}
        />
        <text x={CENTER.x} y={CENTER.y + 22} textAnchor="middle" fontSize={10} fontWeight={700} fill="rgba(240,235,227,0.7)">
          You
        </text>
      </svg>
    </div>
  )
}
