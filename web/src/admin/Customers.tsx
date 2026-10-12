import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, formatDate, type AdminCustomer } from '../api'

const PAGE = 25
const NEED: Record<string, string> = { on_demand: 'Trips', job: 'Permanent driver' }

export default function Customers() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const page = Number(params.get('page') ?? '0')
  const [search, setSearch] = useState(q)
  const [items, setItems] = useState<AdminCustomer[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const query = new URLSearchParams({ limit: String(PAGE), offset: String(page * PAGE) })
    if (q) query.set('q', q)
    api<{ items: AdminCustomer[]; total: number }>(`/admin/customers?${query}`)
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setTotal(res.total)
        setError(null)
      })
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [q, page])

  return (
    <div className="page">
      <header className="page-head">
        <h1>Customers</h1>
        <form
          className="search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            setParams(search.trim() ? { q: search.trim() } : {})
          }}
        >
          <label htmlFor="c-search" className="sr-only">
            Search customers
          </label>
          <input
            id="c-search"
            placeholder="Name, company, phone or pincode"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn">Search</button>
        </form>
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Area</th>
              <th>Needs</th>
              <th>Car number</th>
              <th>Vehicle</th>
              <th>Registered</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.full_name ?? <span className="muted">Not entered yet</span>}
                  {c.company_name && <div className="muted">{c.company_name}</div>}
                </td>
                <td>
                  <span className="pill">{c.role === 'employer' ? 'Business' : 'Car owner'}</span>
                </td>
                <td>{c.phone}</td>
                <td>{c.email ?? '—'}</td>
                <td>
                  {c.home_area ?? '—'}
                  {c.home_pincode && <span className="muted"> · {c.home_pincode}</span>}
                </td>
                <td>{c.needs.map((n) => NEED[n] ?? n).join(', ') || '—'}</td>
                <td>{c.car_number ?? '—'}</td>
                <td>{c.vehicle_note ?? '—'}</td>
                <td>{formatDate(c.created_at)}</td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={9} className="empty">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > PAGE && (
        <div className="pager">
          <button className="btn" disabled={page === 0} onClick={() => setParams({ ...(q && { q }), page: String(page - 1) })}>
            Previous
          </button>
          <span>
            Page {page + 1} of {Math.ceil(total / PAGE)}
          </span>
          <button
            className="btn"
            disabled={(page + 1) * PAGE >= total}
            onClick={() => setParams({ ...(q && { q }), page: String(page + 1) })}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
