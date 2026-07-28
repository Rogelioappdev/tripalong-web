'use client'

// 3D globe for TripAlong World. Owns the react-globe.gl instance + ref
// internally so the parent can load it via next/dynamic({ ssr: false })
// without needing ref forwarding (react-globe.gl touches window/WebGL and
// must never run on the server).
//
// Trips are CLUSTERED by geographic proximity, with the cluster radius scaling
// to the zoom level: far out, whole regions collapse into one counted bubble;
// as you zoom in, clusters break apart into smaller clusters and finally single
// pins. This keeps dense areas (US, Europe) clean instead of a pile of
// overlapping photos, and frees up globe surface so pinch-zoom isn't fighting
// the markers. Tapping a cluster flies in to expand it — or, when its trips
// share the same spot and zoom can't separate them, opens a list.

import Globe from 'react-globe.gl'
import { useRef, useEffect, useState, useCallback } from 'react'
import { resizedImage } from '@/lib/imageUrl'
import type { TripWithDetails } from '@/lib/types'

export type GlobePoint = { lat: number; lng: number; trip: TripWithDetails; color: string }

type Cluster = { lat: number; lng: number; sumLat: number; sumLng: number; items: GlobePoint[] }

const MARKER_CSS = `
@keyframes tg-pulse { 0% { transform: scale(0.5); opacity: 0.5 } 70% { opacity: 0 } 100% { transform: scale(2.3); opacity: 0 } }
/* Marker root is non-interactive so gestures pass through the empty area to the
   globe; only the bubble/pin/badge (.tg-clickable) capture taps. */
.tg-marker { position: relative; width: 0; height: 0; transition: opacity 0.2s ease; pointer-events: none; }
.tg-clickable { pointer-events: auto; cursor: pointer; }
.tg-back .tg-clickable { pointer-events: none !important; }

/* Photo pin */
.tg-photo-pulse { position: absolute; left: 0; top: 0; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 9999px; background: rgba(240,235,227,0.3); animation: tg-pulse 2.8s ease-out infinite; pointer-events: none; }
.tg-photo-tail { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 8px solid #F0EBE3; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5)); pointer-events: none; }
.tg-photo-bubble { position: absolute; left: 50%; bottom: 5px; transform: translateX(-50%); width: 36px; height: 36px; border-radius: 9999px; overflow: hidden; border: 2px solid #F0EBE3; background: #111; box-shadow: 0 2px 8px rgba(0,0,0,0.55), 0 0 9px rgba(240,235,227,0.35); display: flex; align-items: center; justify-content: center; font-size: 16px; transition: transform 0.15s ease; }
.tg-photo-bubble:active { transform: translateX(-50%) scale(1.1); }
.tg-photo-img { width: 100%; height: 100%; object-fit: cover; min-width: 0; min-height: 0; display: block; }
.tg-photo-fallback { background: #1a1a1a; }

/* Cluster marker: representative photo with a couple of stacked circles behind
   and a count badge. */
.tg-cluster-stack { position: absolute; bottom: 5px; left: 50%; width: 36px; height: 36px; border-radius: 9999px; background: #141414; border: 2px solid rgba(240,235,227,0.5); box-shadow: 0 2px 6px rgba(0,0,0,0.5); pointer-events: none; }
.tg-cluster-stack.s1 { transform: translateX(-50%) translate(-5px, 3px) scale(0.9); }
.tg-cluster-stack.s2 { transform: translateX(-50%) translate(5px, 3px) scale(0.9); }
.tg-cluster-badge { position: absolute; left: 50%; bottom: 34px; transform: translateX(7px); min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9999px; background: #F0EBE3; color: #0a0a0a; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.55); }

/* Teardrop fallback pin */
.tg-pulse { position: absolute; left: 0; top: 0; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 9999px; background: rgba(240,235,227,0.28); animation: tg-pulse 2.6s ease-out infinite; pointer-events: none; }
.tg-pin { position: absolute; left: 0; bottom: 0; transform: translate(-50%, 0); filter: drop-shadow(0 3px 5px rgba(0,0,0,0.55)) drop-shadow(0 0 6px rgba(240,235,227,0.5)); transition: transform 0.15s ease; }

/* Destination name under single pins — hidden when zoomed out to keep the far
   view clean, fades in as you zoom in (.tg-zoomed toggled on the wrapper). */
.tg-city-label { position: absolute; left: 50%; top: 6px; transform: translateX(-50%); white-space: nowrap; color: #F0EBE3; font-size: 11px; font-weight: 600; letter-spacing: 0.01em; text-shadow: 0 1px 3px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.9); opacity: 0; transition: opacity 0.25s ease; pointer-events: none; }
.tg-zoomed .tg-city-label { opacity: 1; }
`

