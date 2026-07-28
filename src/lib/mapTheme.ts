import type { Map as MlMap } from 'maplibre-gl'

// Shared MapLibre look for TripAlong's real-map surfaces (currently the small
// "where is this trip" map inside the globe peek card). Free, no-API-key vector
// tiles from OpenFreeMap; the light Positron base is recolored at runtime into a
// dark, TripAlong-flavored map (near-black land, deep water, cream labels).

export const CREAM = '#F0EBE3'

// Self-contained (tiles, glyphs, sprite all served from openfreemap.org).
export const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'

// Recolor the (light) Positron base into a dark, on-brand map. Heuristic by
// layer type + id so it holds up even if upstream tweaks layer names.
export function applyDarkTheme(map: MlMap) {
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
