// The booking & cancellation policy customers agree to when they register. Fee amounts come from the
// order-service so the text always matches what is charged.
import { useEffect, useState } from 'react'
import { ORDER_API_URL, type BookingPolicy } from '../api'
import { useT } from '../i18n'
import { rupees } from '../trip/BookingConfirm'

const FALLBACK: BookingPolicy = {
  confirmation_fee_paise: 100,
  cancellation_fee_paise: 4900,
  cancellation_fee_applies: 'assigned',
  hourly_rate_paise: 15000,
  daily_rate_paise: 100000,
  daily_hours: 8,
  new_customer_discount_pct: 10,
}

export function useBookingPolicy(): BookingPolicy {
  const [policy, setPolicy] = useState<BookingPolicy>(FALLBACK)
  useEffect(() => {
    fetch(`${ORDER_API_URL}/bookings/policy`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p: BookingPolicy | null) => p && setPolicy(p))
      .catch(() => undefined)
  }, [])
  return policy
}

export default function BookingPolicyBox({
  accepted,
  onChange,
  updated,
}: {
  accepted: boolean
  onChange: (v: boolean) => void
  updated?: boolean
}) {
  const { t } = useT()
  const p = useBookingPolicy()
  const points = t.policyPoints(rupees(p.confirmation_fee_paise), rupees(p.cancellation_fee_paise), p.cancellation_fee_applies)
  return (
    <section className="policy-box" aria-labelledby="policy-title">
      <h3 id="policy-title">{t.policyTitle}</h3>
      {updated && <p className="warn-text">{t.policyUpdated}</p>}
      <ol>
        {points.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ol>
      <label className="check">
        <input type="checkbox" checked={accepted} onChange={(e) => onChange(e.target.checked)} />
        {t.policyAgree}
      </label>
    </section>
  )
}
