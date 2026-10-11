import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ApiError,
  getUserSession,
  setUserSession,
  userApi,
  type Checklist,
  type DocType,
  type DocumentInfo,
  type DriverProfile,
  type UserSession,
} from '../api'
import { useT } from '../i18n'
import PhoneOtp from './PhoneOtp'
import PublicShell from './PublicShell'
import WrongRole from './WrongRole'

type Step = 'consent' | 'profile' | 'location' | 'documents'

const VEHICLES = ['car_manual', 'car_automatic', 'suv', 'van', 'light_commercial', 'heavy_vehicle']
const AVAILABILITY = ['full_time', 'part_time', 'weekends']
const WORK = ['on_demand', 'job']
const RADII = [5, 10, 15, 25]
const DOCS: { type: DocType; required: boolean }[] = [
  { type: 'licence_front', required: true },
  { type: 'licence_back', required: true },
  { type: 'id_proof', required: true },
  { type: 'selfie', required: true },
  { type: 'address_proof', required: false },
]
const MAX_BYTES = 5 * 1024 * 1024

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

export default function DriverRegister() {
  const { t } = useT()
  const [session, setSession] = useState<UserSession | null>(getUserSession)
  const [profile, setProfile] = useState<DriverProfile | null>(null)
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [step, setStep] = useState<Step | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [p, c] = await Promise.all([
        userApi<DriverProfile>('/drivers/me'),
        userApi<Checklist>('/drivers/me/checklist'),
      ])
      setProfile(p)
      setChecklist(c)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUserSession(null)
        setSession(null)
      } else setError((err as Error).message)
    }
  }, [])

  const isDriver = session?.role === 'driver'
  useEffect(() => {
    if (isDriver) void load()
  }, [isDriver, load])

  const finish = async () => {
    setStep(null)
    await load()
    window.scrollTo(0, 0)
  }

  let body
  if (!session) {
    body = <PhoneOtp role="driver" onSignedIn={setSession} />
  } else if (!isDriver) {
    body = <WrongRole role={session.role} />
  } else if (!profile || !checklist) {
    body = error ? <p className="error">{error}</p> : <p className="muted">…</p>
  } else if (!['draft', 'rejected'].includes(profile.status)) {
    body = <DriverStatus profile={profile} onRefresh={load} />
  } else if (step === 'consent') {
    body = <ConsentStep version={checklist.current_consent_version} onDone={finish} onBack={() => setStep(null)} />
  } else if (step === 'profile') {
    body = <ProfileStep profile={profile} onDone={finish} onBack={() => setStep(null)} />
  } else if (step === 'location') {
    body = <LocationStep profile={profile} onDone={finish} onBack={() => setStep(null)} />
  } else if (step === 'documents') {
    body = <DocumentsStep onDone={finish} onBack={() => setStep(null)} />
  } else {
    body = <Hub profile={profile} checklist={checklist} onOpen={setStep} onSubmitted={load} />
  }

  return (
    <PublicShell>
      <div className="flow">
        <h1>{t.driverTitle}</h1>
        {body}
      </div>
    </PublicShell>
  )
}

