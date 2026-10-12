import { useState } from 'react'
import { orderApi, type Booking, type BookingType, type VehicleClass } from '../api'
import { useT } from '../i18n'

export interface BookingDraft {
  start: string // datetime-local value, India time
  end: string
  bookingType: BookingType
  vehicleClass: VehicleClass
  pickupAddress: string
  notes: string
  lat: number | null
  lng: number | null
}

export const emptyDraft = (bookingType: BookingType): BookingDraft => ({
  start: '',
  end: '',
  bookingType,
  vehicleClass: 'four_wheeler',
  pickupAddress: '',
  notes: '',
  lat: null,
  lng: null,
})

const TYPES: BookingType[] = ['on_demand', 'job']
const VEHICLES: VehicleClass[] = ['four_wheeler', 'heavy', 'two_wheeler']

/** Now (rounded up to the next 15 minutes) as a datetime-local value */
function nowLocal(): string {
  const d = new Date(Date.now() + 15 * 60_000)
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const draftReady = (d: BookingDraft) => Boolean(d.start) && (!d.end || d.end > d.start)

export function createBooking(
  d: BookingDraft,
  extra: { car_number?: string | null; pickup_pincode?: string | null; pickup_area?: string | null },
): Promise<Booking> {
  const body: Record<string, unknown> = {
    start_at: d.start,
    end_at: d.end || null,
    booking_type: d.bookingType,
    vehicle_class: d.vehicleClass,
    pickup_address: d.pickupAddress.trim() || null,
    notes: d.notes.trim() || null,
  }
  if (extra.car_number) body.car_number = extra.car_number
  if (extra.pickup_pincode) body.pickup_pincode = extra.pickup_pincode
  if (extra.pickup_area) body.pickup_area = extra.pickup_area
  if (d.lat != null && d.lng != null) {
    body.pickup_lat = d.lat
    body.pickup_lng = d.lng
  }
  return orderApi<Booking>('/bookings', { body })
}

/** When, what and where for a booking. Car number and pincode come from the surrounding form. */
export default function BookingFields({ value, onChange }: { value: BookingDraft; onChange: (d: BookingDraft) => void }) {
  const { t } = useT()
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)
  const set = (patch: Partial<BookingDraft>) => onChange({ ...value, ...patch })
  const min = nowLocal()

  function locate() {
    setLocError(null)
    if (!window.isSecureContext || !navigator.geolocation) {
      setLocError(t.locationInsecure)
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      (err) => {
        setLocError(err.code === err.PERMISSION_DENIED ? t.locationDenied : t.locationUnavailable)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
    )
  }

  return (
    <fieldset className="booking-fields">
      <legend>{t.whenNeeded}</legend>
      <div className="two-col">
        <div>
          <label htmlFor="b-start">{t.startLabel}</label>
          <input
            id="b-start"
            type="datetime-local"
            min={min}
            step={900}
            value={value.start}
            onChange={(e) => set({ start: e.target.value })}
            required
          />
        </div>
        <div>
          <label htmlFor="b-end">{t.endLabel}</label>
          <input
            id="b-end"
            type="datetime-local"
            min={value.start || min}
            step={900}
            value={value.end}
            onChange={(e) => set({ end: e.target.value })}
          />
        </div>
      </div>
      <p className="hint">{t.endHint}</p>

      <fieldset className="chips">
        <legend>{t.bookingFor}</legend>
        {TYPES.map((bt) => (
          <button
            type="button"
            key={bt}
            role="radio"
            aria-checked={value.bookingType === bt}
            className={`chip ${value.bookingType === bt ? 'on' : ''}`}
            onClick={() => set({ bookingType: bt })}
          >
            {t.bookingTypeLabels[bt]}
          </button>
        ))}
      </fieldset>

      <fieldset className="chips">
        <legend>{t.vehicleClass}</legend>
        {VEHICLES.map((vc) => (
          <button
            type="button"
            key={vc}
            role="radio"
            aria-checked={value.vehicleClass === vc}
            className={`chip ${value.vehicleClass === vc ? 'on' : ''}`}
            onClick={() => set({ vehicleClass: vc })}
          >
            {t.vehicleLabels[vc]}
          </button>
        ))}
      </fieldset>

      <label htmlFor="b-address">{t.pickupAddress}</label>
      <input
        id="b-address"
        value={value.pickupAddress}
        onChange={(e) => set({ pickupAddress: e.target.value })}
        maxLength={300}
        autoComplete="street-address"
      />
      <button type="button" className="btn wide" onClick={locate} disabled={locating}>
        {locating ? t.locating : t.useMyLocation}
      </button>
      {value.lat != null && value.lng != null && (
        <p className="ok-text">✓ {value.lat.toFixed(5)}, {value.lng.toFixed(5)}</p>
      )}
      {locError && <p className="error">{locError}</p>}

      <label htmlFor="b-notes">{t.bookingNotes}</label>
      <textarea id="b-notes" rows={2} value={value.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={1000} />
    </fieldset>
  )
}