function injectMarkerCss() {
  if (typeof document === 'undefined' || document.getElementById('tg-marker-css')) return
  const s = document.createElement('style')
  s.id = 'tg-marker-css'
  s.textContent = MARKER_CSS
  document.head.appendChild(s)
}

const PIN_SVG =
  '<svg width="22" height="28" viewBox="0 0 24 30" fill="none">' +
  '<path d="M12 0C5.37 0 0 5.37 0 12c0 8.4 12 18 12 18s12-9.6 12-18C24 5.37 18.63 0 12 0Z" fill="#F0EBE3"/>' +
  '<circle cx="12" cy="12" r="4.4" fill="#0b0b0b"/>' +
  '</svg>'

// Approx angular distance (degrees) — good enough for clustering.
function angDist(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = bLat - aLat
  const dLng = (bLng - aLng) * Math.cos(((aLat + bLat) * 0.5 * Math.PI) / 180)
  return Math.hypot(dLat, dLng)
}

// Cluster radius shrinks as you zoom in (altitude drops), so regions collapse
// far out and split into cities up close.
function radiusForAltitude(alt: number) {
  return Math.max(1.2, Math.min(22, 4.5 * Math.pow(alt, 1.6)))
}

function clusterPoints(points: GlobePoint[], radiusDeg: number): Cluster[] {
  const clusters: Cluster[] = []
  for (const p of points) {
    let best: Cluster | null = null
    for (const c of clusters) {
      if (angDist(c.lat, c.lng, p.lat, p.lng) <= radiusDeg) { best = c; break }
    }
    if (best) {
      best.items.push(p)
      best.sumLat += p.lat; best.sumLng += p.lng
      best.lat = best.sumLat / best.items.length
      best.lng = best.sumLng / best.items.length
    } else {
      clusters.push({ lat: p.lat, lng: p.lng, sumLat: p.lat, sumLng: p.lng, items: [p] })
    }
  }
  return clusters
}

const MAX_ZOOM_ALT = 0.72   // treat this as "as close as it gets"
const SAME_SPOT_DEG = 0.8   // trips within this of the centroid can't be split by zoom

