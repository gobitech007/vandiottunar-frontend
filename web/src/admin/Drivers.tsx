import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, formatDate, label, type DriverStatus, type DriverSummary, type Stats } from '../api'

const TABS: { value: DriverStatus; title: string }[] = [
  { value: 'submitted', title: 'Waiting for review' },
  { value: 'approved', title: 'Approved' },
  { value: 'rejected', title: 'Rejected' },
  { value: 'draft', title: 'Still registering' },
  { value: 'suspended', title: 'Suspended' },
]

const PAGE = 25

export default function Drivers() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as DriverStatus | null) ?? 'submitted'
  const q = params.get('q') ?? ''
  const page = Number(params.get('page') ?? '0')

  const [items, setItems] = useState<DriverSummary[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [search, setSearch] = useState(q)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const query = new URLSearchParams({ status, limit: String(PAGE), offset: String(page * PAGE) })
    if (q) query.set('q', q)
    Promise.all([api<{ items: DriverSummary[]; total: number }>(`/admin/drivers?${query}`), api<Stats>('/admin/stats')])
      .then(([list, s]) => {
        if (cancelled) return
        setItems(list.items)
        setTotal(list.total)
        setStats(s)
        setError(null)
      })
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [status, q, page])

  function update(next: Record<string, string>) {
    const merged = new URLSearchParams(params)
    Object.entries(next).forEach(([k, v]) => (v ? merged.set(k, v) : merged.delete(k)))
    setParams(merged)
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Drivers</h1>
        <form
          className="search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            update({ q: search.trim(), page: '' })
          }}
        >
          <label htmlFor="search" className="sr-only">
            Search drivers
          </label>
          <input
            id="search"
            placeholder="Name, phone or pincode"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn">Search</button>
        </form>
      </header>

      <nav className="tabs" aria-label="Application status">
        {TABS.map((t) => (
          <button
            key={t.value}
            className={`tab ${t.value === status ? 'active' : ''}`}
            aria-current={t.value === status ? 'page' : undefined}
            onClick={() => update({ status: t.value, page: '' })}
          >
            {t.title}
            <span className="count">{stats?.by_status[t.value] ?? '·'}</span>
          </button>
        ))}
      </nav>

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
              <th>Phone</th>
              <th>Area</th>
              <th>Experience</th>
              <th>Wants</th>
              <th>Police</th>
              <th>{status === 'submitted' ? 'Submitted' : 'Registered'}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td>
                  <Link to={`/admin/drivers/${d.id}`}>{d.full_name ?? 'Not entered yet'}</Link>
                </td>
                <td>{d.phone}</td>
                <td>
                  {d.home_area ?? '—'}
                  {d.home_pincode && <span className="muted"> · {d.home_pincode}</span>}
                </td>
                <td>{d.experience_years != null ? `${d.experience_years} yrs` : '—'}</td>
                <td>{d.work_preferences.map(label).join(', ') || '—'}</td>
                <td>{d.police_verified ? <span className="pill ok">Verified</span> : <span className="pill">Pending</span>}</td>
                <td>{formatDate(status === 'submitted' ? d.submitted_at : d.created_at)}</td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  No drivers here yet.
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

      {stats && stats.signups_by_pincode.length > 0 && (
        <section className="card">
          <h2>Where drivers are signing up</h2>
          <ul className="pincodes">
            {stats.signups_by_pincode.map((p) => (
              <li key={p.pincode}>
                <span>{p.pincode}</span>
                <strong>{p.drivers}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
