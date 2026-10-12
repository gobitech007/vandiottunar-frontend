import { Link } from 'react-router-dom'
import { useT } from '../i18n'
import PublicShell from './PublicShell'

function Wheel() {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className="hero-wheel" fill="none" stroke="currentColor" strokeWidth="6">
      <circle cx="50" cy="50" r="44" />
      <circle cx="50" cy="50" r="10" />
      <path d="M40 50H6M60 50h34M50 60v34" />
    </svg>
  )
}

export default function Home() {
  const { t } = useT()
  return (
    <PublicShell>
      <section className="hero">
        <Wheel />
        <h1>{t.heroTitle}</h1>
        <p>{t.heroBody}</p>
        <ul className="trust">
          <li>{t.trust1}</li>
          <li>{t.trust2}</li>
          <li>{t.trust3}</li>
        </ul>
        <p className="already">
          {t.alreadyRegistered} <Link to="/login">{t.login} →</Link>
        </p>
      </section>

      <section className="choices" aria-label={`${t.registerCustomer} / ${t.registerDriver}`}>
        <article className="choice">
          <h2>{t.needDriver}</h2>
          <p>{t.needDriverBody}</p>
          <Link className="btn primary big" to="/register/customer">
            {t.registerCustomer} →
          </Link>
        </article>
        <article className="choice choice-alt">
          <h2>{t.amDriver}</h2>
          <p>{t.amDriverBody}</p>
          <Link className="btn accent big" to="/register/driver">
            {t.registerDriver} →
          </Link>
        </article>
      </section>
    </PublicShell>
  )
}
