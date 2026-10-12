import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getUserSession, setUserSession } from '../api'
import { useT } from '../i18n'

const YEAR = new Date().getFullYear()

export function LangToggle() {
  const { lang, setLang } = useT()
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      {(['ta', 'en'] as const).map((l) => (
        <button key={l} className={lang === l ? 'active' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>
          {l === 'ta' ? 'தமிழ்' : 'English'}
        </button>
      ))}
    </div>
  )
}

export default function PublicShell({ children }: { children: ReactNode }) {
  const { t } = useT()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const session = getUserSession()

  return (
    <div className="public">
      <header className="public-bar">
        <Link to="/" className="brand" aria-label={t.home}>
          <span className="brand-en">{t.brand}</span>
          <span className="brand-ta">{t.brandAlt}</span>
        </Link>
        <div className="public-bar-actions">
          <LangToggle />
          {!session && pathname !== '/login' && (
            <Link className="btn link" to="/login">
              {t.login}
            </Link>
          )}
          {session && pathname !== '/dashboard' && (
            <Link className="btn link" to="/dashboard">
              {t.myDashboard}
            </Link>
          )}
          {session && pathname === '/dashboard' && (
            <button
              className="btn link"
              onClick={() => {
                setUserSession(null)
                navigate('/')
              }}
            >
              {t.signOut}
            </button>
          )}
        </div>
      </header>
      <main>{children}</main>
      <footer className="public-foot">
        <span>© {YEAR} Vandi Ottunar · Coimbatore</span>
        <Link to="/admin">{t.adminLink}</Link>
      </footer>
    </div>
  )
}
