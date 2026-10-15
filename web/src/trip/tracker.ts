// Shares the driver's location while a trip runs: watches GPS, queues readings, and sends them every
// 15 seconds. Readings taken while offline are kept and sent in one batch when the connection is back.
import { useEffect, useRef, useState } from 'react'
import { orderApi } from '../api'

export type ShareState = 'waiting' | 'sharing' | 'offline' | 'denied' | 'unsupported'

interface Point {
  lat: number
  lng: number
  accuracy_m: number | null
  speed_mps: number | null
  heading: number | null
  recorded_at: string
}

const SEND_EVERY_MS = 15_000
const MIN_GAP_MS = 5_000 // keep at most one reading every 5 s
const MAX_QUEUE = 200

export function toPoint(pos: GeolocationPosition): Point {
  const c = pos.coords
  return {
    lat: c.latitude,
    lng: c.longitude,
    accuracy_m: Number.isFinite(c.accuracy) ? Math.round(c.accuracy) : null,
    speed_mps: c.speed != null && c.speed >= 0 ? c.speed : null,
    heading: c.heading != null && Number.isFinite(c.heading) ? c.heading : null,
    recorded_at: new Date(pos.timestamp).toISOString(),
  }
}

/** One GPS reading, or null when location is blocked or unavailable. */
export function currentPosition(timeoutMs = 15_000): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 30_000,
    })
  })
}

export function useTripTracker(bookingId: string | null) {
  const [state, setState] = useState<ShareState>('waiting')
  const [lastSent, setLastSent] = useState<number | null>(null)
  const queue = useRef<Point[]>([])
  const lastTaken = useRef(0)

  useEffect(() => {
    if (!bookingId) return
    if (!('geolocation' in navigator)) {
      setState('unsupported')
      return
    }
    let stopped = false
    let sending = false
    queue.current = []
    setState('waiting')

    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.timestamp - lastTaken.current < MIN_GAP_MS) return
        lastTaken.current = pos.timestamp
        queue.current.push(toPoint(pos))
        if (queue.current.length > MAX_QUEUE) queue.current.splice(0, queue.current.length - MAX_QUEUE)
        setState((s) => (s === 'waiting' || s === 'denied' ? 'sharing' : s))
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setState('denied')
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 },
    )

    async function flush() {
      if (sending || stopped || queue.current.length === 0) return
      sending = true
      const batch = queue.current.slice(0, MAX_QUEUE)
      try {
        await orderApi(`/driver/bookings/${bookingId}/location`, { body: { points: batch } })
        queue.current.splice(0, batch.length)
        setLastSent(Date.now())
        setState('sharing')
      } catch (err) {
        // 409: the trip ended elsewhere (admin). Anything else: keep the readings and retry.
        if ((err as { status?: number }).status === 409) queue.current = []
        else setState('offline')
      } finally {
        sending = false
      }
    }
    const timer = window.setInterval(() => void flush(), SEND_EVERY_MS)
    const online = () => void flush()
    window.addEventListener('online', online)

    // Keep the screen on during the trip where the browser allows it (phones stop GPS when it sleeps)
    let wake: WakeLockSentinel | null = null
    const lockScreen = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') wake = await navigator.wakeLock.request('screen')
      } catch {
        wake = null
      }
    }
    void lockScreen()
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void lockScreen()
        void flush()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      stopped = true
      navigator.geolocation.clearWatch(watch)
      window.clearInterval(timer)
      window.removeEventListener('online', online)
      document.removeEventListener('visibilitychange', onVisible)
      void wake?.release().catch(() => undefined)
    }
  }, [bookingId])

  return { state, lastSent }
}
