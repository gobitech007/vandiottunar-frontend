// Trip location sharing in the Android app.
//
// With "Allow all the time" location permission, expo-location runs a foreground service (a
// notification stays visible) and keeps sending GPS points with the screen off or the app in the
// background. Without it, the trip screen shares location only while the app is open.
// Points are sent to the order-service only between the start and end codes.
import * as Location from 'expo-location'
import * as SecureStore from 'expo-secure-store'
import * as TaskManager from 'expo-task-manager'
import { ORDER_API_URL } from './api'
import { loadToken } from './session'

export const TRIP_TASK = 'vandi-trip-location'
const TRIP_KEY = 'vo_active_trip'
const MAX_QUEUE = 200

interface Point {
  lat: number
  lng: number
  accuracy_m: number | null
  speed_mps: number | null
  heading: number | null
  recorded_at: string
}

// Readings that couldn't be sent yet (no signal). Kept in memory; sent with the next batch.
let queue: Point[] = []

export function toPoint(loc: Location.LocationObject): Point {
  const c = loc.coords
  return {
    lat: c.latitude,
    lng: c.longitude,
    accuracy_m: c.accuracy != null ? Math.round(c.accuracy) : null,
    speed_mps: c.speed != null && c.speed >= 0 ? c.speed : null,
    heading: c.heading != null && c.heading >= 0 ? c.heading : null,
    recorded_at: new Date(loc.timestamp).toISOString(),
  }
}

export async function sendPoints(bookingId: string, points: Point[]): Promise<'sent' | 'ended' | 'failed'> {
  queue = [...queue, ...points].slice(-MAX_QUEUE)
  if (!queue.length) return 'sent'
  const token = await loadToken()
  if (!token) return 'failed'
  const batch = queue.slice()
  try {
    const res = await fetch(`${ORDER_API_URL}/driver/bookings/${bookingId}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ points: batch }),
    })
    if (res.status === 409 || res.status === 404) {
      // The trip ended (or was closed by an admin): stop sharing
      queue = []
      await stopTripTracking()
      return 'ended'
    }
    if (!res.ok) return 'failed'
    queue = queue.slice(batch.length)
    return 'sent'
  } catch {
    return 'failed'
  }
}

// Must be defined when the JS bundle loads (index.ts imports this file) so Android can wake it
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TRIP_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return
  const bookingId = await activeTrip()
  if (!bookingId) return
  await sendPoints(bookingId, data.locations.map(toPoint))
})

export async function activeTrip(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TRIP_KEY)
  } catch {
    return null
  }
}

export type TrackingMode = 'background' | 'foreground' | 'denied'

/** Ask for location (and, if the driver agrees, "all the time") and start sharing for this trip. */
export async function startTripTracking(
  bookingId: string,
  notification: { title: string; body: string },
): Promise<TrackingMode> {
  const fg = await Location.requestForegroundPermissionsAsync()
  if (!fg.granted) return 'denied'
  await SecureStore.setItemAsync(TRIP_KEY, bookingId)
  let bg = await Location.getBackgroundPermissionsAsync()
  if (!bg.granted && bg.canAskAgain) bg = await Location.requestBackgroundPermissionsAsync()
  if (!bg.granted) return 'foreground'
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TRIP_TASK)) return 'background'
    await Location.startLocationUpdatesAsync(TRIP_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 15_000,
      distanceInterval: 25,
      deferredUpdatesInterval: 15_000,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: notification.title,
        notificationBody: notification.body,
        notificationColor: '#0E3B2E',
        killServiceOnDestroy: false,
      },
    })
    return 'background'
  } catch {
    return 'foreground' // e.g. running in Expo Go, which can't run background tasks
  }
}

export async function stopTripTracking(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TRIP_TASK)) await Location.stopLocationUpdatesAsync(TRIP_TASK)
  } catch {
    /* not running */
  }
  try {
    await SecureStore.deleteItemAsync(TRIP_KEY)
  } catch {
    /* ignore */
  }
  queue = []
}

export async function isBackgroundTracking(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(TRIP_TASK)
  } catch {
    return false
  }
}
