// Customer side of a trip: the code to give the driver, then the live map.
import { useCallback, useState } from 'react'
import { formatWhen, orderApi, type Booking, type Track } from '../api'
import { useT } from '../i18n'
import LiveTrip from './LiveTrip'

function Code({ label, digits, tip }: { label: string; digits: string; tip: string }) {
  return (
    <div className="trip-code">
      <span className="label">{label}</span>
      <span className="digits" aria-label={digits.split('').join(' ')}>
        {digits}
      </span>
      <p>{tip}</p>
    </div>
  )
}

export default function CustomerTrip({ b }: { b: Booking }) {
  const { t } = useT()
  const [showRoute, setShowRoute] = useState(false)
  const load = useCallback(() => orderApi<Track>(`/bookings/${b.id}/track`), [b.id])

  if (b.status === 'assigned' && b.start_code) {
    return <Code label={t.yourStartCode} digits={b.start_code} tip={t.startCodeTip(b.driver_name ?? '')} />
  }
  if (b.status === 'in_progress') {
    return (
      <>
        <p className="ok-text">{t.tripStarted(formatWhen(b.started_at!))}</p>
        {b.end_code && <Code label={t.yourEndCode} digits={b.end_code} tip={t.endCodeTip} />}
        <LiveTrip load={load} live />
      </>
    )
  }
  if (b.status === 'completed' && b.started_at) {
    return (
      <>
        <p className="muted">
          {t.tripStarted(formatWhen(b.started_at))}
          {b.completed_at && ` · ${t.tripEnded(formatWhen(b.completed_at))}`}
          {` · ${t.travelled((b.distance_m / 1000).toFixed(1))}`}
        </p>
        <button className="btn link" onClick={() => setShowRoute((v) => !v)}>
          {showRoute ? t.hideRoute : t.showRoute}
        </button>
        {showRoute && <LiveTrip load={load} live={false} />}
      </>
    )
  }
  return null
}
