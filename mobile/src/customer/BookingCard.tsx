import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { Linking, Pressable, Text, View } from 'react-native'
import { formatWhen, orderApi, paymentApi, rupees, type Booking, type Payment } from '../api'
import { errorText, useT } from '../i18n'
import { Button, Card, colors, ErrorText, styles } from '../ui'
import LiveMap from './LiveMap'

const RETURN_URL = 'vandiottunar://payment'

function Code({ label, digits, tip }: { label: string; digits: string; tip: string }) {
  return (
    <View style={{ backgroundColor: '#FFF6D6', borderColor: colors.mustard, borderWidth: 1.5, borderRadius: 12, padding: 12, gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontWeight: '800', color: colors.ink }}>{label}</Text>
        <Text style={{ fontSize: 30, fontWeight: '900', letterSpacing: 8, color: colors.green }} accessibilityLabel={digits.split('').join(' ')}>
          {digits}
        </Text>
      </View>
      <Text style={styles.muted}>{tip}</Text>
    </View>
  )
}

export function WhatsAppButton({ url, label }: { url: string; label: string }) {
  const { t } = useT()
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        onPress={() => Linking.openURL(url)}
        accessibilityRole="link"
        style={{ backgroundColor: '#1F9D55', minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}
      >
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>💬 {label}</Text>
      </Pressable>
      <Text style={styles.muted}>{t.chatPrivacy}</Text>
    </View>
  )
}

export default function BookingCard({
  b,
  onChanged,
  onNotice,
}: {
  b: Booking
  onChanged: () => Promise<void>
  onNotice: (text: string, ok: boolean) => void
}) {
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [route, setRoute] = useState(false)
  const confirmed = b.payment_status !== 'unpaid'
  const hasDriver = (b.status === 'assigned' || b.status === 'in_progress') && b.driver_name

  async function pay() {
    setBusy(true)
    setError(null)
    try {
      const p = await paymentApi.post<Payment>(`/payments/booking/${b.id}`, { return_to: 'app' })
      if (!p.pay_url) throw new Error(t.paymentFailed)
      // Razorpay's page in an in-app browser; it sends the customer back to vandiottunar://payment
      const result = await WebBrowser.openAuthSessionAsync(p.pay_url, RETURN_URL)
      if (result.type === 'success') {
        const ok = /[?&]payment=paid\b/.test(result.url)
        onNotice(ok ? t.paymentDone : t.paymentFailed, ok)
      }
      await onChanged()
    } catch (err) {
      setError(errorText(err, t))
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (!confirmCancel) {
      setConfirmCancel(true)
      return
    }
    setBusy(true)
    try {
      await orderApi.post(`/bookings/${b.id}/cancel`, {})
      await onChanged()
    } catch (err) {
      setError(errorText(err, t))
    } finally {
      setBusy(false)
      setConfirmCancel(false)
    }
  }

  const pill = b.status === 'assigned' && confirmed ? t.confirmedPill : t.statusLabels[b.status]
  const pillOn = b.status === 'in_progress' || (b.status === 'assigned' && confirmed)
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text
          style={{
            fontWeight: '800',
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 999,
            overflow: 'hidden',
            backgroundColor: pillOn ? colors.green : b.status === 'pending' ? colors.mustard : '#E6EFE9',
            color: pillOn ? colors.cream : colors.green,
          }}
        >
          {pill}
        </Text>
        <Text style={styles.muted}>{t.bookingRef(b.reference)}</Text>
      </View>
      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink }}>{formatWhen(b.start_at)}</Text>
      <Text style={styles.muted}>→ {b.end_at ? formatWhen(b.end_at) : t.noEnd}</Text>
      <Text style={styles.body16}>
        {t.bookingTypeLabels[b.booking_type]} · {t.vehicleLabels[b.vehicle_class]}
        {b.car_number ? ` · ${b.car_number}` : ''}
      </Text>
      <Text style={styles.body16}>
        {t.pickup}: {[b.pickup_address, b.pickup_area, b.pickup_pincode].filter(Boolean).join(', ')}
      </Text>

      {hasDriver && (
        <View style={{ backgroundColor: '#F3ECDB', borderRadius: 12, padding: 12 }}>
          <Text style={styles.muted}>{t.yourDriver}</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink }}>{b.driver_name}</Text>
        </View>
      )}
      {hasDriver && !confirmed && (
        <View style={{ backgroundColor: '#FFF6D6', borderColor: colors.mustard, borderWidth: 1.5, borderRadius: 12, padding: 12, gap: 8 }}>
          <Text style={{ fontWeight: '800', color: colors.ink }}>{t.confirmTitle(b.driver_name ?? '')}</Text>
          <Text style={styles.body16}>{t.confirmBody(rupees(b.fee_paise))}</Text>
          <Button label={t.payNow(rupees(b.fee_paise))} onPress={pay} busy={busy} />
        </View>
      )}
      {hasDriver && confirmed && b.chat_url && <WhatsAppButton url={b.chat_url} label={t.chatDriver} />}

      {b.status === 'assigned' && b.start_code && (
        <Code label={t.yourStartCode} digits={b.start_code} tip={t.startCodeTip(b.driver_name ?? '')} />
      )}
      {b.status === 'in_progress' && (
        <>
          {b.started_at && <Text style={{ color: colors.ok, fontWeight: '800' }}>{t.tripStarted(formatWhen(b.started_at))}</Text>}
          {b.end_code && <Code label={t.yourEndCode} digits={b.end_code} tip={t.endCodeTip} />}
          <LiveMap bookingId={b.id} live />
        </>
      )}
      {b.status === 'completed' && b.started_at && (
        <>
          <Text style={styles.muted}>
            {t.tripStarted(formatWhen(b.started_at))} · {t.travelled((b.distance_m / 1000).toFixed(1))}
          </Text>
          <Button label={route ? t.hideRoute : t.showRoute} variant="ghost" onPress={() => setRoute((v) => !v)} />
          {route && <LiveMap bookingId={b.id} live={false} />}
        </>
      )}
      {b.status === 'pending' && <Text style={styles.muted}>{t.findingDriver}</Text>}
      <ErrorText>{error}</ErrorText>
      {(b.status === 'pending' || b.status === 'assigned') && (
        <Button label={confirmCancel ? t.confirmCancel : t.cancelBooking} variant="secondary" onPress={cancel} disabled={busy} />
      )}
    </Card>
  )
}
