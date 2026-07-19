'use client'

// MapLibre-based globe for TripAlong World (prototype on /world-next).
//
// Unlike the react-globe.gl texture sphere, this streams real vector map tiles
// (OpenFreeMap — free, no API key): from far away it's a spinnable 3D globe,
// and as you zoom in it morphs into a real street map with sharp city/country
// labels that never blur. Trip pins reuse the photo-bubble design and grow with
// zoom. The base style (Positron) is recolored at runtime into a dark,
// TripAlong-flavored map (near-black land, deep water, cream labels).

import { useRef, useEffect, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { resizedImage } from '@/lib/imageUrl'
import type { TripWithDetails } from '@/lib/types'

export type GlobeMapPoint = { lat: number; lng: number; trip: TripWithDetails }

// Free, no-key vector tiles + style (self-contained: tiles, glyphs and sprite
// all served from openfreemap.org). Swappable for a paid host later with no
// code change beyond this URL.
const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'

const CREAM = '#F0EBE3'

const MARKER_CSS = `
@keyframes tgm-pulse { 0% { transform: scale(0.5); opacity: 0.5 } 70% { opacity: 0 } 100% { transform: scale(2.3); opacity: 0 } }
.tgm-marker { width: 0; height: 0; cursor: pointer; }
/* Inner wrapper carries the zoom scale so it never fights MapLibre's positioning transform on the root. */
.tgm-scale { position: relative; width: 0; height: 0; transform-origin: 50% 100%; transition: transform 0.12s ease-out; will-change: transform; }
.tgm-pulse { position: absolute; left: 0; top: -5px; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 9999px; background: rgba(240,235,227,0.3); animation: tgm-pulse 2.8s ease-out infinite; pointer-events: none; }
.tgm-tail { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 8px solid ${CREAM}; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.6)); }
.tgm-bubble { position: absolute; left: 50%; bottom: 5px; transform: translateX(-50%); width: 36px; height: 36px; border-radius: 9999px; overflow: hidden; border: 2px solid ${CREAM}; background: #111; box-shadow: 0 2px 8px rgba(0,0,0,0.6), 0 0 9px rgba(240,235,227,0.35); display: flex; align-items: center; justify-content: center; font-size: 16px; transition: transform 0.15s ease; }
.tgm-marker:hover .tgm-bubble, .tgm-marker:active .tgm-bubble { transform: translateX(-50%) scale(1.12); }
.tgm-img { width: 100%; height: 100%; object-fit: cover; min-width: 0; min-height: 0; display: block; }
.tgm-fallback { background: #1a1a1a; }
/* Trim MapLibre's default chrome to keep the dark aesthetic clean. */
.maplibregl-ctrl-attrib { background: rgba(0,0,0,0.4) !important; }
.maplibregl-ctrl-attrib a { color: rgba(255,255,255,0.5) !important; }
`

function injectMarkerCss() {
  if (typeof document === 'undefined' || document.getElementById('tgm-marker-css')) return
  const s = document.createElement('style')
  s.id = 'tgm-marker-css'
  s.textContent = MARKER_CSS
  document.head.appendChild(s)
}

// Recolor the (light) Positron base into a dark, on-brand map. Heuristic by
// layer type + id so it holds up even if the upstream style tweaks layer names.
function applyDarkTheme(map: maplibregl.Map) {
  const layers = map.getStyle().layers ?? []
  for (const layer of layers) {
    const id = layer.id
    try {
      if (layer.type === 'background') {
        map.setPaintProperty(id, 'background-color', '#0a0c10')
      } else if (layer.type === 'fill') {
        if (/water|ocean|sea|river|lake|bay/i.test(id)) map.setPaintProperty(id, 'fill-color', '#0d141d')
        else if (/wood|forest|park|grass|green|vegetation|landcover|wetland/i.test(id)) map.setPaintProperty(id, 'fill-color', '#0e1512')
        else if (/building/i.test(id)) map.setPaintProperty(id, 'fill-color', '#171b22')
        else if (/sand|beach/i.test(id)) map.setPaintProperty(id, 'fill-color', '#14140f')
        else map.setPaintProperty(id, 'fill-color', '#0c0f14')
      } else if (layer.type === 'line') {
        if (/water|river/i.test(id)) map.setPaintProperty(id, 'line-color', '#0d141d')
        else if (/boundary|admin/i.test(id)) map.setPaintProperty(id, 'line-color', 'rgba(240,235,227,0.18)')
        else map.setPaintProperty(id, 'line-color', '#1c222b') // roads/rail
      } else if (layer.type === 'symbol') {
        map.setPaintProperty(id, 'text-color', CREAM)
        map.setPaintProperty(id, 'text-halo-color', 'rgba(0,0,0,0.85)')
        map.setPaintProperty(id, 'text-halo-width', 1.3)
      }
    } catch {
      // Layer doesn't support that paint prop — skip.
    }
  }
}

// Space + atmosphere halo so the globe reads against black, like the old one.
function applySky(map: maplibregl.Map) {
  try {
    map.setSky({
      'sky-color': '#05070d',
      'sky-horizon-blend': 0.6,
      'horizon-color': '#0a1830',
      'horizon-fog-blend': 0.5,
      'fog-color': '#0a0f18',
      'fog-ground-blend': 0.7,
    })
  } catch {
    // Older MapLibre without full sky spec — non-fatal.
  }
}

// Pin size vs zoom: small dots on the globe, big obvious pins up close.
function scaleForZoom(zoom: number) {
  const s = 0.62 + (zoom - 2) * 0.14
  return Math.max(0.62, Math.min(2.2, s))
}

function buildMarkerEl(point: GlobeMapPoint, onSelect: (t: TripWithDetails) => void) {
  const trip = point.trip
  const el = document.createElement('div')
  el.className = 'tgm-marker'
  const scale = document.createElement('div')
  scale.className = 'tgm-scale'

  const pulse = document.createElement('div'); pulse.className = 'tgm-pulse'
  const tail = document.createElement('div'); tail.className = 'tgm-tail'
  const bubble = document.createElement('div'); bubble.className = 'tgm-bubble'

  const cover = trip.cover_image ? resizedImage(trip.cover_image, 80) : ''
  if (cover) {
    const img = document.createElement('img')
    img.src = cover; img.alt = ''; img.className = 'tgm-img'
    img.onerror = () => { img.remove(); bubble.classList.add('tgm-fallback'); bubble.textContent = '🌍' }
    bubble.appendChild(img)
  } else {
    bubble.classList.add('tgm-fallback'); bubble.textContent = '🌍'
  }

  scale.append(pulse, tail, bubble)
  el.appendChild(scale)
  el.addEventListener('click', (e) => { e.stopPropagation(); onSelect(trip) })
  return { el, scale }
}

export default function TripGlobeMap({
  points,
  onSelect,
}: {
  points: GlobeMapPoint[]
  onSelect: (trip: TripWithDetails) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<{ marker: maplibregl.Marker; scale: HTMLElement }[]>([])
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  // Latest points kept in a ref so the (lazily-created) map can build markers on
  // first render even if it wasn't ready when the points effect last ran.
  const pointsRef = useRef(points)
  pointsRef.current = points

  const rebuildMarkers = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    for (const { marker } of markersRef.current) marker.remove()
    markersRef.current = []
    const s = scaleForZoom(map.getZoom())
    for (const point of pointsRef.current) {
      const { el, scale } = buildMarkerEl(point, (t) => onSelectRef.current(t))
      scale.style.transform = `scale(${s})`
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([point.lng, point.lat])
        .addTo(map)
      markersRef.current.push({ marker, scale })
    }
  }, [])

  // Create the map — but only once the container actually has a size. Creating
  // it against a zero-height box (which happens when this mounts before layout
  // settles, e.g. via next/dynamic or the World engine toggle) makes MapLibre
  // fall back to a default tiny canvas and render pure black. A ResizeObserver
  // both defers creation until there's real space and keeps the canvas synced
  // to the container afterwards. Mirrors how the classic globe gates on size.
  useEffect(() => {
    injectMarkerCss()
    const container = containerRef.current
    if (!container) return

    const create = () => {
      if (mapRef.current) return
      if (container.clientWidth === 0 || container.clientHeight === 0) return

      const map = new maplibregl.Map({
        container,
        style: OPENFREEMAP_STYLE,
        center: [10, 25],
        zoom: 1.6,
        minZoom: 0.8,
        maxZoom: 16,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      })
      mapRef.current = map

      map.on('error', (e: any) => console.warn('[TripGlobeMap]', e?.error?.message ?? e))
      map.on('style.load', () => {
        try { map.setProjection({ type: 'globe' }) } catch { /* older GL */ }
        applySky(map)
        applyDarkTheme(map)
      })
      // Grow/shrink pins with zoom.
      map.on('zoom', () => {
        const s = scaleForZoom(map.getZoom())
        for (const { scale } of markersRef.current) scale.style.transform = `scale(${s})`
      })
      rebuildMarkers()
    }

    const ro = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize()
      else create()
    })
    ro.observe(container)
    create() // in case it's already sized

    return () => {
      ro.disconnect()
      mapRef.current?.remove()
      mapRef.current = null
      markersRef.current = []
    }
  }, [rebuildMarkers])

  // Rebuild markers when the trip set changes (no-op until the map exists).
  useEffect(() => { rebuildMarkers() }, [points, rebuildMarkers])

  return <div ref={containerRef} className="absolute inset-0" style={{ background: '#000', width: '100%', height: '100%' }} />
}
