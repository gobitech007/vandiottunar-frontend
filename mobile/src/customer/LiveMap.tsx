// Live trip map for customers: Leaflet in a WebView (no Google Maps key needed), refreshed every 10 s.
import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { orderApi, type Track } from '../api'
import { useT } from '../i18n'
import { colors, styles } from '../ui'

const HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0;background:#e8ede9}</style></head><body><div id="m"></div><script>
var map = L.map('m', {zoomControl: true}).setView([11.0168, 76.9558], 13), layer = L.layerGroup().addTo(map), moved = false;
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '&copy; OpenStreetMap'}).addTo(map);
map.on('dragstart', function(){ moved = true; });
window.update = function(t){
  layer.clearLayers(); var b = [];
  if (t.path.length > 1) { L.polyline(t.path, {color: '#0e3b2e', weight: 5}).addTo(layer); b = b.concat(t.path); }
  if (t.pickup_lat != null) { L.circleMarker([t.pickup_lat, t.pickup_lng], {radius: 7, color: '#0e3b2e', weight: 3, fillColor: '#fffdf8', fillOpacity: 1}).bindTooltip(t.pickupLabel).addTo(layer); b.push([t.pickup_lat, t.pickup_lng]); }
  if (t.last) { L.circleMarker([t.last.lat, t.last.lng], {radius: 10, color: '#fffdf8', weight: 3, fillColor: '#f2b705', fillOpacity: 1}).bindTooltip(t.driverLabel, {permanent: true, direction: 'top', offset: [0, -10]}).addTo(layer); b.push([t.last.lat, t.last.lng]); }
  if (b.length && !moved) map.fitBounds(b, {padding: [30, 30], maxZoom: 16});
};
</script></body></html>`

export default function LiveMap({ bookingId, live }: { bookingId: string; live: boolean }) {
  const { t } = useT()
  const web = useRef<WebView>(null)
  const [track, setTrack] = useState<Track | null>(null)
  const [ready, setReady] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    let stop = false
    const tick = async () => {
      try {
        const data = await orderApi.get<Track>(`/bookings/${bookingId}/track`)
        if (!stop) setTrack(data)
      } catch {
        /* keep the last map */
      }
    }
    void tick()
    if (!live) return () => void (stop = true)
    const a = setInterval(() => void tick(), 10_000)
    const b = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      stop = true
      clearInterval(a)
      clearInterval(b)
    }
  }, [bookingId, live])

  useEffect(() => {
    if (!ready || !track) return
    const data = { ...track, driverLabel: `${t.driverHere}${track.driver_name ? `: ${track.driver_name}` : ''}`, pickupLabel: t.pickupHere }
    web.current?.injectJavaScript(`window.update(${JSON.stringify(data)}); true;`)
  }, [ready, track, t])

  const age = track?.last ? Math.max(0, Math.round((now - new Date(track.last.recorded_at).getTime()) / 1000)) : null
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontWeight: '800', color: colors.green }}>
        {live ? `● ${t.liveLocation}` : t.travelled((track?.distance_km ?? 0).toFixed(1))}
        {live && track ? `  ${track.distance_km.toFixed(1)} km` : ''}
      </Text>
      {live && age != null && <Text style={styles.muted}>{t.updatedAgo(t.secondsAgo(age))}</Text>}
      {live && track && !track.last && <Text style={styles.muted}>{t.noLocationYet}</Text>}
      <View style={{ height: 280, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
        <WebView ref={web} originWhitelist={['*']} source={{ html: HTML }} onLoadEnd={() => setReady(true)} />
      </View>
    </View>
  )
}
