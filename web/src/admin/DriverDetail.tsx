import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  api,
  DEFAULT_CODE,
  formatDate,
  label,
  LICENCE_GROUPS,
  type DriverDetail as Detail,
  type LicenceGroup,
  cityLabel,
} from '../api'
import { displayClass } from '../public/idNumbers'

const mapLink = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`

const GROUPS: { key: LicenceGroup; title: string }[] = [
  { key: 'two_wheeler', title: 'Two-wheeler' },
  { key: 'four_wheeler', title: 'Four-wheeler (car)' },
  { key: 'heavy', title: 'Heavy vehicle' },
]
const inGroup = (codes: string[], g: LicenceGroup) => codes.some((c) => (LICENCE_GROUPS[g] as readonly string[]).includes(c))
const SOURCE: Record<string, string> = {
  ocr_server: 'read from the photo on the server (AWS Textract)',
  ocr_browser: "read from the photo in the driver's browser",
  ocr_device: "read from the photo on the driver's phone",
  manual: 'typed by the driver',
}

export default function DriverDetail() {
  const { id } = useParams<{ id: string }>()
  const [driver, setDriver] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [policeChecked, setPoliceChecked] = useState(false)
  const [licenceChecked, setLicenceChecked] = useState(false)
  const [codes, setCodes] = useState<string[]>([])
  const [policeRef, setPoliceRef] = useState('')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')

  const load = useCallback(() => {
    api<Detail>(`/admin/drivers/${id}`)
      .then((d) => {
        setDriver(d)
        setPoliceChecked(d.police_verified)
        setLicenceChecked(d.licence_verified)
        setCodes(d.licence_classes)
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
    const changed = driver && [...codes].sort().join() !== [...driver.licence_classes].sort().join()
    void act('approve', {
      police_verified: policeChecked,
      licence_verified: licenceChecked,
      licence_classes: changed ? codes : null,
      police_reference: policeRef || null,
      note: note || null,
    })
  }

  function reject(e: FormEvent) {
    e.preventDefault()
    void act(driver?.status === 'approved' ? 'suspend' : 'reject', { reason })
  }

  if (!driver) {
    return (
      <div className="page">
        <Link to="/admin/drivers">← All drivers</Link>
        {error ? <p className="error">{error}</p> : <p>Loading…</p>}
      </div>
    )
  }

  const canApprove = driver.status === 'submitted' || driver.status === 'suspended'
  const canReject = driver.status === 'submitted' || driver.status === 'approved'

  return (
    <div className="page">
      <Link to={`/admin/drivers?status=${driver.status}`}>← All drivers</Link>
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
              {driver.city && <strong>{cityLabel(driver.city)} · </strong>}
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
        <h2>Driving licence</h2>
        <dl>
          <dt>Number</dt>
          <dd>
            <strong>{driver.licence_number ?? '—'}</strong>
          </dd>
          <dt>Allows</dt>
          <dd className="badges">
            {GROUPS.map((g) => (
              <span key={g.key} className={`pill ${inGroup(driver.licence_classes, g.key) ? 'ok' : 'off'}`}>
                {inGroup(driver.licence_classes, g.key) ? '✓' : '✗'} {g.title}
              </span>
            ))}
          </dd>
          <dt>Class codes</dt>
          <dd>{driver.licence_classes.map(displayClass).join(', ') || '—'}</dd>
          <dt>Valid till</dt>
          <dd>
            {driver.licence_valid_till ?? '—'}
            {driver.licence_valid_till && new Date(driver.licence_valid_till) < new Date() && (
              <strong className="error"> · expired</strong>
            )}
          </dd>
          <dt>Details were</dt>
          <dd>{SOURCE[driver.licence_source ?? 'manual'] ?? driver.licence_source}</dd>
          <dt>Photo check</dt>
          <dd>
            {driver.licence_wording_found == null ? (
              <span className="muted">Not read from a photo</span>
            ) : driver.licence_wording_found ? (
              <span className="pill ok">✓ Licence wording found</span>
            ) : (
              <span className="pill">✗ No licence wording in the photo text: check the photo is a real licence</span>
            )}
          </dd>
          <dt>Aadhaar</dt>
          <dd>
            {driver.aadhaar_last4 ? (
              <>
                <strong>XXXX XXXX {driver.aadhaar_last4}</strong>{' '}
                <span className="muted">
                  ({SOURCE[driver.aadhaar_source ?? 'manual'] ?? driver.aadhaar_source}; only the last 4 digits are kept)
                </span>
              </>
            ) : (
              '—'
            )}
          </dd>
          <dt>Checked by admin</dt>
          <dd>{driver.licence_verified ? <span className="pill ok">Yes</span> : <span className="pill">Not yet</span>}</dd>
        </dl>
        {driver.licence_raw_text && (
          <details className="raw-text">
            <summary>Text read from the licence photo</summary>
            <pre>{driver.licence_raw_text}</pre>
          </details>
        )}
        <p className="hint">Compare the number and class codes with the licence photos below before approving.</p>
      </section>

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
              <fieldset className="chips">
                <legend>Licence allows (correct it if the photo shows otherwise)</legend>
                {GROUPS.map((g) => {
                  const on = inGroup(codes, g.key)
                  return (
                    <button
                      type="button"
                      key={g.key}
                      role="checkbox"
                      aria-checked={on}
                      className={`chip ${on ? 'on' : ''}`}
                      onClick={() =>
                        setCodes((prev) =>
                          on
                            ? prev.filter((c) => !(LICENCE_GROUPS[g.key] as readonly string[]).includes(c))
                            : [...prev, DEFAULT_CODE[g.key]],
                        )
                      }
                    >
                      {g.title}
                    </button>
                  )
                })}
              </fieldset>
              <label className="check">
                <input type="checkbox" checked={licenceChecked} onChange={(e) => setLicenceChecked(e.target.checked)} />
                Licence number and vehicle classes match the photo
              </label>
              <label className="check">
                <input type="checkbox" checked={policeChecked} onChange={(e) => setPoliceChecked(e.target.checked)} />
                Police verification is complete
              </label>
              <label htmlFor="police-ref">Verification reference (optional)</label>
              <input id="police-ref" value={policeRef} onChange={(e) => setPoliceRef(e.target.value)} maxLength={64} />
              <label htmlFor="note">Internal note (optional)</label>
              <input id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              <button className="btn primary" disabled={busy || !policeChecked || !licenceChecked || codes.length === 0}>
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
