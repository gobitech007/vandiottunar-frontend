import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  adminOrderApi,
  formatWhen,
  mapLink,
  type AdminBooking,
  type AutoAssignResult,
  type Candidate,
  type ChatMessage,
  type Track,
} from '../api'
import { EnglishOnly } from '../i18n'
import LiveTrip from '../trip/LiveTrip'
import { TYPE, VEHICLE } from './Bookings'

const STATUS: Record<string, string> = {
  pending: 'Waiting for a driver',
  assigned: 'Assigned',
  in_progress: 'On a trip',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>()
  const [booking, setBooking] = useState<AdminBooking | null>(null)
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [chat, setChat] = useState<ChatMessage[] | null>(null)

  const load = useCallback(async () => {
    try {
      const b = await adminOrderApi<AdminBooking>(`/admin/bookings/${id}`)
      setBooking(b)
      setCandidates(b.status === 'pending' ? await adminOrderApi<Candidate[]>(`/admin/bookings/${id}/candidates`) : null)
      setChat(b.driver_name ? await adminOrderApi<ChatMessage[]>(`/admin/bookings/${id}/chat`) : null)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const tripLoad = useCallback(() => adminOrderApi<Track>(`/admin/bookings/${id}/track`), [id])

  async function run(fn: () => Promise<unknown>, done?: string) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await fn()
      if (done) setMessage(done)
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function autoAssign() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const r = await adminOrderApi<AutoAssignResult>(`/admin/bookings/${id}/auto-assign`, { method: 'POST' })
      if (r.assigned) setMessage(`Assigned automatically to ${r.driver_name}.`)
      else setError(r.reason ?? 'No eligible driver')
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!booking) {
    return (
      <div className="page">
        <Link to="/admin/bookings">← All bookings</Link>
        {error ? <p className="error">{error}</p> : <p>Loading…</p>}
      </div>
    )
  }

  const eligible = (candidates ?? []).filter((c) => c.eligible)
  const shown = showAll ? candidates ?? [] : eligible
  const active = booking.status === 'pending' || booking.status === 'assigned'

  return (
    <div className="page">
      <Link to={`/admin/bookings?status=${booking.status}`}>← All bookings</Link>
      <header className="page-head">
        <div>
          <h1>Booking {booking.reference}</h1>
          <p className="muted">
            {TYPE[booking.booking_type]} · {VEHICLE[booking.vehicle_class]} · booked {formatWhen(booking.created_at)}
          </p>
        </div>
        <span className={`status status-${booking.status === 'pending' ? 'submitted' : booking.status === 'assigned' || booking.status === 'in_progress' ? 'approved' : booking.status === 'cancelled' ? 'rejected' : 'draft'}`}>
          {STATUS[booking.status]}
        </span>
      </header>

      {message && (
        <p className="notice ok" role="status">
          ✓ {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="grid">
        <section className="card">
          <h2>When and where</h2>
          <dl>
            <dt>Starts</dt>
            <dd>{formatWhen(booking.start_at)}</dd>
            <dt>Ends</dt>
            <dd>{booking.end_at ? formatWhen(booking.end_at) : 'No end date'}</dd>
            <dt>Pickup</dt>
            <dd>
              {[booking.pickup_address, booking.pickup_area, booking.pickup_pincode].filter(Boolean).join(', ')}
              {booking.pickup_lat != null && booking.pickup_lng != null && (
                <>
                  {' · '}
                  <a href={mapLink(booking.pickup_lat, booking.pickup_lng)} target="_blank" rel="noreferrer">
                    map
                  </a>
                </>
              )}
            </dd>
            <dt>Notes</dt>
            <dd>{booking.notes ?? '—'}</dd>
            {booking.status === 'cancelled' && (
              <>
                <dt>Cancelled</dt>
                <dd>
                  by {booking.cancelled_by ?? '—'}
                  {booking.cancel_reason && <span className="muted"> · {booking.cancel_reason}</span>}
                  {booking.cancel_fee_status === 'paid' && (
                    <div>
                      <span className="pill ok">₹{(booking.cancel_fee_paise ?? 0) / 100} cancellation fee paid</span>
                      {booking.cancel_payment_id && <span className="muted"> · {booking.cancel_payment_id}</span>}
                    </div>
                  )}
                </dd>
              </>
            )}
            {booking.rates && (
              <>
                <dt>Driver fare</dt>
                <dd>
                  {booking.fare ? (
                    <>
                      <strong>₹{(booking.fare.total_paise / 100).toLocaleString('en-IN')}</strong>{' '}
                      <span className="muted">
                        {booking.fare.basis === 'actual' ? 'actual' : 'estimate'} · {booking.fare.hours} h
                        {booking.fare.days > 0 && ` = ${booking.fare.days} day × ₹${booking.fare.daily_rate_paise / 100}`}
                        {booking.fare.extra_hours > 0 &&
                          `${booking.fare.days > 0 ? ' +' : ' ='} ${booking.fare.extra_hours} h × ₹${booking.fare.hourly_rate_paise / 100}`}
                        {booking.fare.discount_paise > 0 &&
                          ` − ${booking.fare.discount_pct}% new customer (₹${booking.fare.discount_paise / 100})`}
                      </span>
                    </>
                  ) : (
                    <span className="muted">
                      No end time: ₹{booking.rates.hourly_rate_paise / 100}/h, ₹{booking.rates.daily_rate_paise / 100} per{' '}
                      {booking.rates.daily_hours} h day
                      {booking.rates.discount_pct > 0 && ` · ${booking.rates.discount_pct}% new customer discount`}
                    </span>
                  )}
                </dd>
              </>
            )}
            <dt>Confirmation</dt>
            <dd>
              {booking.payment_status === 'paid' ? (
                <span className="pill ok">₹1 paid {formatWhen(booking.paid_at)}</span>
              ) : booking.payment_status === 'waived' ? (
                <span className="pill ok">Fee waived by admin</span>
              ) : (
                <>
                  <span className="pill">Not paid</span>
                  {active && (
                    <>
                      {' '}
                      <button
                        className="btn link"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => adminOrderApi(`/admin/bookings/${id}/waive-payment`, { method: 'POST' }),
                            'Booking confirmed without payment.',
                          )
                        }
                      >
                        Confirm without payment
                      </button>
                    </>
                  )}
                </>
              )}
              {booking.payment_id && <div className="muted">Payment {booking.payment_id}</div>}
            </dd>
          </dl>
        </section>
        <section className="card">
          <h2>Customer</h2>
          <dl>
            <dt>Name</dt>
            <dd>{booking.customer_name ?? '—'}</dd>
            {booking.company_name && (
              <>
                <dt>Company</dt>
                <dd>{booking.company_name}</dd>
              </>
            )}
            <dt>Phone</dt>
            <dd>
              <a href={`tel:${booking.customer_phone}`}>{booking.customer_phone}</a>
            </dd>
            <dt>Vehicle</dt>
            <dd>
              {VEHICLE[booking.vehicle_class]} · {booking.car_number ?? '—'}
              {booking.vehicle_note && <span className="muted"> · {booking.vehicle_note}</span>}
            </dd>
          </dl>
        </section>
      </div>

      {(booking.status === 'in_progress' || (booking.status === 'completed' && booking.started_at)) && (
        <section className="card">
          <h2>Trip</h2>
          <p>
            <strong>{booking.driver_name}</strong> · <a href={`tel:${booking.driver_phone}`}>{booking.driver_phone}</a>
            <span className="muted">
              {' '}
              · started with the customer's code {formatWhen(booking.started_at)}
              {booking.completed_at && ` · ended ${formatWhen(booking.completed_at)}`}
            </span>
          </p>
          <EnglishOnly>
            <LiveTrip key={booking.status} load={tripLoad} live={booking.status === 'in_progress'} />
          </EnglishOnly>
          {booking.status === 'in_progress' && (
            <p>
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  void run(() => adminOrderApi(`/admin/bookings/${id}/complete`, { method: 'POST' }), 'Trip completed by admin.')
                }
              >
                Complete without the end code
              </button>{' '}
              <span className="hint">Only if the driver can't enter the code (phone dead, no signal).</span>
            </p>
          )}
        </section>
      )}

      {booking.status === 'assigned' && (
        <section className="card">
          <h2>Driver</h2>
          <p>
            <strong>{booking.driver_name}</strong> · <a href={`tel:${booking.driver_phone}`}>{booking.driver_phone}</a>
            <span className="muted">
              {' '}
              · assigned {booking.assignment_mode === 'auto' ? 'automatically' : 'manually'} {formatWhen(booking.assigned_at)}
            </span>
          </p>
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              void run(() => adminOrderApi(`/admin/bookings/${id}/unassign`, { body: { reason: reason || null } }), 'Driver removed.')
            }
          >
            Remove driver
          </button>{' '}
          <button
            className="btn"
            disabled={busy || new Date(booking.start_at) > new Date()}
            onClick={() => void run(() => adminOrderApi(`/admin/bookings/${id}/complete`, { method: 'POST' }), 'Marked completed.')}
          >
            Mark completed
          </button>
          <p className="hint">The driver starts the trip with the start code the customer sees in their bookings.</p>
        </section>
      )}

      {chat && chat.length > 0 && (
        <section className="card">
          <h2>WhatsApp chat ({chat.length})</h2>
          <p className="hint">Messages relayed between the customer and the driver through the business number.</p>
          <ul className="chat-log">
            {chat.map((m, i) => (
              <li key={i} className={m.sender}>
                <span className="meta">
                  {m.sender === 'customer' ? booking.customer_name ?? 'Customer' : booking.driver_name ?? 'Driver'} ·{' '}
                  {formatWhen(m.created_at)}
                  {m.delivery === 'failed' && ' · not delivered'}
                </span>
                {m.body}
              </li>
            ))}
          </ul>
        </section>
      )}

      {booking.status === 'pending' && candidates && (
        <section className="card">
          <div className="row-between">
            <h2>Choose a driver</h2>
            <button className="btn primary" disabled={busy || eligible.length === 0} onClick={() => void autoAssign()}>
              Auto-assign best match
            </button>
          </div>
          <p className="hint">
            {eligible.length} of {candidates.length} approved drivers can take this booking. Best fit first: inside their
            service area, nearest, same pincode, fewest bookings.
          </p>
          <label className="check">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Also show drivers who can't take it, with the reason
          </label>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Licence</th>
                  <th>Distance</th>
                  <th>Area</th>
                  <th>Bookings</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.driver_user_id} className={c.eligible ? '' : 'muted-row'}>
                    <td>
                      {c.full_name ?? '—'}
                      <div className="muted">
                        {c.phone}
                        {c.experience_years != null && ` · ${c.experience_years} yrs`}
                      </div>
                    </td>
                    <td>
                      {[c.two_wheeler && '2W', c.four_wheeler && '4W', c.heavy_vehicle && 'Heavy'].filter(Boolean).join(' · ')}
                      <div className="muted">{c.licence_classes.join(', ')}</div>
                    </td>
                    <td>
                      {c.distance_km != null ? `${c.distance_km} km` : '—'}
                      {c.within_service_area === false && <div className="muted">outside their area</div>}
                    </td>
                    <td>
                      {c.home_area ?? '—'}
                      <span className="muted"> · {c.home_pincode}</span>
                    </td>
                    <td>{c.upcoming}</td>
                    <td>
                      {c.eligible ? (
                        <button
                          className="btn primary"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () =>
                                adminOrderApi(`/admin/bookings/${id}/assign`, {
                                  body: { driver_user_id: c.driver_user_id },
                                }),
                              `Assigned to ${c.full_name}.`,
                            )
                          }
                        >
                          Assign
                        </button>
                      ) : (
                        <span className="error">{c.reasons.join('; ')}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      {candidates.length === 0 ? 'No approved drivers yet.' : 'No driver can take this booking right now.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {active && (
        <section className="card">
          <h2>Cancel booking</h2>
          <label htmlFor="cancel-reason">Reason (optional)</label>
          <input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          <button
            className="btn danger"
            disabled={busy}
            onClick={() =>
              void run(() => adminOrderApi(`/admin/bookings/${id}/cancel`, { body: { reason: reason || null } }), 'Booking cancelled.')
            }
          >
            Cancel booking
          </button>
        </section>
      )}
    </div>
  )
}
