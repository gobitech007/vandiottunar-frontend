import { useState } from 'react'
import { api, type Profile } from '../api'
import { errorText, useT } from '../i18n'
import { Button, Chips, ErrorText, Field, Screen } from '../ui'

const VEHICLES = ['car_manual', 'car_automatic', 'suv', 'van', 'light_commercial', 'heavy_vehicle'] as const
const AVAILABILITY = ['full_time', 'part_time', 'weekends'] as const
const WORK = ['on_demand', 'job'] as const

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

export default function ProfileScreen({
  profile,
  onDone,
  onBack,
}: {
  profile: Profile
  onDone: () => void
  onBack: () => void
}) {
  const { t, lang } = useT()
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [licence, setLicence] = useState(profile.licence_number ?? '')
  const [experience, setExperience] = useState(profile.experience_years?.toString() ?? '')
  const [vehicles, setVehicles] = useState<string[]>(profile.vehicle_types)
  const [availability, setAvailability] = useState<string[]>(profile.availability ? [profile.availability] : [])
  const [work, setWork] = useState<string[]>(profile.work_preferences)
  const [pay, setPay] = useState(profile.expected_pay_note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const complete =
    fullName.trim().length >= 2 &&
    licence.trim().length >= 8 &&
    experience !== '' &&
    vehicles.length > 0 &&
    availability.length > 0 &&
    work.length > 0

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await api.put('/drivers/me/profile', {
        full_name: fullName.trim(),
        preferred_language: lang,
        licence_number: licence.trim(),
        experience_years: Number(experience),
        vehicle_types: vehicles,
        availability: availability[0],
        work_preferences: work,
        expected_pay_note: pay.trim() || null,
      })
      onDone()
    } catch (err) {
      setError(errorText(err, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title={t.stepProfile} onBack={onBack}>
      <Field label={t.fullName} value={fullName} onChangeText={setFullName} autoComplete="name" maxLength={120} />
      <Field
        label={t.licenceNumber}
        value={licence}
        onChangeText={(v) => setLicence(v.toUpperCase())}
        autoCapitalize="characters"
        placeholder="TN38 20200001234"
        maxLength={20}
      />
      <Field
        label={t.experience}
        value={experience}
        onChangeText={(v) => setExperience(v.replace(/\D/g, '').slice(0, 2))}
        keyboardType="number-pad"
      />
      <Chips
        label={t.vehicles}
        options={VEHICLES}
        selected={vehicles}
        onToggle={(v) => setVehicles((l) => toggle(l, v))}
        render={(v) => t.labels[v]}
      />
      <Chips
        label={t.availability}
        options={AVAILABILITY}
        selected={availability}
        onToggle={(v) => setAvailability([v])}
        render={(v) => t.labels[v]}
      />
      <Chips
        label={t.workPrefs}
        options={WORK}
        selected={work}
        onToggle={(v) => setWork((l) => toggle(l, v))}
        render={(v) => t.labels[v]}
      />
      <Field label={t.expectedPay} value={pay} onChangeText={setPay} maxLength={120} placeholder="₹" />
      <ErrorText>{error}</ErrorText>
      <Button label={t.save} onPress={save} busy={busy} disabled={!complete} />
    </Screen>
  )
}
