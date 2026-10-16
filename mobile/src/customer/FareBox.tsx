// Driver fare for a trip booking (same as the website): ₹150/h, ₹1000 per 8-hour day, new-customer discount.
import { Text, View } from 'react-native'
import { rupees, type Booking } from '../api'
import { useT } from '../i18n'
import { colors, styles } from '../ui'

function Line({ label, amount, total, green }: { label: string; amount: string; total?: boolean; green?: boolean }) {
  const color = green ? colors.ok : total ? colors.green : colors.ink
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        ...(total ? { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 6, marginTop: 2 } : {}),
      }}
    >
      <Text style={{ flex: 1, fontSize: 15, color, fontWeight: total || green ? '800' : '400' }}>{label}</Text>
      <Text style={{ fontSize: 15, color, fontWeight: total || green ? '800' : '600' }}>{amount}</Text>
    </View>
  )
}

export default function FareBox({ b }: { b: Booking }) {
  const { t } = useT()
  const r = b.rates
  if (!r) return null // permanent jobs aren't priced by the hour
  const f = b.fare

  return (
    <View
      accessibilityLabel={t.fareRatesTitle}
      style={{ backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, gap: 6 }}
    >
      <Text style={{ fontWeight: '800', color: colors.ink, fontSize: 16 }}>
        {!f ? t.fareRatesTitle : f.basis === 'actual' ? t.fareActualTitle : t.fareEstimateTitle}
      </Text>
      <Text style={styles.muted}>{t.fareRates(rupees(r.hourly_rate_paise), rupees(r.daily_rate_paise), r.daily_hours)}</Text>
      {f ? (
        <>
          <Text style={styles.muted}>{f.basis === 'actual' ? t.fareActualHours(f.hours) : t.fareBookedHours(f.hours)}</Text>
          {f.days > 0 && (
            <Line label={t.fareDays(f.days, f.daily_hours, rupees(f.daily_rate_paise))} amount={rupees(f.days * f.daily_rate_paise)} />
          )}
          {f.extra_hours > 0 && (
            <Line
              label={t.fareHours(f.extra_hours, rupees(f.hourly_rate_paise), f.days > 0)}
              amount={rupees(f.extra_hours * f.hourly_rate_paise)}
            />
          )}
          {f.discount_paise > 0 && <Line label={t.fareDiscount(f.discount_pct)} amount={`−${rupees(f.discount_paise)}`} green />}
          <Line label={t.fareTotal} amount={rupees(f.total_paise)} total />
          {f.basis === 'planned' && <Text style={[styles.muted, { fontSize: 13 }]}>{t.fareEstimateNote}</Text>}
        </>
      ) : (
        <>
          {r.discount_pct > 0 && <Text style={{ color: colors.ok, fontWeight: '800' }}>{t.fareNewCustomer(r.discount_pct)}</Text>}
          <Text style={[styles.muted, { fontSize: 13 }]}>{t.fareNoEnd}</Text>
        </>
      )}
    </View>
  )
}
