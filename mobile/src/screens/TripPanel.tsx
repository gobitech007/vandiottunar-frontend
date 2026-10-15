// Start a trip with the customer's code, share location, end it with the second code.
import * as Location from 'expo-location'
import { useEffect, useState } from 'react'
import { Linking, Text, View } from 'react-native'
import { formatWhen, orderApi, type Assignment } from '../api'
import { errorText, useT } from '../i18n'
import { isBackgroundTracking, sendPoints, startTripTracking, stopTripTracking, toPoint, type TrackingMode } from '../tripTracking'
import { Button, Card, colors, ErrorText, Field, styles } from '../ui'

const EARLY_MIN = 120 // START_EARLY_MINUTES in the order-service

export default function TripPanel({ job, onChange }: { job: Assignment; onChange: () => Promise<void> }) {
  const { t } = useT()
  const running = job.status === 'in_progress'
  const [step, setStep] = useState<'idle' | 'disclosure' | 'code'>('idle')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<TrackingMode | null>(null)

  // A running trip keeps sharing: resume after the app restarts; fall back to sharing while open
  useEffect(() => {
    if (!running) return
    let sub: Location.LocationSubscription | null = null
    let cancelled = false
    void (async () => {
      const m = (await isBackgroundTracking())
        ? 'background'
        : await startTripTracking(job.id, { title: t.trackingNotifTitle, body: t.trackingNotifBody })
      if (cancelled) return
      setMode(m)
      if (m === 'foreground') {
        let last = 0
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 15_000, distanceInterval: 25 },
          (loc) => {
            if (loc.timestamp - last < 10_000) return
            last = loc.timestamp
            void sendPoints(job.id, [toPoint(loc)]).then((r) => r === 'ended' && void onChange())
          },
        )
        if (cancelled) sub.remove()
      }
    })()
    return () => {
      cancelled = true
      sub?.remove()
    }
  }, [running, job.id, t, onChange])

  const earliest = new Date(job.start_at).getTime() - EARLY_MIN * 60_000

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      let lat: number | null = null
      let lng: number | null = null
      if (!running) {
        const fg = await Location.requestForegroundPermissionsAsync()
        if (!fg.granted) {
          setError(t.locationNeeded)
          return
        }
      }
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch {
        if (!running) {
          setError(t.locationNeeded)
          return
        }
      }
      await orderApi.post(`/driver/bookings/${job.id}/${running ? 'end' : 'start'}`, { code, lat, lng })
      if (running) await stopTripTracking()
      else setMode(await startTripTracking(job.id, { title: t.trackingNotifTitle, body: t.trackingNotifBody }))
      setStep('idle')
      setCode('')
      await onChange()
    } catch (err) {
      setError(errorText(err, t))
    } finally {
      setBusy(false)
    }
  }

  if (!running && Date.now() < earliest) {
    return <Text style={styles.muted}>{t.tooEarly(formatWhen(new Date(earliest).toISOString()))}</Text>
  }

  return (
    <View style={{ gap: 10 }}>
      {running && (
        <Card>
          <Text style={{ fontWeight: '800', color: colors.green, fontSize: 16 }}>{t.tripRunning(formatWhen(job.started_at!))}</Text>
          {mode && mode !== 'denied' && (
            <Text style={{ fontWeight: '700', color: mode === 'background' ? colors.ok : colors.danger }}>
              {mode === 'background' ? `● ${t.sharingBackground}` : t.sharingForeground}
            </Text>
          )}
          {mode === 'foreground' && <Button label={t.openSettings} variant="secondary" onPress={() => Linking.openSettings()} />}
        </Card>
      )}
      {step === 'disclosure' && (
        <Card>
          <Text style={{ fontWeight: '800', fontSize: 17, color: colors.green }}>{t.disclosureTitle}</Text>
          <Text style={styles.body16}>{t.disclosure}</Text>
          <Button label={t.continue} onPress={() => setStep('code')} />
          <Button label={t.cancel} variant="ghost" onPress={() => setStep('idle')} />
        </Card>
      )}
      {step === 'code' && (
        <Card>
          <Field
            label={running ? t.enterEndCode : t.enterStartCode}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            maxLength={4}
            autoFocus
            style={{ fontSize: 26, letterSpacing: 8, textAlign: 'center', fontWeight: '800' }}
          />
          <Text style={styles.muted}>{running ? t.endCodeHelp : t.startCodeHelp}</Text>
          <Button label={running ? t.endTrip : t.startTrip} onPress={submit} busy={busy} disabled={code.length !== 4} />
          <Button label={t.cancel} variant="ghost" onPress={() => setStep('idle')} />
        </Card>
      )}
      <ErrorText>{error}</ErrorText>
      {step === 'idle' && (
        <Button
          label={running ? `■ ${t.endTrip}` : `▶ ${t.startTrip}`}
          variant={running ? 'secondary' : 'primary'}
          onPress={() => setStep(running ? 'code' : 'disclosure')}
        />
      )}
    </View>
  )
}
