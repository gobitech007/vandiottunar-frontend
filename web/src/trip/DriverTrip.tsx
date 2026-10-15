// Driver side of a trip: start with the customer's code, share location, end with the second code.
import { useState, type FormEvent } from 'react'
import { formatWhen, orderApi, type DriverBooking } from '../api'
import { useT } from '../i18n'
import { currentPosition, useTripTracker } from './tracker'

const EARLY_MIN = 120 // matches START_EARLY_MINUTES in the order-service

export default function DriverTrip({ job, onChange }: { job: DriverBooking; onChange: () => Promise<void> }) {
  const { t } = useT()
  const running = job.status === 'in_progress'
  const { state, lastSent } = useTripTracker(running ? job.id : null)
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const earliest = new Date(job.start_at).getTime() - EARLY_MIN * 60_000
  const canStart = Date.now() >= earliest

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(t.gettingLocation)
    try {
      // Starting needs location (the customer follows the trip); ending sends it if available
      const pos = await currentPosition(running ? 8_000 : 15_000)
      if (!pos && !running) {
        setError(t.locationNeeded)
        return
      }
      setBusy('…')
      await orderApi(`/driver/bookings/${job.id}/${running ? 'end' : 'start'}`, {
        body: { code, lat: pos?.coords.latitude ?? null, lng: pos?.coords.longitude ?? null },
      })
      setOpen(false)
      setCode('')
      await onChange()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const form = open && (
    <form className="code-form" onSubmit={submit}>
      <label htmlFor={`code-${job.id}`}>{running ? t.enterEndCode : t.enterStartCode}</label>
      <p className="hint">{running ? t.endCodeHelp : t.startCodeHelp}</p>
      <div className="code-entry">
        <input
          id={`code-${job.id}`}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          autoFocus
        />
        <button className={`btn ${running ? 'danger' : 'primary'}`} disabled={code.length !== 4 || busy !== null}>
          {running ? t.confirmEnd : t.confirmStart}
        </button>
      </div>
      {busy && busy !== '…' && (
        <p className="reading" role="status">
          <span className="spinner" aria-hidden="true" /> {busy}
        </p>
      )}
    </form>
  )

  if (!running) {
    return (
      <div>
        {!canStart && <p className="muted">{t.tooEarly(formatWhen(new Date(earliest).toISOString()))}</p>}
        {canStart && !open && (
          <button className="btn primary wide" onClick={() => setOpen(true)}>
            ▶ {t.startTrip}
          </button>
        )}
        {form}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  const bad = state === 'denied' || state === 'unsupported' || state === 'offline'
  return (
    <div className="trip-box">
      <h3>{t.tripRunning(formatWhen(job.started_at!))}</h3>
      <p className={`sharing ${bad ? 'bad' : ''}`} role="status">
        {!bad && <span className="live-dot" aria-hidden="true" />}
        <span>
          {state === 'sharing'
            ? t.sharingOn
            : state === 'offline'
              ? t.sharingOffline
              : state === 'waiting'
                ? t.sharingWaiting
                : t.sharingDenied}
          {lastSent && state === 'sharing' && (
            <span className="muted"> · {t.lastSent(t.secondsAgo(Math.round((Date.now() - lastSent) / 1000)))}</span>
          )}
        </span>
      </p>
      <p className="hint">{t.keepOpen}</p>
      {!open && (
        <button className="btn danger wide" onClick={() => setOpen(true)}>
          ■ {t.endTrip}
        </button>
      )}
      {form}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
