import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import {
  ApiError,
  formatWhen,
  getUserSession,
  mapLink,
  orderApi,
  setUserSession,
  userApi,
  type Booking,
  type CustomerProfile,
  type DriverBooking,
  type DriverProfile,
} from '../api'
import { useT } from '../i18n'
import BookingFields, { createBooking, draftReady, emptyDraft, type BookingDraft } from './BookingFields'
import CarNumberField from './CarNumberField'
import { cleanCarNumber, validCarNumber } from './CustomerRegister'
import PublicShell from './PublicShell'
import CustomerTrip from '../trip/CustomerTrip'
import DriverTrip from '../trip/DriverTrip'
import { CancelWithFee, ChatButton, PayToConfirm, rupees } from '../trip/BookingConfirm'

/** Where drivers and customers land after registering or logging in. */
export default function Dashboard() {
  const session = getUserSession()
  if (!session) return <Navigate to="/login" replace />
  return (
    <PublicShell>
      <div className="flow wide-flow">
        {session.role === 'driver' ? <DriverDashboard /> : <CustomerDashboard />}
      </div>
    </PublicShell>
  )
}

function useSignedOutOn401() {
  return useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) {
      setUserSession(null)
      window.location.assign('/login')
      return true
    }
    return false
  }, [])
}

function When({ b }: { b: Booking }) {
  const { t } = useT()
  return (
    <p className="when">
      <strong>{formatWhen(b.start_at)}</strong>
      <span className="muted">
        {' → '}
        {b.end_at ? formatWhen(b.end_at) : t.noEnd}
      </span>
    </p>
  )
}

function Pickup({ b }: { b: Booking }) {
  const { t } = useT()
  const place = [b.pickup_address, b.pickup_area, b.pickup_pincode].filter(Boolean).join(', ')
  return (
    <p>
      <span className="muted">{t.pickup}: </span>
      {place}
      {b.pickup_lat != null && b.pickup_lng != null && (
        <>
          {' · '}
          <a href={mapLink(b.pickup_lat, b.pickup_lng)} target="_blank" rel="noreferrer">
            {t.openMap}
          </a>
        </>
      )}
    </p>
  )
}

// ---------------- Driver ----------------

