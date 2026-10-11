import { useEffect, useState, type FormEvent } from 'react'
import { userApi, setUserSession, type UserRole, type UserSession } from '../api'
import { useT } from '../i18n'

interface OtpOut {
  resend_after_seconds: number
  dev_code: string | null
}

interface TokenOut {
  access_token: string
  role: UserRole
  is_new_user: boolean
}

/** Phone + OTP sign-in for drivers and customers. New users get `role`; existing users keep theirs. */
export default function PhoneOtp({ role, onSignedIn }: { role: UserRole; onSignedIn: (s: UserSession) => void }) {
  const { t } = useT()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [wait, setWait] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (wait <= 0) return
    const id = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(id)
  }, [wait])

  async function sendCode(e?: FormEvent) {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await userApi<OtpOut>('/auth/otp/request', { body: { phone } })
      setDevCode(res.dev_code)
      setWait(res.resend_after_seconds)
      setCode('')
      setStep('code')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await userApi<TokenOut>('/auth/otp/verify', { body: { phone, code, role } })
      const session = { token: res.access_token, role: res.role }
      setUserSession(session)
      onSignedIn(session)
    } catch (err) {
      setError((err as Error).message)
      setCode('') // a used or expired code can't be retried — ask for a fresh one
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card narrow">
      {step === 'phone' ? (
        <form onSubmit={sendCode}>
          <label htmlFor="phone">{t.phoneLabel}</label>
          <div className="phone-input">
            <span aria-hidden="true">+91</span>
            <input
              id="phone"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={15}
              required
            />
          </div>
          <button className="btn primary wide" disabled={busy || phone.replace(/\D/g, '').length < 10}>
            {busy ? '…' : t.sendCode}
          </button>
        </form>
      ) : (
        <form onSubmit={verify}>
          <label htmlFor="code">{t.codeLabel(phone)}</label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            maxLength={6}
            required
            autoFocus
          />
          {devCode && (
            <p className="hint">
              {t.devCode}: <strong>{devCode}</strong>
            </p>
          )}
          <button className="btn primary wide" disabled={busy || code.length < 6}>
            {busy ? '…' : t.verify}
          </button>
          <div className="row-between">
            <button type="button" className="btn link" onClick={() => setStep('phone')}>
              {t.changeNumber}
            </button>
            <button type="button" className="btn link" disabled={wait > 0 || busy} onClick={() => void sendCode()}>
              {wait > 0 ? t.resendIn(wait) : t.resend}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
