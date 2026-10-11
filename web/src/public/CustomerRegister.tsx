import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, getUserSession, setUserSession, userApi, type CustomerProfile, type UserSession } from '../api'
import { useT } from '../i18n'
import PhoneOtp from './PhoneOtp'
import PublicShell from './PublicShell'
import WrongRole from './WrongRole'

type Kind = 'customer' | 'employer'
const NEEDS = ['on_demand', 'job']

export default function CustomerRegister() {
  const { t } = useT()
  const [session, setSession] = useState<UserSession | null>(getUserSession)
  const [kind, setKind] = useState<Kind | null>(null)
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCustomer = session?.role === 'customer' || session?.role === 'employer'

  const load = useCallback(async () => {
    setError(null)
    try {
      setProfile(await userApi<CustomerProfile>('/customers/me'))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUserSession(null)
        setSession(null)
      } else setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    if (isCustomer) void load()
  }, [isCustomer, load])

  let body
  if (!session && !kind) {
    body = <KindPicker onPick={setKind} />
  } else if (!session && kind) {
    body = (
      <>
        <button className="btn link back" onClick={() => setKind(null)}>
          ‹ {t.back}
        </button>
        <p className="strong">{kind === 'employer' ? t.business : t.carOwner}</p>
        <PhoneOtp role={kind} onSignedIn={setSession} />
      </>
    )
  } else if (session && !isCustomer) {
    body = <WrongRole role={session.role} />
  } else if (!profile) {
    body = error ? <p className="error">{error}</p> : <p className="muted">…</p>
  } else if (!profile.profile_complete || editing) {
    body = (
      <CustomerForm
        profile={profile}
        isEmployer={session?.role === 'employer'}
        onSaved={(p) => {
          setProfile(p)
          setEditing(false)
          window.scrollTo(0, 0)
        }}
      />
    )
  } else {
    body = (
      <section className="card status-card is-ok">
        <div className="status-icon" aria-hidden="true">
          ✓
        </div>
        <h2>{t.customerDoneTitle}</h2>
        {profile.full_name && <p className="strong">{profile.full_name}</p>}
        <p>{t.customerDoneBody}</p>
        <div className="row-between">
          <button className="btn" onClick={() => setEditing(true)}>
            {t.editDetails}
          </button>
          <Link to="/">{t.home}</Link>
        </div>
      </section>
    )
  }

  return (
    <PublicShell>
      <div className="flow">
        <h1>{t.customerTitle}</h1>
        {body}
      </div>
    </PublicShell>
  )
}

function KindPicker({ onPick }: { onPick: (k: Kind) => void }) {
  const { t } = useT()
  return (
    <>
      <h2 className="sub">{t.whoAreYou}</h2>
      <div className="kind-grid">
        <button className="kind" onClick={() => onPick('customer')}>
          <strong>{t.carOwner}</strong>
          <span>{t.carOwnerBody}</span>
        </button>
        <button className="kind" onClick={() => onPick('employer')}>
          <strong>{t.business}</strong>
          <span>{t.businessBody}</span>
        </button>
      </div>
    </>
  )
}

function CustomerForm({
  profile,
  isEmployer,
  onSaved,
}: {
  profile: CustomerProfile
  isEmployer: boolean
  onSaved: (p: CustomerProfile) => void
}) {
  const { t, lang } = useT()
  const [name, setName] = useState(profile.full_name ?? '')
  const [email, setEmail] = useState(profile.email ?? '')
  const [company, setCompany] = useState(profile.company_name ?? '')
  const [pincode, setPincode] = useState(profile.home_pincode ?? '')
  const [area, setArea] = useState(profile.home_area ?? '')
  const [needs, setNeeds] = useState<string[]>(profile.needs)
  const [vehicle, setVehicle] = useState(profile.vehicle_note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const complete =
    name.trim().length >= 2 && /^[1-9]\d{5}$/.test(pincode) && needs.length > 0 && (!isEmployer || company.trim())

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        full_name: name.trim(),
        preferred_language: lang,
        home_pincode: pincode,
        home_area: area.trim() || null,
        needs,
        vehicle_note: vehicle.trim() || null,
      }
      if (email.trim()) body.email = email.trim()
      if (isEmployer) body.company_name = company.trim()
      onSaved(await userApi<CustomerProfile>('/customers/me', { method: 'PUT', body }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" onSubmit={save}>
      <label htmlFor="c-name">{t.yourName}</label>
      <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} />
      {isEmployer && (
        <>
          <label htmlFor="c-company">{t.companyName}</label>
          <input
            id="c-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoComplete="organization"
            maxLength={160}
          />
        </>
      )}
      <label htmlFor="c-email">{t.email}</label>
      <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <label htmlFor="c-pin">{t.yourPincode}</label>
      <input
        id="c-pin"
        inputMode="numeric"
        value={pincode}
        onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        autoComplete="postal-code"
        placeholder="641001"
      />
      <label htmlFor="c-area">{t.yourArea}</label>
      <input id="c-area" value={area} onChange={(e) => setArea(e.target.value)} maxLength={120} />
      <fieldset className="chips">
        <legend>{t.needs}</legend>
        {NEEDS.map((n) => {
          const on = needs.includes(n)
          return (
            <button
              type="button"
              key={n}
              role="checkbox"
              aria-checked={on}
              className={`chip ${on ? 'on' : ''}`}
              onClick={() => setNeeds((l) => (on ? l.filter((x) => x !== n) : [...l, n]))}
            >
              {t.needLabels[n]}
            </button>
          )
        })}
      </fieldset>
      <label htmlFor="c-vehicle">{t.vehicleNote}</label>
      <input
        id="c-vehicle"
        value={vehicle}
        onChange={(e) => setVehicle(e.target.value)}
        placeholder={t.vehicleNotePh}
        maxLength={120}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="btn primary wide" disabled={!complete || busy}>
        {t.register}
      </button>
    </form>
  )
}
