// Map of a trip: the route so far, the driver's latest position and the pickup point.
// Leaflet is loaded only when a map is shown, so the rest of the site stays small.
import type * as Leaflet from 'leaflet'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Track } from '../api'

type L = typeof Leaflet

export default function TrackMap({ track, labels }: { track: Track; labels: { driver: string; pickup: string } }) {
  const box = useRef<HTMLDivElement>(null)
  // userMoved: once someone drags or zooms the map we stop re-fitting it on every update
  const map = useRef<{ L: L; map: Leaflet.Map; layer: Leaflet.LayerGroup; userMoved: boolean; auto: boolean } | null>(null)

  // Create the map once
  useEffect(() => {
    let cancelled = false
    void import('leaflet').then((mod) => {
      const L = (mod.default ?? mod) as L
      if (cancelled || !box.current || map.current) return
      const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([11.0168, 76.9558], 13)
      // OpenStreetMap tiles are fine for development and light use; use a paid tile provider at scale
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(m)
      const state = { L, map: m, layer: L.layerGroup().addTo(m), userMoved: false, auto: false }
      m.on('dragstart', () => (state.userMoved = true))
      m.on('zoomstart', () => {
        if (!state.auto) state.userMoved = true
      })
      map.current = state
      draw()
    })
    return () => {
      cancelled = true
      map.current?.map.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function draw() {
    const m = map.current
    if (!m) return
    const { L, layer } = m
    layer.clearLayers()
    const bounds: [number, number][] = []
    if (track.path.length > 1) {
      L.polyline(track.path, { color: '#0e3b2e', weight: 5, opacity: 0.8 }).addTo(layer)
      bounds.push(...track.path)
    }
    if (track.pickup_lat != null && track.pickup_lng != null) {
      L.circleMarker([track.pickup_lat, track.pickup_lng], { radius: 7, color: '#0e3b2e', weight: 3, fillColor: '#fffdf8', fillOpacity: 1 })
        .bindTooltip(labels.pickup)
        .addTo(layer)
      bounds.push([track.pickup_lat, track.pickup_lng])
    }
    if (track.last) {
      const at: [number, number] = [track.last.lat, track.last.lng]
      if (track.last.accuracy_m && track.last.accuracy_m > 20)
        L.circle(at, { radius: track.last.accuracy_m, color: '#f2b705', weight: 1, fillOpacity: 0.12 }).addTo(layer)
      L.circleMarker(at, { radius: 10, color: '#fffdf8', weight: 3, fillColor: '#f2b705', fillOpacity: 1 })
        .bindTooltip(`${labels.driver}${track.driver_name ? `: ${track.driver_name}` : ''}`, { permanent: true, direction: 'top', offset: [0, -10] })
        .addTo(layer)
      bounds.push(at)
    }
    if (!bounds.length) return
    if (!m.userMoved) {
      // Keep the pickup, the route and the driver in view as the trip goes on
      m.auto = true
      m.map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 16, animate: false })
      m.auto = false // without animation the map's events have already fired
    } else if (track.last && !m.map.getBounds().contains([track.last.lat, track.last.lng])) {
      m.map.panTo([track.last.lat, track.last.lng]) // follow the driver when they leave the view
    }
  }

  useEffect(draw)

  return <div ref={box} className="track-map" role="img" aria-label={labels.driver} />
}
