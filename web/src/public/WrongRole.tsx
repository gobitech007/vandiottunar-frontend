import { Link, useNavigate } from 'react-router-dom'
import { setUserSession, type UserRole } from '../api'
import { useT } from '../i18n'

const PAGE: Record<UserRole, string> = {
  driver: '/register/driver',
  customer: '/register/customer',
  employer: '/register/customer',
  admin: '/admin',
}

/** Shown when someone signs in on the driver page with a customer number, or the other way round. */
export default function WrongRole({ role }: { role: UserRole }) {
  const { t } = useT()
  const navigate = useNavigate()
  return (
    <div className="card narrow">
      <p className="notice">{t.wrongRole(t.labels[role])}</p>
      <div className="row-between">
        <Link className="btn primary" to={PAGE[role]}>
          {t.goToRightPage}
        </Link>
        <button
          className="btn"
          onClick={() => {
            setUserSession(null)
            navigate(0)
          }}
        >
          {t.signOut}
        </button>
      </div>
    </div>
  )
}
