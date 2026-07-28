'use client'

// A small real map of a trip's destination, shown inside the globe peek card so
// you can see exactly where a trip is (streets, neighborhood) without leaving
// the night-lights globe. Dark, on-brand, free (OpenFreeMap). Kept deliberately
// lightweight and lightly interactive (pan/zoom, no rotate).

import { useRef, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { OPENFREEMAP_STYLE, CREAM, applyDarkTheme } from '@/lib/mapTheme'

export function DestinationMiniMap({
  lat,
  lng,
  className,
  style,
}: {
  lat: number
  lng: number
  className?: string
  style?: React.CSSProperties
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const create = () => {
      if (mapRef.current) return
      // Never build against a zero-size box (it renders black); wait for layout.
      if (container.clientWidth === 0 || container.clientHeight === 0) return

      const map = new maplibregl.Map({
        container,
        style: OPENFREEMAP_STYLE,
        center: [lng, lat],
        zoom: 10.5,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      })
      mapRef.current = map
      map.on('error', (e: any) => console.warn('[DestinationMiniMap]', e?.error?.message ?? e))
      map.on('style.load', () => applyDarkTheme(map))

      // Cream location dot.
      const el = document.createElement('div')
      el.style.cssText =
        'width:14px;height:14px;border-radius:9999px;background:' + CREAM +
        ';border:2px solid #0a0a0a;box-shadow:0 0 0 4px rgba(240,235,227,0.25),0 1px 4px rgba(0,0,0,0.6)'
      new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map)
    }

    const ro = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize()
      else create()
    })
    ro.observe(container)
    create()

    return () => {
      ro.disconnect()
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [lat, lng])

  return <div ref={containerRef} className={className} style={{ background: '#0a0c10', ...style }} />
}
