// Driver fare for a trip booking: ₹150/h, ₹1000 per 8-hour day, new-customer discount.
// Shows the estimate from the booked times, or the real fare once the trip has ended.
import type { Booking } from '../api'
import { useT } from '../i18n'

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

export function FareBox({ b }: { b: Booking }) {
  const { t } = useT()
  const r = b.rates
  if (!r) return null // permanent jobs aren't priced by the hour
  const f = b.fare

  return (
    <div className="fare-box" aria-label={t.fareRatesTitle}>
      <strong>{!f ? t.fareRatesTitle : f.basis === 'actual' ? t.fareActualTitle : t.fareEstimateTitle}</strong>
      <p className="muted">{t.fareRates(rupees(r.hourly_rate_paise), rupees(r.daily_rate_paise), r.daily_hours)}</p>
      {f ? (
        <>
          <p className="muted">{f.basis === 'actual' ? t.fareActualHours(f.hours) : t.fareBookedHours(f.hours)}</p>
          <dl className="fare-lines">
            {f.days > 0 && (
              <>
                <dt>{t.fareDays(f.days, f.daily_hours, rupees(f.daily_rate_paise))}</dt>
                <dd>{rupees(f.days * f.daily_rate_paise)}</dd>
              </>
            )}
            {f.extra_hours > 0 && (
              <>
                <dt>{t.fareHours(f.extra_hours, rupees(f.hourly_rate_paise), f.days > 0)}</dt>
                <dd>{rupees(f.extra_hours * f.hourly_rate_paise)}</dd>
              </>
            )}
            {f.discount_paise > 0 && (
              <>
                <dt>{t.fareDiscount(f.discount_pct)}</dt>
                <dd className="discount">−{rupees(f.discount_paise)}</dd>
              </>
            )}
            <dt className="total">{t.fareTotal}</dt>
            <dd className="total">{rupees(f.total_paise)}</dd>
          </dl>
          {f.basis === 'planned' && <p className="hint">{t.fareEstimateNote}</p>}
        </>
      ) : (
        <>
          {r.discount_pct > 0 && <p className="discount">{t.fareNewCustomer(r.discount_pct)}</p>}
          <p className="hint">{t.fareNoEnd}</p>
        </>
      )}
    </div>
  )
}
