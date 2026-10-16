import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  ApiError,
  DEFAULT_CODE,
  LICENCE_GROUPS,
  type LicenceGroup,
  type ParsedAadhaar,
  type ParsedLicence,
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
import CitySelect, { pincodePlaceholder } from './CitySelect'
import { aadhaarDigits, displayClass, formatAadhaar, maskAadhaar, validAadhaar } from './idNumbers'
import { needsFirstDownload, readImageText } from './licenceOcr'
import PhoneOtp from './PhoneOtp'
import PublicShell from './PublicShell'
import WrongRole from './WrongRole'

type Step = 'consent' | 'profile' | 'licence' | 'location' | 'documents'

const VEHICLES = ['car_manual', 'car_automatic', 'suv', 'van', 'light_commercial', 'heavy_vehicle']
const AVAILABILITY = ['full_time', 'part_time', 'weekends']
const WORK = ['on_demand', 'job']
const RADII = [5, 10, 15, 25]
const LICENCE_SIDES: DocType[] = ['licence_front', 'licence_back']
// The licence photos are taken in the licence step; the rest here
const DOCS: { type: DocType; required: boolean }[] = [
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
    // Submitted, approved or on hold: the dashboard shows the status and assigned customers
    return <Navigate to="/dashboard" replace />
  } else if (step === 'consent') {
    body = <ConsentStep version={checklist.current_consent_version} onDone={finish} onBack={() => setStep(null)} />
  } else if (step === 'profile') {
    body = <ProfileStep profile={profile} onDone={finish} onBack={() => setStep(null)} />
  } else if (step === 'licence') {
    body = (
      <LicenceStep
        profile={profile}
        serverOcr={checklist.server_ocr_available}
        onDone={finish}
        onBack={() => setStep(null)}
      />
    )
  } else if (step === 'location') {
    body = <LocationStep profile={profile} onDone={finish} onBack={() => setStep(null)} />
  } else if (step === 'documents') {
    body = (
      <DocumentsStep
        profile={profile}
        serverOcr={checklist.server_ocr_available}
        onDone={finish}
        onBack={() => setStep(null)}
      />
    )
  } else {
    body = <Hub profile={profile} checklist={checklist} onOpen={setStep} />
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

function Hub({ profile, checklist, onOpen }: { profile: DriverProfile; checklist: Checklist; onOpen: (s: Step) => void }) {
  const { t } = useT()
  const navigate = useNavigate()
  const missing = checklist.missing_documents
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const steps: { key: Step; title: string; done: boolean }[] = [
    { key: 'consent', title: t.stepConsent, done: checklist.consent_accepted },
    { key: 'profile', title: t.stepProfile, done: checklist.profile_complete },
    {
      key: 'licence',
      title: t.stepLicence,
      done: checklist.licence_complete && !LICENCE_SIDES.some((d) => missing.includes(d)),
    },
    { key: 'location', title: t.stepLocation, done: checklist.location_captured },
    {
      key: 'documents',
      title: t.stepDocuments,
      done: checklist.aadhaar_captured && !missing.some((d) => !LICENCE_SIDES.includes(d)),
    },
  ]
  const next = steps.find((s) => !s.done)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await userApi('/drivers/me/submit', { method: 'POST' })
      navigate('/dashboard')
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
  const [experience, setExperience] = useState(profile.experience_years?.toString() ?? '')
  const [vehicles, setVehicles] = useState(profile.vehicle_types)
  const [availability, setAvailability] = useState(profile.availability ? [profile.availability] : [])
  const [work, setWork] = useState(profile.work_preferences)
  const [pay, setPay] = useState(profile.expected_pay_note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const complete =
    fullName.trim().length >= 2 &&
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
        <div className="form-grid">
          <div className="f">
            <label htmlFor="name">{t.fullName}</label>
            <input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" maxLength={120} />
          </div>
          <div className="f">
            <label htmlFor="exp">{t.experience}</label>
            <input
              id="exp"
              inputMode="numeric"
              value={experience}
              onChange={(e) => setExperience(e.target.value.replace(/\D/g, '').slice(0, 2))}
            />
          </div>
        </div>
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
  const [city, setCity] = useState(profile.city ?? '')
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
          city,
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
        <div className="form-grid">
          <div className="f span-2">
            <CitySelect id="city" value={city} onChange={setCity} />
          </div>
          <div className="f">
            <label htmlFor="pin">{t.pincode}</label>
            <input
              id="pin"
              inputMode="numeric"
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={pincodePlaceholder(city)}
            />
          </div>
          <div className="f">
            <label htmlFor="area">{t.area}</label>
            <input id="area" value={area} onChange={(e) => setArea(e.target.value)} maxLength={120} />
          </div>
        </div>
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
        <button className="btn primary wide" disabled={!fix || !city || !/^[1-9]\d{5}$/.test(pincode) || busy}>
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

async function uploadDocument(type: DocType, file: File, tooBig: string): Promise<File> {
  const ready = await prepareFile(file)
  if (ready.size > MAX_BYTES) throw new Error(tooBig)
  const form = new FormData()
  form.append('file', ready)
  await userApi(`/drivers/me/documents/${type}`, { form })
  return ready
}

function DocumentsStep({
  profile,
  serverOcr,
  onDone,
  onBack,
}: {
  profile: DriverProfile
  serverOcr: boolean
  onDone: () => void
  onBack: () => void
}) {
  const { t } = useT()
  const [uploaded, setUploaded] = useState<Set<DocType>>(new Set())
  const [working, setWorking] = useState<DocType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputs = useRef<Partial<Record<DocType, HTMLInputElement | null>>>({})
  // Aadhaar number: read from the ID photo, checked here, and only its last 4 digits saved
  const [aadhaar, setAadhaar] = useState('')
  const [aadhaarRead, setAadhaarRead] = useState<'reading' | 'found' | 'missing' | null>(null)
  const [aadhaarSource, setAadhaarSource] = useState('manual')
  const [aadhaarNote, setAadhaarNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function readAadhaar(file: File) {
    setAadhaarRead('reading')
    setAadhaarNote(null)
    try {
      let result: ParsedAadhaar | null = null
      let how = 'ocr_browser'
      if (serverOcr) {
        try {
          result = await userApi<ParsedAadhaar>('/drivers/me/aadhaar/scan', { method: 'POST' })
          how = 'ocr_server'
        } catch {
          result = null // fall back to reading in this browser
        }
      }
      if (!result?.aadhaar_number) {
        if (needsFirstDownload()) setAadhaarNote(t.firstLoad)
        const text = await readImageText(file)
        if (text.trim()) result = await userApi<ParsedAadhaar>('/drivers/me/aadhaar/parse', { body: { text: text.slice(0, 8000) } })
        how = 'ocr_browser'
      }
      if (result?.aadhaar_number) {
        setAadhaar(formatAadhaar(result.aadhaar_number))
        setAadhaarSource(how)
        setAadhaarRead('found')
      } else setAadhaarRead('missing')
    } catch {
      setAadhaarRead('missing')
    } finally {
      setAadhaarNote(null)
    }
  }

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
      const ready = await uploadDocument(type, file, t.tooBig)
      setUploaded((prev) => new Set(prev).add(type))
      if (type === 'id_proof') void readAadhaar(ready)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setWorking(null)
      const input = inputs.current[type]
      if (input) input.value = ''
    }
  }

  const allRequired = DOCS.filter((d) => d.required).every((d) => uploaded.has(d.type))
  const typed = aadhaarDigits(aadhaar)
  const aadhaarOk = typed ? validAadhaar(typed) : Boolean(profile.aadhaar_last4)

  async function next() {
    setError(null)
    if (typed) {
      setSaving(true)
      try {
        await userApi('/drivers/me/aadhaar', { method: 'PUT', body: { aadhaar_number: typed, source: aadhaarSource } })
      } catch (err) {
        setError((err as Error).message)
        return
      } finally {
        setSaving(false)
      }
    }
    onDone()
  }

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

      <div className="doc-extra">
        <label htmlFor="aadhaar">{t.aadhaarNumber}</label>
        <input
          id="aadhaar"
          inputMode="numeric"
          autoComplete="off"
          value={aadhaar}
          placeholder="XXXX XXXX XXXX"
          maxLength={14}
          onChange={(e) => {
            setAadhaar(formatAadhaar(e.target.value))
            setAadhaarSource('manual')
            if (aadhaarRead !== 'reading') setAadhaarRead(null)
          }}
          aria-invalid={typed.length === 12 && !validAadhaar(typed)}
          aria-describedby="aadhaar-note"
        />
        <p id="aadhaar-note" className="field-note" role="status">
          {aadhaarRead === 'reading' ? (
            <>
              <span className="spinner" aria-hidden="true" /> {t.aadhaarReading}
              {aadhaarNote && <span className="muted"> {aadhaarNote}</span>}
            </>
          ) : typed.length === 12 && !validAadhaar(typed) ? (
            <span className="warn-text">{t.aadhaarInvalid}</span>
          ) : aadhaarRead === 'found' && validAadhaar(typed) ? (
            <span className="ok-text">{t.aadhaarRead(maskAadhaar(typed.slice(-4)))}</span>
          ) : validAadhaar(typed) ? (
            <span className="ok-text">{t.aadhaarValid}</span>
          ) : aadhaarRead === 'missing' ? (
            <span className="warn-text">{t.aadhaarNotFound}</span>
          ) : !typed && profile.aadhaar_last4 ? (
            <span className="ok-text">✓ {t.aadhaarSavedAs(maskAadhaar(profile.aadhaar_last4))}</span>
          ) : null}
        </p>
        <p className="hint">{t.aadhaarPrivacy}</p>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="hint">{t.getApp}</p>
      <button
        className="btn primary wide"
        onClick={() => void next()}
        disabled={!allRequired || !aadhaarOk || working !== null || saving || aadhaarRead === 'reading'}
      >
        {t.continue}
      </button>
    </StepFrame>
  )
}

const todayLocal = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in the phone's timezone
const dmy = (iso: string) => iso.split('-').reverse().join('-')

const GROUPS: LicenceGroup[] = ['two_wheeler', 'four_wheeler', 'heavy']
const inGroup = (codes: string[], g: LicenceGroup) => codes.some((c) => (LICENCE_GROUPS[g] as readonly string[]).includes(c))

function LicenceStep({
  profile,
  serverOcr,
  onDone,
  onBack,
}: {
  profile: DriverProfile
  serverOcr: boolean
  onDone: () => void
  onBack: () => void
}) {
  const { t } = useT()
  const [uploaded, setUploaded] = useState<Set<DocType>>(new Set())
  const [working, setWorking] = useState<DocType | null>(null)
  const [reading, setReading] = useState(false)
  const [readNote, setReadNote] = useState<string | null>(null)
  const [readOk, setReadOk] = useState<boolean | null>(null)
  const [number, setNumber] = useState(profile.licence_number ?? '')
  const [codes, setCodes] = useState<string[]>(profile.licence_classes ?? [])
  const [validTill, setValidTill] = useState(profile.licence_valid_till ?? '')
  const [source, setSource] = useState<string>(profile.licence_source ?? 'manual')
  const [rawText, setRawText] = useState<string | null>(null)
  // What the photo said, to show under each field and to warn when it isn't a licence
  const [fromPhoto, setFromPhoto] = useState<ParsedLicence | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Photos picked in this visit, kept for in-browser reading; text read from each side
  const files = useRef<Partial<Record<DocType, File>>>({})
  const texts = useRef<Partial<Record<DocType, string>>>({})
  const typedNumber = useRef(Boolean(profile.licence_number))

  useEffect(() => {
    userApi<DocumentInfo[]>('/drivers/me/documents')
      .then((docs) => setUploaded(new Set(docs.map((d) => d.doc_type).filter((d) => LICENCE_SIDES.includes(d)))))
      .catch((err: Error) => setError(err.message))
  }, [])

  function apply(result: ParsedLicence, how: string, text: string | null) {
    const found = Boolean(result.licence_number || result.classes.length)
    if (result.licence_number && !typedNumber.current) setNumber(result.licence_number)
    if (result.classes.length) setCodes((prev) => [...new Set([...prev, ...result.classes])])
    if (result.valid_till) setValidTill(result.valid_till)
    if (found) {
      setSource(how)
      setRawText(text)
    }
    setFromPhoto(result)
    setReadOk(found)
  }

  async function read() {
    setReading(true)
    setReadOk(null)
    setReadNote(null)
    try {
      if (serverOcr) {
        try {
          const result = await userApi<ParsedLicence>('/drivers/me/licence/scan', { method: 'POST' })
          apply(result, 'ocr_server', result.raw_text)
          return
        } catch {
          // Server OCR failed: fall back to reading in this browser
        }
      }
      const sides = LICENCE_SIDES.filter((s) => files.current[s] && texts.current[s] === undefined)
      if (sides.length && needsFirstDownload()) setReadNote(t.firstLoad)
      for (const side of sides) texts.current[side] = await readImageText(files.current[side]!)
      const text = LICENCE_SIDES.map((s) => texts.current[s] ?? '').join('\n').trim()
      if (!text) {
        setReadOk(false)
        return
      }
      const result = await userApi<ParsedLicence>('/drivers/me/licence/parse', { body: { text: text.slice(0, 8000) } })
      apply(result, 'ocr_browser', text.slice(0, 4000))
    } catch {
      setReadOk(false)
    } finally {
      setReading(false)
      setReadNote(null)
    }
  }

  async function upload(side: DocType, file: File | undefined) {
    if (!file) return
    setError(null)
    setReadOk(null) // the earlier result is out of date until this photo has been read
    setFromPhoto(null)
    setWorking(side)
    try {
      files.current[side] = await uploadDocument(side, file, t.tooBig)
      delete texts.current[side]
      setUploaded((prev) => new Set(prev).add(side))
    } catch (err) {
      setError((err as Error).message)
      return
    } finally {
      setWorking(null)
    }
    void read()
  }

  function toggleGroup(g: LicenceGroup) {
    setCodes((prev) =>
      inGroup(prev, g) ? prev.filter((c) => !(LICENCE_GROUPS[g] as readonly string[]).includes(c)) : [...prev, DEFAULT_CODE[g]],
    )
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await userApi('/drivers/me/licence', {
        method: 'PUT',
        body: { licence_number: number.trim(), classes: codes, valid_till: validTill || null, source, raw_text: rawText },
      })
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const bothUploaded = LICENCE_SIDES.every((s) => uploaded.has(s))
  const expired = Boolean(validTill) && validTill < todayLocal()
  const canSave = bothUploaded && !expired && number.replace(/[\s-]/g, '').length >= 8 && GROUPS.some((g) => inGroup(codes, g))
  const numberFromPhoto = fromPhoto?.licence_number && fromPhoto.licence_number === number.replace(/[\s-]/g, '')
  const dateFromPhoto = fromPhoto?.valid_till && fromPhoto.valid_till === validTill

  return (
    <StepFrame title={t.stepLicence} onBack={onBack}>
      <p>{t.licenceIntro}</p>
      <ul className="doc-list">
        {LICENCE_SIDES.map((side) => {
          const done = uploaded.has(side)
          const id = `doc-${side}`
          return (
            <li key={side} className={done ? 'done' : ''}>
              <div>
                <strong>{t.labels[side]}</strong>
                <span className={done ? 'ok-text' : 'muted'}>
                  {working === side ? t.uploading : done ? `✓ ${t.uploaded}` : t.required}
                </span>
              </div>
              <label htmlFor={id} className={`btn ${done ? '' : 'primary'} ${working || reading ? 'disabled' : ''}`}>
                {done ? t.replace : t.choose}
              </label>
              <input
                id={id}
                className="sr-only"
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                disabled={working !== null || reading}
                onChange={(e) => {
                  void upload(side, e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </li>
          )
        })}
      </ul>

      {reading && (
        <p className="reading" role="status">
          <span className="spinner" aria-hidden="true" /> {t.reading}
          {readNote && <span className="muted"> {readNote}</span>}
        </p>
      )}
      {readOk === false && <p className="notice">{t.readFailed}</p>}
      {fromPhoto && !reading && (
        <p className={`photo-check ${fromPhoto.looks_like_licence ? 'good' : 'bad'}`} role="status">
          <span className="icon" aria-hidden="true">
            {fromPhoto.looks_like_licence ? '✓' : '!'}
          </span>
          <span>{fromPhoto.looks_like_licence ? t.photoIsLicence : t.photoNotLicence}</span>
        </p>
      )}

      <form onSubmit={save}>
        <label htmlFor="licence">{t.licenceNumber}</label>
        <input
          id="licence"
          value={number}
          onChange={(e) => {
            typedNumber.current = true
            setNumber(e.target.value.toUpperCase())
          }}
          placeholder="TN38 20200001234"
          maxLength={20}
          autoComplete="off"
          aria-describedby="licence-note"
        />
        {numberFromPhoto && (
          <p id="licence-note" className="field-note ok-text">
            ✓ {t.fromPhoto}: {fromPhoto!.licence_number} — {t.checkIt}
          </p>
        )}
        <fieldset className="chips">
          <legend>{t.licenceClasses}</legend>
          {GROUPS.map((g) => (
            <button
              type="button"
              key={g}
              role="checkbox"
              aria-checked={inGroup(codes, g)}
              className={`chip ${inGroup(codes, g) ? 'on' : ''}`}
              onClick={() => toggleGroup(g)}
            >
              {t.groupLabels[g]}
            </button>
          ))}
        </fieldset>
        {codes.length > 0 && (
          <>
            <p className="field-note">
              <strong>{t.allowedToDrive}</strong>
              {fromPhoto?.classes.length ? <span className="muted">({t.fromPhoto})</span> : null}
            </p>
            <ul className="class-list">
              {codes.map((c) => (
                <li key={c}>
                  <span className="class-code">{displayClass(c)}</span>
                  <span>{t.classInfo[c] ?? ''}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <label htmlFor="valid">{t.validTill}</label>
        <input
          id="valid"
          type="date"
          value={validTill}
          onChange={(e) => setValidTill(e.target.value)}
          aria-invalid={expired}
          aria-describedby="valid-note"
        />
        {validTill && (
          <p id="valid-note" className={`field-note ${expired ? 'warn-text' : 'ok-text'}`} role={expired ? 'alert' : undefined}>
            {expired ? t.licenceExpired(dmy(validTill)) : `✓ ${t.licenceValidTill(dmy(validTill))}`}
            {dateFromPhoto && !expired && <span className="muted"> · {t.fromPhoto}</span>}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!bothUploaded && <p className="hint">{t.uploadBothFirst}</p>}
        <div className="row-between">
          <button type="button" className="btn" onClick={() => void read()} disabled={!bothUploaded || reading}>
            {t.readAgain}
          </button>
          <button className="btn primary" disabled={!canSave || busy || reading || working !== null}>
            {t.save}
          </button>
        </div>
      </form>
    </StepFrame>
  )
}
