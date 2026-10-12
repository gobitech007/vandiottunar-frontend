import { Link, Navigate, useNavigate } from 'react-router-dom'
import { getUserSession, setToken } from '../api'
import { useT } from '../i18n'
import PhoneOtp from './PhoneOtp'
import PublicShell from './PublicShell'

/** One sign-in for everyone: drivers and customers go to their dashboard, admins to the admin panel. */
export default function LoginPage() {
  const { t } = useT()
  const navigate = useNavigate()
  if (getUserSession()) return <Navigate to="/dashboard" replace />

  return (
    <PublicShell>
      <div className="flow">
        <h1>{t.loginTitle}</h1>
        <p>{t.loginBody}</p>
        <PhoneOtp
          intent="login"
          onSignedIn={(s) => {
            if (s.role === 'admin') {
              setToken(s.token)
              navigate('/admin/drivers', { replace: true })
            } else {
              navigate('/dashboard', { replace: true })
            }
          }}
        />
        <div className="card narrow register-links">
          <strong>{t.newHere}</strong>
          <Link to="/register/driver">{t.registerDriver}</Link>
          <Link to="/register/customer">{t.registerCustomer}</Link>
        </div>
      </div>
    </PublicShell>
  )
}
