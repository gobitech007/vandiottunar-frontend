// Booking & cancellation policy that customers agree to (same text as the website, amounts from the order-service).
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ORDER_API_URL, rupees, type BookingPolicy } from '../api'
import { useT } from '../i18n'
import { colors, styles } from '../ui'

const FALLBACK: BookingPolicy = {
  confirmation_fee_paise: 100,
  cancellation_fee_paise: 4900,
  cancellation_fee_applies: 'assigned',
  hourly_rate_paise: 15000,
  daily_rate_paise: 100000,
  daily_hours: 8,
  new_customer_discount_pct: 10,
}

export default function PolicyBox({ accepted, onChange, updated }: { accepted: boolean; onChange: (v: boolean) => void; updated?: boolean }) {
  const { t } = useT()
  const [p, setP] = useState<BookingPolicy>(FALLBACK)
  useEffect(() => {
    fetch(`${ORDER_API_URL}/bookings/policy`)
      .then((r) => (r.ok ? r.json() : null))
      .then((x: BookingPolicy | null) => x && setP(x))
      .catch(() => undefined)
  }, [])
  const points = t.policyPoints(rupees(p.confirmation_fee_paise), rupees(p.cancellation_fee_paise), p.cancellation_fee_applies)
  return (
    <View style={{ borderWidth: 1.5, borderColor: colors.line, borderRadius: 12, backgroundColor: '#FBF8F0', padding: 14, gap: 8 }}>
      <Text style={{ fontWeight: '800', fontSize: 16, color: colors.green }}>{t.policyTitle}</Text>
      {updated && <Text style={{ color: colors.danger, fontWeight: '700' }}>{t.policyUpdated}</Text>}
      {points.map((x, i) => (
        <Text key={i} style={styles.body16}>
          {i + 1}. {x}
        </Text>
      ))}
      <Pressable
        onPress={() => onChange(!accepted)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', minHeight: 44, paddingTop: 6 }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: colors.green,
            backgroundColor: accepted ? colors.green : '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {accepted && <Text style={{ color: colors.cream, fontWeight: '900' }}>✓</Text>}
        </View>
        <Text style={{ flex: 1, fontWeight: '700', color: colors.ink, fontSize: 15 }}>{t.policyAgree}</Text>
      </Pressable>
    </View>
  )
}
