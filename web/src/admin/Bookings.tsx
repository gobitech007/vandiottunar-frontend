import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { adminOrderApi, formatWhen, type AdminBooking, type AutoAssignResult, type BookingStatus } from '../api'

const TABS: { value: BookingStatus; title: string }[] = [
  { value: 'pending', title: 'Waiting for a driver' },
  { value: 'assigned', title: 'Assigned' },
  { value: 'in_progress', title: 'On a trip' },
  { value: 'completed', title: 'Completed' },
  { value: 'cancelled', title: 'Cancelled' },
]
const PAGE = 25
export const VEHICLE: Record<string, string> = { two_wheeler: 'Two-wheeler', four_wheeler: 'Car', heavy: 'Heavy vehicle' }
export const TYPE: Record<string, string> = { on_demand: 'Trip', job: 'Permanent' }

export default function Bookings() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as BookingStatus | null) ?? 'pending'
  const q = params.get('q') ?? ''
  const page = Number(params.get('page') ?? '0')
  const [search, setSearch] = useState(q)
  const [items, setItems] = useState<AdminBooking[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<AutoAssignResult[] | null>(null)

  const load = useCallback(async () => {
    const query = new URLSearchParams({ status, limit: String(PAGE), offset: String(page * PAGE) })
    if (q) query.set('q', q)
    try {
      const [list, summary] = await Promise.all([
        adminOrderApi<{ items: AdminBooking[]; total: number }>(`/admin/bookings?${query}`),
        adminOrderApi<{ by_status: Record<string, number> }>('/admin/bookings/summary'),
      ])
      setItems(list.items)
      setTotal(list.total)
      setCounts(summary.by_status)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [status, q, page])

  useEffect(() => {
    void load()
  }, [load])

  function update(next: Record<string, string>) {
    const merged = new URLSearchParams(params)
    Object.entries(next).forEach(([k, v]) => (v ? merged.set(k, v) : merged.delete(k)))
    setParams(merged)
  }

  async function autoAssignAll() {
    setBusy(true)
    setError(null)
    try {
      setResults(await adminOrderApi<AutoAssignResult[]>('/admin/bookings/auto-assign', { method: 'POST' }))
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const assignedCount = results?.filter((r) => r.assigned).length ?? 0

  return (
    <div className="page">
      <header className="page-head">
        <h1>Bookings</h1>
        <form
          className="search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            update({ q: search.trim(), page: '' })
          }}
        >
          <label htmlFor="b-search" className="sr-only">
            Search bookings
          </label>
          <input
            id="b-search"
            placeholder="Ref, customer, phone, car, pincode, driver"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn">Search</button>
        </form>
      </header>

      <div className="row-between">
        <nav className="tabs" aria-label="Booking status">
          {TABS.map((t) => (
            <button
              key={t.value}
              className={`tab ${t.value === status ? 'active' : ''}`}
              aria-current={t.value === status ? 'page' : undefined}
              onClick={() => update({ status: t.value, page: '' })}
            >
              {t.title}
              <span className="count">{counts[t.value] ?? '·'}</span>
            </button>
          ))}
        </nav>
        <button className="btn primary" onClick={() => void autoAssignAll()} disabled={busy || !counts.pending}>
          {busy ? 'Assigning…' : `Auto-assign all waiting (${counts.pending ?? 0})`}
        </button>
      </div>

      {results && (
        <div className="notice" role="status">
          <strong>
            Auto-assign: {assignedCount} of {results.length} booking{results.length === 1 ? '' : 's'} got a driver.
          </strong>
          <ul className="results">
            {results.map((r) => (
              <li key={r.booking_id}>
                {r.reference}: {r.assigned ? `✓ ${r.driver_name}` : `not assigned — ${r.reason}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ref</th>
              <th>When</th>
              <th>Customer</th>
              <th>Vehicle</th>
              <th>Pickup</th>
              <th>Type</th>
              <th>Driver</th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link to={`/admin/bookings/${b.id}`}>{b.reference}</Link>
                </td>
                <td>
                  {formatWhen(b.start_at)}
                  <div className="muted">→ {b.end_at ? formatWhen(b.end_at) : 'no end'}</div>
                </td>
                <td>
                  {b.customer_name ?? '—'}
                  {b.company_name && <div className="muted">{b.company_name}</div>}
                  <div className="muted">{b.customer_phone}</div>
                </td>
                <td>
                  {VEHICLE[b.vehicle_class]}
                  <div className="muted">{b.car_number ?? '—'}</div>
                </td>
                <td>
                  {b.pickup_area ?? '—'}
                  <span className="muted"> · {b.pickup_pincode}</span>
                </td>
                <td>{TYPE[b.booking_type]}</td>
                <td>
                  {b.driver_name ? (
                    <>
                      {b.driver_name}
                      <div className="muted">{b.assignment_mode === 'auto' ? 'auto' : 'manual'}</div>
                    </>
                  ) : (
                    <Link className="btn" to={`/admin/bookings/${b.id}`}>
                      Assign
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  No bookings here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > PAGE && (
        <div className="pager">
          <button className="btn" disabled={page === 0} onClick={() => update({ page: String(page - 1) })}>
            Previous
          </button>
          <span>
            Page {page + 1} of {Math.ceil(total / PAGE)}
          </span>
          <button className="btn" disabled={(page + 1) * PAGE >= total} onClick={() => update({ page: String(page + 1) })}>
            Next
          </button>
        </div>
      )}
    </div>
  )
}