export default function TripGlobe({
  points,
  onSelect,
  onClusterList,
}: {
  points: GlobePoint[]
  onSelect: (trip: TripWithDetails) => void
  onClusterList?: (trips: TripWithDetails[]) => void
}) {
  const globeRef = useRef<any>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<any>(null)
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect
  const onClusterListRef = useRef(onClusterList); onClusterListRef.current = onClusterList
  const pointsRef = useRef(points); pointsRef.current = points
  const lastRadiusRef = useRef(-1)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [clusters, setClusters] = useState<Cluster[]>([])

  useEffect(() => { injectMarkerCss() }, [])

  const recluster = useCallback((alt: number, force = false) => {
    const r = radiusForAltitude(alt)
    if (!force && lastRadiusRef.current > 0 && Math.abs(r - lastRadiusRef.current) / lastRadiusRef.current < 0.08) return
    lastRadiusRef.current = r
    setClusters(clusterPoints(pointsRef.current, r))
  }, [])

  // Recompute clusters whenever the trip set changes.
  useEffect(() => {
    const alt = globeRef.current?.pointOfView?.().altitude ?? 2.5
    recluster(alt, true)
  }, [points, recluster])

  // Size the canvas to the container (and keep it sized on resize).
  useEffect(() => {
    const measure = () => {
      const el = wrapRef.current
      if (el) setDims({ w: el.clientWidth, h: el.clientHeight })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const stopRotate = () => { if (controlsRef.current) controlsRef.current.autoRotate = false }

  // Cluster tap: fly in to expand, or open a list when it can't be split.
  const handleClusterTap = useCallback((cluster: Cluster) => {
    const g = globeRef.current
    if (!g) return
    stopRotate()
    const alt = g.pointOfView().altitude ?? 2.5
    const spread = Math.max(...cluster.items.map(i => angDist(cluster.lat, cluster.lng, i.lat, i.lng)))
    if (spread <= SAME_SPOT_DEG || alt <= MAX_ZOOM_ALT) {
      onClusterListRef.current?.(cluster.items.map(i => i.trip))
    } else {
      g.pointOfView({ lat: cluster.lat, lng: cluster.lng, altitude: Math.max(0.65, alt * 0.5) }, 700)
    }
  }, [])

  // Auto-rotate on load — but stop the instant the user drags/zooms.
  useEffect(() => {
    const g = globeRef.current
    if (!g || dims.w === 0) return
    const controls = g.controls()
    controlsRef.current = controls
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.5
    controls.enableZoom = true
    // Cap zoom-in (blurry texture) and zoom-out (globe shrinks to a dot).
    // Distance = GLOBE_RADIUS(100) * (1 + altitude): 165 ≈ alt 0.65, 500 ≈ alt 4.
    controls.minDistance = 165
    controls.maxDistance = 500
    g.pointOfView({ altitude: 2.5 }, 0)
    const stop = () => { controls.autoRotate = false }
    controls.addEventListener('start', stop)

    // On zoom, re-cluster (radius scales with altitude) and reveal labels up
    // close. Rotation alone doesn't change clusters, so recluster() no-ops then.
    const LABEL_ALT = 1.7
    const onChange = () => {
      const alt = g.pointOfView().altitude ?? 2.5
      wrapRef.current?.classList.toggle('tg-zoomed', alt < LABEL_ALT)
      recluster(alt)
    }
    controls.addEventListener('change', onChange)
    onChange()

    return () => {
      controls.removeEventListener('start', stop)
      controls.removeEventListener('change', onChange)
    }
  }, [dims, recluster])

  const buildPhotoPin = (el: HTMLElement, trip: TripWithDetails) => {
    const cover = trip.cover_image ? resizedImage(trip.cover_image, 80) : ''
    if (cover) {
      const pulse = document.createElement('div'); pulse.className = 'tg-photo-pulse'
      const tail = document.createElement('div'); tail.className = 'tg-photo-tail'
      const bubble = document.createElement('div'); bubble.className = 'tg-photo-bubble tg-clickable'
      const img = document.createElement('img')
      img.src = cover; img.alt = ''; img.className = 'tg-photo-img'
      img.onerror = () => { img.remove(); bubble.classList.add('tg-photo-fallback'); bubble.textContent = '🌍' }
      bubble.appendChild(img)
      el.append(pulse, tail, bubble)
    } else {
      el.innerHTML = `<div class="tg-pulse"></div><div class="tg-pin tg-clickable">${PIN_SVG}</div>`
    }
    const label = document.createElement('div')
    label.className = 'tg-city-label'
    label.textContent = trip.destination
    el.appendChild(label)
  }

  const buildClusterMarker = (el: HTMLElement, cluster: Cluster) => {
    const rep = cluster.items.find(i => i.trip.cover_image) ?? cluster.items[0]
    const s1 = document.createElement('div'); s1.className = 'tg-cluster-stack s1'
    const s2 = document.createElement('div'); s2.className = 'tg-cluster-stack s2'
    const tail = document.createElement('div'); tail.className = 'tg-photo-tail'
    const bubble = document.createElement('div'); bubble.className = 'tg-photo-bubble tg-clickable'
    const cover = rep.trip.cover_image ? resizedImage(rep.trip.cover_image, 80) : ''
    if (cover) {
      const img = document.createElement('img')
      img.src = cover; img.alt = ''; img.className = 'tg-photo-img'
      img.onerror = () => { img.remove(); bubble.classList.add('tg-photo-fallback'); bubble.textContent = '🌍' }
      bubble.appendChild(img)
    } else { bubble.classList.add('tg-photo-fallback'); bubble.textContent = '🌍' }
    const badge = document.createElement('div'); badge.className = 'tg-cluster-badge tg-clickable'
    badge.textContent = String(cluster.items.length)
    el.append(s1, s2, tail, bubble, badge)
  }

  // Build a marker for a cluster (single trip → photo pin, many → counted stack).
  const makeMarker = useCallback((d: object) => {
    const cluster = d as Cluster
    const el = document.createElement('div')
    el.className = 'tg-marker'
    if (cluster.items.length === 1) {
      const trip = cluster.items[0].trip
      buildPhotoPin(el, trip)
      el.onclick = (e) => { e.stopPropagation(); stopRotate(); onSelectRef.current(trip) }
    } else {
      buildClusterMarker(el, cluster)
      el.onclick = (e) => { e.stopPropagation(); handleClusterTap(cluster) }
    }
    return el
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleClusterTap])

  return (
    <div ref={wrapRef} className="absolute inset-0">
      {dims.w > 0 && (
        <Globe
          ref={globeRef}
          width={dims.w}
          height={dims.h}
          backgroundColor="#00000000"
          globeImageUrl="/textures/earth-night.jpg"
          backgroundImageUrl="/textures/night-sky.png"
          atmosphereColor="#7aa7ff"
          atmosphereAltitude={0.16}
          htmlElementsData={clusters}
          htmlLat="lat"
          htmlLng="lng"
          htmlElement={makeMarker}
          htmlElementVisibilityModifier={(el: HTMLElement, isVisible: boolean) => {
            // Hide + disable markers on the far side of the globe.
            el.style.opacity = isVisible ? '1' : '0'
            el.classList.toggle('tg-back', !isVisible)
          }}
        />
      )}
    </div>
  )
}
