import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setToken } from '../api'

interface OtpRequestOut {
  message: string
  resend_after_seconds: number
  dev_code: string | null
}

interface TokenOut {
  access_token: string
  role: string
}

export default function Login() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api<OtpRequestOut>('/auth/otp/request', { method: 'POST', body: { phone } })
      setDevCode(res.dev_code)
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
      const res = await api<TokenOut>('/auth/otp/verify', { method: 'POST', body: { phone, code } })
      if (res.role !== 'admin') {
        setError('This number is not an admin account.')
        return
      }
      setToken(res.access_token)
      navigate('/drivers', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login">
      <section className="login-card">
        <div className="brand">
          <span className="brand-en">Vandi Ottunar</span>
          <span className="brand-ta">வண்டி ஓட்டுநர்</span>
        </div>
        <h1>Admin sign in</h1>

        {step === 'phone' ? (
          <form onSubmit={sendCode}>
            <label htmlFor="phone">Mobile number</label>
            <input
              id="phone"
              inputMode="tel"
              autoComplete="tel"
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <button className="btn primary" disabled={busy}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <label htmlFor="code">Code sent to {phone}</label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
              required
              autoFocus
            />
            {devCode && <p className="hint">Development code: {devCode}</p>}
            <button className="btn primary" disabled={busy}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <button type="button" className="btn link" onClick={() => setStep('phone')}>
              Change number
            </button>
          </form>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  )
}
