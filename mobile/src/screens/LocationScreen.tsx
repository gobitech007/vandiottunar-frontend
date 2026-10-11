import * as Location from 'expo-location'
import { useState } from 'react'
import { Linking, Text } from 'react-native'
import { api, type Profile } from '../api'
import { errorText, useT } from '../i18n'
import { Button, Card, Chips, colors, ErrorText, Field, Screen, styles } from '../ui'

const RADII = ['5', '10', '15', '25'] as const

interface Fix {
  lat: number
  lng: number
  accuracy: number | null
}

export default function LocationScreen({
  profile,
  onDone,
  onBack,
}: {
  profile: Profile
  onDone: () => void
  onBack: () => void
}) {
  const { t } = useT()
  const [fix, setFix] = useState<Fix | null>(
    profile.registration_lat != null && profile.registration_lng != null
      ? { lat: profile.registration_lat, lng: profile.registration_lng, accuracy: null }
      : null,
  )
  const [pincode, setPincode] = useState(profile.home_pincode ?? '')
  const [area, setArea] = useState(profile.home_area ?? '')
  const [radius, setRadius] = useState(String(profile.service_radius_km ?? 10))
  const [locating, setLocating] = useState(false)
  const [denied, setDenied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function locate() {
    setLocating(true)
    setError(null)
    setDenied(false)
    try {
      const perm = await Location.requestForegroundPermissionsAsync()
      if (perm.status !== 'granted') {
        setDenied(true)
        return
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null }
      setFix(next)
      // Prefill pincode/area from the phone's geocoder; the driver can change them
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: next.lat, longitude: next.lng })
        if (place?.postalCode && !pincode) setPincode(place.postalCode.replace(/\D/g, '').slice(0, 6))
        const locality = place?.district ?? place?.subregion ?? place?.city
        if (locality && !area) setArea(locality)
      } catch {
        /* geocoding is optional */
      }
    } catch (err) {
      setError(errorText(err, t))
    } finally {
      setLocating(false)
    }
  }

  async function save() {
    if (!fix) return
    setBusy(true)
    setError(null)
    try {
      await api.put('/drivers/me/location', {
        lat: fix.lat,
        lng: fix.lng,
        accuracy_m: fix.accuracy,
        home_pincode: pincode,
        home_area: area.trim() || null,
        service_radius_km: Number(radius),
      })
      onDone()
    } catch (err) {
      setError(errorText(err, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title={t.stepLocation} onBack={onBack}>
      <Text style={styles.body16}>{t.locationWhy}</Text>
      <Button
        label={locating ? t.locating : t.useMyLocation}
        onPress={locate}
        variant={fix ? 'secondary' : 'primary'}
        busy={locating}
      />
      {denied && (
        <Card>
          <Text style={[styles.body16, { color: colors.danger, fontWeight: '700' }]}>{t.locationDenied}</Text>
          <Button label={t.openSettings} variant="secondary" onPress={() => Linking.openSettings()} />
        </Card>
      )}
      {fix && (
        <Card>
          <Text style={[styles.body16, { fontWeight: '800', color: colors.ok }]}>
            {t.captured(fix.accuracy != null ? Math.round(fix.accuracy) : 0)}
          </Text>
          <Text style={styles.muted}>{`${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}`}</Text>
        </Card>
      )}
      <Field
        label={t.pincode}
        value={pincode}
        onChangeText={(v) => setPincode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        placeholder="641001"
      />
      <Field label={t.area} value={area} onChangeText={setArea} maxLength={120} placeholder="RS Puram" />
      <Chips
        label={t.radius}
        options={RADII}
        selected={[radius]}
        onToggle={setRadius}
        render={(v) => `${v} km`}
      />
      <ErrorText>{error}</ErrorText>
      <Button label={t.save} onPress={save} busy={busy} disabled={!fix || !/^[1-9]\d{5}$/.test(pincode)} />
    </Screen>
  )
}
