// The trip panel customers and admins see: live map (refreshed every 10 s), last update, distance.
import { lazy, Suspense, useEffect, useState } from 'react'
import type { Track } from '../api'
import { useT } from '../i18n'

const TrackMap = lazy(() => import('./TrackMap'))
const REFRESH_MS = 10_000
const STALE_S = 120

export default function LiveTrip({ load, live }: { load: () => Promise<Track>; live: boolean }) {
  const { t } = useT()
  const [track, setTrack] = useState<Track | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let stop = false
    const tick = async () => {
      try {
        const data = await load()
        if (!stop) {
          setTrack(data)
          setError(null)
        }
      } catch (err) {
        if (!stop) setError((err as Error).message)
      }
    }
    void tick()
    if (!live) return () => void (stop = true)
    const timer = window.setInterval(() => void tick(), REFRESH_MS)
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      stop = true
      window.clearInterval(timer)
      window.clearInterval(clock)
    }
  }, [load, live])

  if (error && !track) return <p className="error">{error}</p>
  if (!track) return <p className="muted">…</p>
  const age = track.last ? Math.max(0, Math.round((now - new Date(track.last.recorded_at).getTime()) / 1000)) : null

  return (
    <div className="live-trip">
      <div className="live-head">
        {live && <span className="live-dot" aria-hidden="true" />}
        <strong>{live ? t.liveLocation : t.travelled(track.distance_km.toFixed(1))}</strong>
        {live && <span className="muted">{t.distanceSoFar(track.distance_km.toFixed(1))}</span>}
        {live && age != null && <span className="muted">· {t.updatedAgo(t.secondsAgo(age))}</span>}
      </div>
      {live && !track.last && <p className="muted">{t.noLocationYet}</p>}
      {live && age != null && age > STALE_S && <p className="warn-text">{t.locationStale(t.secondsAgo(age))}</p>}
      {(track.last || track.path.length > 0) && (
        <Suspense fallback={<div className="track-map" />}>
          <TrackMap track={track} labels={{ driver: t.driverHere, pickup: t.pickupHere }} />
        </Suspense>
      )}
    </div>
  )
}