function Hub({
  profile,
  checklist,
  onOpen,
  onSubmitted,
}: {
  profile: DriverProfile
  checklist: Checklist
  onOpen: (s: Step) => void
  onSubmitted: () => void
}) {
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const steps: { key: Step; title: string; done: boolean }[] = [
    { key: 'consent', title: t.stepConsent, done: checklist.consent_accepted },
    { key: 'profile', title: t.stepProfile, done: checklist.profile_complete },
    { key: 'location', title: t.stepLocation, done: checklist.location_captured },
    { key: 'documents', title: t.stepDocuments, done: checklist.missing_documents.length === 0 },
  ]
  const next = steps.find((s) => !s.done)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await userApi('/drivers/me/submit', { method: 'POST' })
      onSubmitted()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h2 className="sub">{t.hubTitle}</h2>
      {profile.status === 'rejected' && (
        <div className="notice">
          <strong>{t.rejectedTitle}</strong>
          {profile.rejection_reason && <p>{profile.rejection_reason}</p>}
        </div>
      )}
      <ol className="steps">
        {steps.map((s, i) => (
          <li key={s.key}>
            <button className={`step ${s.done ? 'step-done' : ''}`} onClick={() => onOpen(s.key)}>
              <span className="step-num" aria-hidden="true">
                {s.done ? '✓' : i + 1}
              </span>
              <span className="step-text">
                <strong>{s.title}</strong>
                <span>{s.done ? t.done : t.todo}</span>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          </li>
        ))}
      </ol>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {next ? (
        <button className="btn primary wide" onClick={() => onOpen(next.key)}>
          {t.continue}
        </button>
      ) : (
        <button className="btn primary wide" onClick={submit} disabled={busy || !checklist.ready_to_submit}>
          {t.submit}
        </button>
      )}
    </>
  )
}

