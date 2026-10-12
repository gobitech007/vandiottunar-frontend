import { Link } from 'react-router-dom'
import { useT } from '../i18n'
import DriverIllustration from './DriverIllustration'
import PublicShell from './PublicShell'

export default function Home() {
  const { t } = useT()
  return (
    <PublicShell>
      <section className="hero">
        <div className="hero-text">
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
        </div>
        <DriverIllustration label={t.heroArt} />
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
