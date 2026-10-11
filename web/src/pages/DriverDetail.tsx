import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, formatDate, label, type DriverDetail as Detail } from '../api'

const mapLink = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`

export default function DriverDetail() {
  const { id } = useParams<{ id: string }>()
  const [driver, setDriver] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [policeChecked, setPoliceChecked] = useState(false)
  const [policeRef, setPoliceRef] = useState('')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')

  const load = useCallback(() => {
    api<Detail>(`/admin/drivers/${id}`)
      .then((d) => {
        setDriver(d)
        setPoliceChecked(d.police_verified)
        setPoliceRef(d.police_reference ?? '')
      })
      .catch((err: Error) => setError(err.message))
  }, [id])

  useEffect(load, [load])

  async function act(path: string, body: unknown) {
    setBusy(true)
    setError(null)
    try {
      await api(`/admin/drivers/${id}/${path}`, { method: 'POST', body })
      setReason('')
      setNote('')
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function approve(e: FormEvent) {
    e.preventDefault()
    void act('approve', { police_verified: policeChecked, police_reference: policeRef || null, note: note || null })
  }

  function reject(e: FormEvent) {
    e.preventDefault()
    void act(driver?.status === 'approved' ? 'suspend' : 'reject', { reason })
  }

  if (!driver) {
    return (
      <div className="page">
        <Link to="/drivers">← All drivers</Link>
        {error ? <p className="error">{error}</p> : <p>Loading…</p>}
      </div>
    )
  }

  const canApprove = driver.status === 'submitted' || driver.status === 'suspended'
  const canReject = driver.status === 'submitted' || driver.status === 'approved'

  return (
    <div className="page">
      <Link to={`/drivers?status=${driver.status}`}>← All drivers</Link>
      <header className="page-head">
        <div>
          <h1>{driver.full_name ?? 'Unnamed driver'}</h1>
          <p className="muted">
            {driver.phone} · registered {formatDate(driver.created_at)}
          </p>
        </div>
        <span className={`status status-${driver.status}`}>{driver.status}</span>
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {driver.rejection_reason && (
        <p className="notice">
          <strong>Reason given to driver:</strong> {driver.rejection_reason}
        </p>
      )}

      <div className="grid">
        <section className="card">
          <h2>Profile</h2>
          <dl>
            <dt>Licence number</dt>
            <dd>{driver.licence_number ?? '—'}</dd>
            <dt>Experience</dt>
            <dd>{driver.experience_years != null ? `${driver.experience_years} years` : '—'}</dd>
            <dt>Can drive</dt>
            <dd>{driver.vehicle_types.map(label).join(', ') || '—'}</dd>
            <dt>Availability</dt>
            <dd>{driver.availability ? label(driver.availability) : '—'}</dd>
            <dt>Interested in</dt>
            <dd>{driver.work_preferences.map(label).join(', ') || '—'}</dd>
            <dt>Expected pay</dt>
            <dd>{driver.expected_pay_note ?? '—'}</dd>
            <dt>Language</dt>
            <dd>{label(driver.preferred_language)}</dd>
          </dl>
        </section>

        <section className="card">
          <h2>Location</h2>
          <dl>
            <dt>Works in</dt>
            <dd>
              {driver.home_area ?? '—'} {driver.home_pincode && `(${driver.home_pincode})`}
              {driver.home_lat != null && driver.home_lng != null && (
                <>
                  {' · '}
                  <a href={mapLink(driver.home_lat, driver.home_lng)} target="_blank" rel="noreferrer">
                    map
                  </a>
                </>
              )}
            </dd>
            <dt>Service radius</dt>
            <dd>{driver.service_radius_km} km</dd>
            <dt>Registered from</dt>
            <dd>
              {driver.registration_lat != null && driver.registration_lng != null ? (
                <a href={mapLink(driver.registration_lat, driver.registration_lng)} target="_blank" rel="noreferrer">
                  GPS location
                </a>
              ) : (
                '—'
              )}
              {driver.registration_accuracy_m != null && (
                <span className="muted"> (±{Math.round(driver.registration_accuracy_m)} m)</span>
              )}
            </dd>
            <dt>Captured</dt>
            <dd>{formatDate(driver.location_captured_at)}</dd>
            <dt>Privacy notice</dt>
            <dd>
              {driver.consent_version
                ? `Accepted ${driver.consent_version} on ${formatDate(driver.consent_accepted_at)}`
                : 'Not accepted'}
            </dd>
          </dl>
        </section>
      </div>

      <section className="card">
        <h2>Documents</h2>
        {driver.documents.length === 0 && <p className="muted">No documents uploaded yet.</p>}
        <div className="docs">
          {driver.documents.map((d) => (
            <figure key={d.id} className="doc">
              {d.content_type.startsWith('image/') ? (
                <a href={d.view_url} target="_blank" rel="noreferrer">
                  <img src={d.view_url} alt={label(d.doc_type)} />
                </a>
              ) : (
                <a className="pdf" href={d.view_url} target="_blank" rel="noreferrer">
                  Open PDF
                </a>
              )}
              <figcaption>
                {label(d.doc_type)}
                <span className="muted"> · {formatDate(d.uploaded_at)}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="hint">Document links expire after 5 minutes — reload the page if an image stops loading.</p>
      </section>

      {(canApprove || canReject) && (
        <div className="grid">
          {canApprove && (
            <form className="card" onSubmit={approve}>
              <h2>Approve</h2>
              <label className="check">
                <input type="checkbox" checked={policeChecked} onChange={(e) => setPoliceChecked(e.target.checked)} />
                Police verification is complete
              </label>
              <label htmlFor="police-ref">Verification reference (optional)</label>
              <input id="police-ref" value={policeRef} onChange={(e) => setPoliceRef(e.target.value)} maxLength={64} />
              <label htmlFor="note">Internal note (optional)</label>
              <input id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              <button className="btn primary" disabled={busy || !policeChecked}>
                Approve driver
              </button>
            </form>
          )}
          {canReject && (
            <form className="card" onSubmit={reject}>
              <h2>{driver.status === 'approved' ? 'Suspend' : 'Reject'}</h2>
              <label htmlFor="reason">Reason (the driver will see this)</label>
              <textarea
                id="reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Licence photo is blurred — please upload a clearer one"
                minLength={3}
                maxLength={500}
                required
              />
              <button className="btn danger" disabled={busy || reason.trim().length < 3}>
                {driver.status === 'approved' ? 'Suspend driver' : 'Reject application'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