function DriverDashboard() {
  const { t } = useT()
  const signedOut = useSignedOutOn401()
  const [profile, setProfile] = useState<DriverProfile | null>(null)
  const [jobs, setJobs] = useState<DriverBooking[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const p = await userApi<DriverProfile>('/drivers/me')
      setProfile(p)
      if (p.status === 'approved') setJobs(await orderApi<DriverBooking[]>('/driver/bookings'))
    } catch (err) {
      if (!signedOut(err)) setError((err as Error).message)
    }
  }, [signedOut])

  useEffect(() => {
    void load()
  }, [load])

  // New assignments, or a trip the admin closed, show up without a reload
  const approved = profile?.status === 'approved'
  useEffect(() => {
    if (!approved) return
    const timer = window.setInterval(() => void load(), 30_000)
    return () => window.clearInterval(timer)
  }, [approved, load])

  if (!profile) return error ? <p className="error">{error}</p> : <p className="muted">…</p>

  const header = (
    <header className="dash-head">
      <h1>{t.driverDashTitle}</h1>
      {profile.full_name && <p className="muted">{t.hello(profile.full_name)}</p>}
    </header>
  )

  if (profile.status === 'draft' || profile.status === 'rejected') {
    return (
      <>
        {header}
        <section className="card">
          <h2>{profile.status === 'rejected' ? t.rejectedTitle : t.continueRegistration}</h2>
          <p>{profile.rejection_reason ?? t.continueRegistrationBody}</p>
          <Link className="btn primary" to="/register/driver">
            {t.continue} →
          </Link>
        </section>
      </>
    )
  }

  if (profile.status !== 'approved') {
    const suspended = profile.status === 'suspended'
    return (
      <>
        {header}
        <section className={`card status-card ${suspended ? 'is-bad' : ''}`}>
          <div className="status-icon" aria-hidden="true">
            {suspended ? '!' : '…'}
          </div>
          <h2>{suspended ? t.suspendedTitle : t.submittedTitle}</h2>
          <p>{suspended ? profile.rejection_reason : t.submittedBody}</p>
          <p className="muted">{t.contact}</p>
          <button className="btn" onClick={() => void load()}>
            {t.refresh}
          </button>
        </section>
      </>
    )
  }

  // A running trip first, then the rest soonest first
  const upcoming = (jobs ?? [])
    .filter((j) => j.status === 'assigned' || j.status === 'in_progress')
    .reverse()
    .sort((a, b) => Number(b.status === 'in_progress') - Number(a.status === 'in_progress'))
  const past = (jobs ?? []).filter((j) => j.status === 'completed')

  return (
    <>
      {header}
      <p className="notice ok">✓ {t.approvedTitle}</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <h2 className="sub">{t.upcoming}</h2>
      {jobs && upcoming.length === 0 && <p className="card muted">{t.noAssignments}</p>}
      <ul className="booking-list">
        {upcoming.map((j) => (
          <li key={j.id} className="card booking">
            <div className="booking-top">
              <span className={`pill ${j.status === 'in_progress' ? 'status-in_progress' : ''}`}>
                {j.status === 'in_progress' ? t.statusLabels.in_progress : t.bookingTypeLabels[j.booking_type]}
              </span>
              <span className="muted">{j.reference}</span>
            </div>
            <When b={j} />
            <div className="person">
              <div>
                <span className="muted">{t.customer}</span>
                <strong>{j.customer_name ?? '—'}</strong>
                {j.company_name && <span>{j.company_name}</span>}
              </div>
              <a className="btn primary" href={`tel:${j.customer_phone}`}>
                {t.call} {j.customer_phone}
              </a>
            </div>
            <p>
              <span className="muted">{t.vehicleLabels[j.vehicle_class]}: </span>
              <strong>{j.car_number ?? '—'}</strong>
              {j.vehicle_note && <span className="muted"> · {j.vehicle_note}</span>}
            </p>
            <Pickup b={j} />
            {j.notes && <p className="note">“{j.notes}”</p>}
            {j.chat_url && <ChatButton url={j.chat_url} label={t.chatCustomer} />}
            {j.status === 'assigned' && j.payment_status === 'unpaid' ? (
              <p className="notice">{t.waitingConfirm}</p>
            ) : (
              <DriverTrip job={j} onChange={load} />
            )}
          </li>
        ))}
      </ul>
      {past.length > 0 && (
        <details className="past">
          <summary>
            {t.pastTrips} ({past.length})
          </summary>
          <ul className="booking-list">
            {past.map((j) => (
              <li key={j.id} className="card booking muted-card">
                <When b={j} />
                <p>
                  {j.customer_name} · {j.car_number}
                  {j.started_at && ` · ${t.travelled((j.distance_m / 1000).toFixed(1))}`}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  )
}

// ---------------- Customer ----------------

function CustomerDashboard() {
  const { t } = useT()
  const location = useLocation()
  const signedOut = useSignedOutOn401()
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [booking, setBooking] = useState(false)
  // Back from the payment page: /dashboard?booking=<id>&payment=paid|failed
  const [params, setParams] = useSearchParams()
  const [paid] = useState(() => ({ booking: params.get('booking'), outcome: params.get('payment') }))
  const [notice, setNotice] = useState<string | null>(
    paid.outcome === 'paid'
      ? t.paymentDone
      : (location.state as { booked?: boolean } | null)?.booked
        ? t.bookingCreated
        : null,
  )
  const [payError] = useState<string | null>(paid.outcome === 'failed' ? t.paymentFailed : null)
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    if (params.has('payment')) setParams({}, { replace: true }) // don't show it again on reload
  }, [params, setParams])

  const load = useCallback(async () => {
    setError(null)
    try {
      const p = await userApi<CustomerProfile>('/customers/me')
      setProfile(p)
      if (p.profile_complete) setBookings(await orderApi<Booking[]>('/bookings'))
    } catch (err) {
      if (!signedOut(err)) setError((err as Error).message)
    }
  }, [signedOut])

  useEffect(() => {
    void load()
  }, [load])

  const watching = (bookings ?? []).some((b) => b.status === 'pending' || b.status === 'assigned' || b.status === 'in_progress')
  useEffect(() => {
    if (!watching) return
    const timer = window.setInterval(() => void load(), 20_000)
    return () => window.clearInterval(timer)
  }, [watching, load])

  async function cancel(id: string) {
    if (confirming !== id) {
      setConfirming(id)
      return
    }
    setConfirming(null)
    try {
      await orderApi(`/bookings/${id}/cancel`, { body: {} })
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (!profile) return error ? <p className="error">{error}</p> : <p className="muted">…</p>
  if (!profile.profile_complete) return <Navigate to="/register/customer" replace />
  const cancelledNow = paid.outcome === 'cancelled' ? (bookings ?? []).find((x) => x.id === paid.booking) : undefined
  const shownNotice = cancelledNow ? t.cancelledWithFee(rupees(cancelledNow.cancel_fee_paise ?? 0)) : notice

  return (
    <>
      <header className="dash-head">
        <h1>{t.customerDashTitle}</h1>
        <p className="muted">
          {t.hello(profile.full_name ?? '')}
          {profile.company_name && ` · ${profile.company_name}`}
          {profile.car_number && ` · ${profile.car_number}`}
          {' · '}
          <Link to="/register/customer?edit=1">{t.editDetails}</Link>
        </p>
      </header>

      {shownNotice && (
        <p className="notice ok" role="status">
          ✓ {shownNotice}
        </p>
      )}
      {(error || payError) && (
        <p className="error" role="alert">
          {error ?? payError}
        </p>
      )}

      {booking ? (
        <NewBooking
          profile={profile}
          onCancel={() => setBooking(false)}
          onBooked={async () => {
            setBooking(false)
            setNotice(t.bookingCreated)
            await load()
          }}
        />
      ) : (
        <button className="btn primary wide" onClick={() => setBooking(true)}>
          + {t.bookDriver}
        </button>
      )}

      {bookings && bookings.length === 0 && <p className="card muted">{t.noBookings}</p>}
      <ul className="booking-list">
        {(bookings ?? []).map((b) => (
          <li
            key={b.id}
            id={`booking-${b.id}`}
            className={`card booking ${b.status === 'cancelled' ? 'muted-card' : ''} ${b.id === paid.booking ? 'highlight' : ''}`}
          >
            <div className="booking-top">
              <span className={`pill status-${b.status === 'assigned' && b.payment_status !== 'unpaid' ? 'confirmed' : b.status}`}>
                {b.status === 'assigned' && b.payment_status !== 'unpaid' ? t.confirmedPill : t.statusLabels[b.status]}
              </span>
              <span className="muted">{t.bookingRef(b.reference)}</span>
            </div>
            <When b={b} />
            <p>
              <span className="muted">{t.bookingTypeLabels[b.booking_type]} · {t.vehicleLabels[b.vehicle_class]}</span>
              {b.car_number && <strong> · {b.car_number}</strong>}
            </p>
            <Pickup b={b} />
            {(b.status === 'assigned' || b.status === 'in_progress') && b.driver_name && (
              <>
                <div className="person">
                  <div>
                    <span className="muted">{t.yourDriver}</span>
                    <strong>{b.driver_name}</strong>
                  </div>
                </div>
                {b.payment_status === 'unpaid' ? <PayToConfirm b={b} /> : b.chat_url && <ChatButton url={b.chat_url} label={t.chatDriver} />}
              </>
            )}
            <CustomerTrip b={b} />
            {b.status === 'pending' && <p className="muted">{t.findingDriver}</p>}
            {b.status === 'cancelled' && b.cancel_fee_status === 'paid' && (
              <p className="muted">{t.cancelFeePaid(rupees(b.cancel_fee_paise ?? 0))}</p>
            )}
            {(b.status === 'pending' || b.status === 'assigned') &&
              ((b.cancellation_fee_paise ?? 0) > 0 ? (
                <CancelWithFee b={b} />
              ) : (
                <button className={`btn ${confirming === b.id ? 'danger' : ''}`} onClick={() => void cancel(b.id)}>
                  {confirming === b.id ? t.confirmCancel : t.cancelBooking}
                </button>
              ))}
          </li>
        ))}
      </ul>
    </>
  )
}

function NewBooking({
  profile,
  onBooked,
  onCancel,
}: {
  profile: CustomerProfile
  onBooked: () => void
  onCancel: () => void
}) {
  const { t } = useT()
  const [draft, setDraft] = useState<BookingDraft>(() =>
    emptyDraft(profile.needs.includes('on_demand') || profile.needs.length === 0 ? 'on_demand' : 'job'),
  )
  const [carNumber, setCarNumber] = useState(profile.car_number ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const carOk = !carNumber.trim() || validCarNumber(carNumber)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createBooking(draft, { car_number: carNumber.trim() ? cleanCarNumber(carNumber) : null })
      onBooked()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2 className="sub">{t.bookDriver}</h2>
      <BookingFields value={draft} onChange={setDraft} />
      <CarNumberField id="nb-car" label={t.carNumber} value={carNumber} onChange={setCarNumber} invalid={!carOk} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row-between">
        <button type="button" className="btn" onClick={onCancel}>
          {t.back}
        </button>
        <button className="btn primary" disabled={!draftReady(draft) || !carOk || busy}>
          {t.submitBooking}
        </button>
      </div>
    </form>
  )
}