function StepFrame({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  const { t } = useT()
  return (
    <section className="card">
      <button className="btn link back" onClick={onBack}>
        ‹ {t.back}
      </button>
      <h2 className="sub">{title}</h2>
      {children}
    </section>
  )
}

function ConsentStep({ version, onDone, onBack }: { version: string; onDone: () => void; onBack: () => void }) {
  const { t } = useT()
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      await userApi('/drivers/me/consent', { body: { version } })
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <StepFrame title={t.stepConsent} onBack={onBack}>
      <h3>{t.consentTitle}</h3>
      <ol className="consent">
        {t.consentPoints.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ol>
      <label className="check">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        {t.agree}
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn primary wide" onClick={accept} disabled={!agreed || busy}>
        {t.continue}
      </button>
    </StepFrame>
  )
}

function ChipGroup({
  legend,
  options,
  selected,
  onToggle,
  render,
  single,
}: {
  legend: string
  options: (string | number)[]
  selected: string[]
  onToggle: (v: string) => void
  render: (v: string) => string
  single?: boolean
}) {
  return (
    <fieldset className="chips">
      <legend>{legend}</legend>
      {options.map((o) => {
        const v = String(o)
        const on = selected.includes(v)
        return (
          <button
            type="button"
            key={v}
            role={single ? 'radio' : 'checkbox'}
            aria-checked={on}
            className={`chip ${on ? 'on' : ''}`}
            onClick={() => onToggle(v)}
          >
            {render(v)}
          </button>
        )
      })}
    </fieldset>
  )
}

function ProfileStep({ profile, onDone, onBack }: { profile: DriverProfile; onDone: () => void; onBack: () => void }) {
  const { t, lang } = useT()
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [licence, setLicence] = useState(profile.licence_number ?? '')
  const [experience, setExperience] = useState(profile.experience_years?.toString() ?? '')
  const [vehicles, setVehicles] = useState(profile.vehicle_types)
  const [availability, setAvailability] = useState(profile.availability ? [profile.availability] : [])
  const [work, setWork] = useState(profile.work_preferences)
  const [pay, setPay] = useState(profile.expected_pay_note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const complete =
    fullName.trim().length >= 2 &&
    licence.trim().length >= 8 &&
    experience !== '' &&
    vehicles.length > 0 &&
    availability.length > 0 &&
    work.length > 0

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await userApi('/drivers/me/profile', {
        method: 'PUT',
        body: {
          full_name: fullName.trim(),
          preferred_language: lang,
          licence_number: licence.trim(),
          experience_years: Number(experience),
          vehicle_types: vehicles,
          availability: availability[0],
          work_preferences: work,
          expected_pay_note: pay.trim() || null,
        },
      })
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <StepFrame title={t.stepProfile} onBack={onBack}>
      <form onSubmit={save}>
        <label htmlFor="name">{t.fullName}</label>
        <input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" maxLength={120} />
        <label htmlFor="licence">{t.licenceNumber}</label>
        <input
          id="licence"
          value={licence}
          onChange={(e) => setLicence(e.target.value.toUpperCase())}
          placeholder="TN38 20200001234"
          maxLength={20}
        />
        <label htmlFor="exp">{t.experience}</label>
        <input
          id="exp"
          inputMode="numeric"
          value={experience}
          onChange={(e) => setExperience(e.target.value.replace(/\D/g, '').slice(0, 2))}
        />
        <ChipGroup
          legend={t.vehicles}
          options={VEHICLES}
          selected={vehicles}
          onToggle={(v) => setVehicles((l) => toggle(l, v))}
          render={(v) => t.labels[v]}
        />
        <ChipGroup
          legend={t.availability}
          options={AVAILABILITY}
          selected={availability}
          onToggle={(v) => setAvailability([v])}
          render={(v) => t.labels[v]}
          single
        />
        <ChipGroup
          legend={t.workPrefs}
          options={WORK}
          selected={work}
          onToggle={(v) => setWork((l) => toggle(l, v))}
          render={(v) => t.labels[v]}
        />
        <label htmlFor="pay">{t.expectedPay}</label>
        <input id="pay" value={pay} onChange={(e) => setPay(e.target.value)} maxLength={120} placeholder="₹" />
        {error && <p className="error">{error}</p>}
        <button className="btn primary wide" disabled={!complete || busy}>
          {t.save}
        </button>
      </form>
    </StepFrame>
  )
}

function LocationStep({ profile, onDone, onBack }: { profile: DriverProfile; onDone: () => void; onBack: () => void }) {
  const { t } = useT()
  const [fix, setFix] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(
    profile.registration_lat != null && profile.registration_lng != null
      ? { lat: profile.registration_lat, lng: profile.registration_lng, accuracy: null }
      : null,
  )
  const [pincode, setPincode] = useState(profile.home_pincode ?? '')
  const [area, setArea] = useState(profile.home_area ?? '')
  const [radius, setRadius] = useState(String(profile.service_radius_km ?? 10))
  const [locating, setLocating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function locate() {
    setError(null)
    if (!window.isSecureContext || !navigator.geolocation) {
      setError(t.locationInsecure)
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null })
        setLocating(false)
      },
      (err) => {
        setError(err.code === err.PERMISSION_DENIED ? t.locationDenied : t.locationUnavailable)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
    )
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!fix) return
    setBusy(true)
    setError(null)
    try {
      await userApi('/drivers/me/location', {
        method: 'PUT',
        body: {
          lat: fix.lat,
          lng: fix.lng,
          accuracy_m: fix.accuracy,
          home_pincode: pincode,
          home_area: area.trim() || null,
          service_radius_km: Number(radius),
        },
      })
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <StepFrame title={t.stepLocation} onBack={onBack}>
      <p>{t.locationWhy}</p>
      <button type="button" className={`btn wide ${fix ? '' : 'primary'}`} onClick={locate} disabled={locating}>
        {locating ? t.locating : t.useMyLocation}
      </button>
      {fix && (
        <p className="ok-text">
          {t.captured(fix.accuracy != null ? Math.round(fix.accuracy) : 0)} ·{' '}
          <a href={`https://www.google.com/maps?q=${fix.lat},${fix.lng}`} target="_blank" rel="noreferrer">
            {fix.lat.toFixed(5)}, {fix.lng.toFixed(5)}
          </a>
        </p>
      )}
      <form onSubmit={save}>
        <label htmlFor="pin">{t.pincode}</label>
        <input
          id="pin"
          inputMode="numeric"
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="641001"
        />
        <label htmlFor="area">{t.area}</label>
        <input id="area" value={area} onChange={(e) => setArea(e.target.value)} maxLength={120} placeholder="RS Puram" />
        <ChipGroup
          legend={t.radius}
          options={RADII}
          selected={[radius]}
          onToggle={setRadius}
          render={(v) => `${v} km`}
          single
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary wide" disabled={!fix || !/^[1-9]\d{5}$/.test(pincode) || busy}>
          {t.save}
        </button>
      </form>
    </StepFrame>
  )
}

