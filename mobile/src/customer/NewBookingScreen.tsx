import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import * as Location from 'expo-location'
import { useState } from 'react'
import { Platform, Text, View } from 'react-native'
import { CAR_RE, cleanCarNumber, formatWhen, orderApi, type CustomerProfile } from '../api'
import { errorText, useT } from '../i18n'
import { Button, Chips, colors, ErrorText, Field, Screen, styles } from '../ui'

/** Date then time on Android (two native dialogs); inline picker elsewhere. */
function pickDateTime(initial: Date, onPicked: (d: Date) => void) {
  if (Platform.OS !== 'android') return false
  DateTimePickerAndroid.open({
    value: initial,
    mode: 'date',
    minimumDate: new Date(),
    onChange: (e, date) => {
      if (e.type !== 'set' || !date) return
      DateTimePickerAndroid.open({
        value: date,
        mode: 'time',
        is24Hour: false,
        onChange: (e2, time) => {
          if (e2.type === 'set' && time) onPicked(time)
        },
      })
    },
  })
  return true
}

function nextHour() {
  const d = new Date(Date.now() + 2 * 3600_000)
  d.setMinutes(0, 0, 0)
  return d
}

export default function NewBookingScreen({
  profile,
  onDone,
  onBack,
}: {
  profile: CustomerProfile
  onDone: () => void
  onBack: () => void
}) {
  const { t } = useT()
  const [type, setType] = useState<'on_demand' | 'job'>(profile.needs.includes('on_demand') || !profile.needs.length ? 'on_demand' : 'job')
  const [vehicle, setVehicle] = useState<'four_wheeler' | 'heavy' | 'two_wheeler'>('four_wheeler')
  const [start, setStart] = useState<Date | null>(null)
  const [end, setEnd] = useState<Date | null>(null)
  const [iosPicker, setIosPicker] = useState<'start' | 'end' | null>(null)
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number; pincode: string | null; area: string | null } | null>(null)
  const [locating, setLocating] = useState(false)
  const [notes, setNotes] = useState('')
  const [car, setCar] = useState(profile.car_number ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function locate() {
    setLocating(true)
    setError(null)
    try {
      const perm = await Location.requestForegroundPermissionsAsync()
      if (!perm.granted) {
        setError(t.locationDenied)
        return
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      const [place] = await Location.reverseGeocodeAsync(pos.coords).catch(() => [])
      setCoords({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        pincode: place?.postalCode && /^[1-9]\d{5}$/.test(place.postalCode) ? place.postalCode : null,
        area: place?.district || place?.subregion || place?.city || null,
      })
      if (!address && place) setAddress([place.name, place.street].filter(Boolean).join(', '))
    } catch (err) {
      setError(errorText(err, t))
    } finally {
      setLocating(false)
    }
  }

  const carOk = !car.trim() || CAR_RE.test(cleanCarNumber(car))
  const ready = start !== null && (!end || end > start) && carOk

  async function submit() {
    if (!start) return
    setBusy(true)
    setError(null)
    try {
      await orderApi.post('/bookings', {
        booking_type: type,
        vehicle_class: vehicle,
        start_at: start.toISOString(),
        end_at: end ? end.toISOString() : null,
        car_number: car.trim() ? cleanCarNumber(car) : null,
        pickup_address: address.trim() || null,
        pickup_area: coords?.area ?? null,
        pickup_pincode: coords?.pincode ?? null,
        pickup_lat: coords?.lat ?? null,
        pickup_lng: coords?.lng ?? null,
        notes: notes.trim() || null,
      })
      onDone()
    } catch (err) {
      setError(errorText(err, t))
    } finally {
      setBusy(false)
    }
  }

  const when = (label: string, value: Date | null, set: (d: Date | null) => void, which: 'start' | 'end', optional: boolean) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button
            label={value ? formatWhen(value.toISOString()) : t.pickDate}
            variant="secondary"
            onPress={() => {
              if (!pickDateTime(value ?? (which === 'end' && start ? new Date(start.getTime() + 8 * 3600_000) : nextHour()), set)) setIosPicker(which)
            }}
          />
        </View>
        {optional && value && <Button label={t.clear} variant="ghost" onPress={() => set(null)} />}
      </View>
      {iosPicker === which && (
        <DateTimePicker
          value={value ?? nextHour()}
          mode="datetime"
          minimumDate={new Date()}
          onChange={(_, d) => {
            if (d) set(d)
          }}
        />
      )}
    </View>
  )

  return (
    <Screen title={t.newBooking} onBack={onBack}>
      <Chips label={t.bookingType} options={['on_demand', 'job']} selected={[type]} onToggle={(v) => setType(v as typeof type)} render={(v) => t.bookingTypeLabels[v]} />
      <Chips
        label={t.vehicle}
        options={['four_wheeler', 'heavy', 'two_wheeler']}
        selected={[vehicle]}
        onToggle={(v) => setVehicle(v as typeof vehicle)}
        render={(v) => t.vehicleLabels[v]}
      />
      {when(t.startAt, start, setStart, 'start', false)}
      {when(t.endAt, end, setEnd, 'end', true)}
      <Field label={t.pickupAddress} value={address} onChangeText={setAddress} />
      <Button label={locating ? t.locating : t.useMyLocation} variant="secondary" onPress={locate} busy={locating} />
      {coords && (
        <Text style={{ color: colors.ok, fontWeight: '700' }}>
          ✓ {[coords.area, coords.pincode].filter(Boolean).join(' · ') || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
        </Text>
      )}
      <Field label={t.notes} value={notes} onChangeText={setNotes} multiline style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }} />
      <Field
        label={t.carNumber}
        value={car}
        onChangeText={(v) => setCar(v.toUpperCase())}
        autoCapitalize="characters"
        placeholder="TN37AB1234"
        maxLength={16}
      />
      <ErrorText>{error}</ErrorText>
      <Button label={t.submitBooking} onPress={submit} busy={busy} disabled={!ready} />
    </Screen>
  )
}