// Shrink phone photos in the browser before upload: faster on mobile data and under the 5 MB limit
async function prepareFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
    if (!blob) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file // browser can't decode it (e.g. HEIC) — let the server decide
  }
}

function DocumentsStep({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { t } = useT()
  const [uploaded, setUploaded] = useState<Set<DocType>>(new Set())
  const [working, setWorking] = useState<DocType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputs = useRef<Partial<Record<DocType, HTMLInputElement | null>>>({})

  useEffect(() => {
    userApi<DocumentInfo[]>('/drivers/me/documents')
      .then((docs) => setUploaded(new Set(docs.map((d) => d.doc_type))))
      .catch((err: Error) => setError(err.message))
  }, [])

  async function upload(type: DocType, file: File | undefined) {
    if (!file) return
    setError(null)
    setWorking(type)
    try {
      const ready = await prepareFile(file)
      if (ready.size > MAX_BYTES) {
        setError(t.tooBig)
        return
      }
      const form = new FormData()
      form.append('file', ready)
      await userApi(`/drivers/me/documents/${type}`, { form })
      setUploaded((prev) => new Set(prev).add(type))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setWorking(null)
      const input = inputs.current[type]
      if (input) input.value = ''
    }
  }

  const allRequired = DOCS.filter((d) => d.required).every((d) => uploaded.has(d.type))

  return (
    <StepFrame title={t.stepDocuments} onBack={onBack}>
      <p>{t.docTip}</p>
      <ul className="doc-list">
        {DOCS.map((d) => {
          const done = uploaded.has(d.type)
          const busy = working === d.type
          const id = `doc-${d.type}`
          return (
            <li key={d.type} className={done ? 'done' : ''}>
              <div>
                <strong>{t.labels[d.type]}</strong>
                <span className={done ? 'ok-text' : 'muted'}>
                  {busy ? t.uploading : done ? `✓ ${t.uploaded}` : d.required ? t.required : t.optional}
                </span>
              </div>
              <label htmlFor={id} className={`btn ${done ? '' : 'primary'} ${working ? 'disabled' : ''}`}>
                {done ? t.replace : t.choose}
              </label>
              <input
                id={id}
                ref={(el) => {
                  inputs.current[d.type] = el
                }}
                className="sr-only"
                type="file"
                accept={d.type === 'selfie' ? 'image/*' : 'image/*,application/pdf'}
                capture={d.type === 'selfie' ? 'user' : undefined}
                disabled={working !== null}
                onChange={(e) => void upload(d.type, e.target.files?.[0])}
              />
            </li>
          )
        })}
      </ul>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="hint">{t.getApp}</p>
      <button className="btn primary wide" onClick={onDone} disabled={!allRequired || working !== null}>
        {t.continue}
      </button>
    </StepFrame>
  )
}

function DriverStatus({ profile, onRefresh }: { profile: DriverProfile; onRefresh: () => void }) {
  const { t } = useT()
  const approved = profile.status === 'approved'
  const suspended = profile.status === 'suspended'
  return (
    <section className={`card status-card ${approved ? 'is-ok' : suspended ? 'is-bad' : ''}`}>
      <div className="status-icon" aria-hidden="true">
        {approved ? '✓' : suspended ? '!' : '…'}
      </div>
      <h2>{approved ? t.approvedTitle : suspended ? t.suspendedTitle : t.submittedTitle}</h2>
      {profile.full_name && <p className="strong">{profile.full_name}</p>}
      <p>{approved ? t.approvedBody : suspended ? profile.rejection_reason : t.submittedBody}</p>
      <p className="muted">{t.contact}</p>
      {!approved && (
        <button className="btn" onClick={onRefresh}>
          {t.refresh}
        </button>
      )}
    </section>
  )
}
