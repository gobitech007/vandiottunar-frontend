import { useState } from 'react'
import { api, CAR_RE, cleanCarNumber, pincodePlaceholder, type CustomerProfile } from '../api'
import CityPicker from '../CityPicker'
import { errorText, useT } from '../i18n'
import { Button, Chips, ErrorText, Field, Screen } from '../ui'
import PolicyBox from './PolicyBox'

export default function CustomerProfileScreen({
  profile,
  role,
  onDone,
  onBack,
}: {
  profile: CustomerProfile
  role: string
  onDone: () => void
  onBack?: () => void
}) {
  const { t } = useT()
  const business = role === 'employer'
  const [name, setName] = useState(profile.full_name ?? '')
  const [company, setCompany] = useState(profile.company_name ?? '')
  const [car, setCar] = useState(profile.car_number ?? '')
  const [email, setEmail] = useState(profile.email ?? '')
  const [city, setCity] = useState(profile.city ?? '')
  const [pincode, setPincode] = useState(profile.home_pincode ?? '')
  const [area, setArea] = useState(profile.home_area ?? '')
  const [needs, setNeeds] = useState<string[]>(profile.needs.length ? profile.needs : [business ? 'job' : 'on_demand'])
  const [agreed, setAgreed] = useState(profile.policy_accepted)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const carOk = car.trim() ? CAR_RE.test(cleanCarNumber(car)) : business
  const ok = name.trim().length >= 2 && Boolean(city) && /^[1-9]\d{5}$/.test(pincode) && needs.length > 0 && carOk && (!business || company.trim()) && agreed

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        full_name: name.trim(),
        city,
        home_pincode: pincode,
        home_area: area.trim() || null,
        needs,
        email: email.trim() || null,
      }
      if (business) body.company_name = company.trim()
      if (car.trim()) body.car_number = cleanCarNumber(car)
      if (!profile.policy_accepted) body.accept_policy_version = profile.current_policy_version
      await api.put('/customers/me', body)
      onDone()
    } catch (err) {
      setError(errorText(err, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title={t.yourDetails} onBack={onBack}>
      <Field label={t.yourName} value={name} onChangeText={setName} autoComplete="name" />
      {business && <Field label={t.companyName} value={company} onChangeText={setCompany} />}
      <Field
        label={business ? t.carNumberOptional : t.carNumber}
        value={car}
        onChangeText={(v) => setCar(v.toUpperCase())}
        placeholder="TN37AB1234"
        autoCapitalize="characters"
        maxLength={16}
      />
      <Field label={t.email} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <CityPicker value={city} onChange={setCity} />
      <Field
        label={t.yourPincode}
        value={pincode}
        onChangeText={(v) => setPincode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        placeholder={pincodePlaceholder(city)}
      />
      <Field label={t.area} value={area} onChangeText={setArea} />
      <Chips
        label={t.needs}
        options={['on_demand', 'job']}
        selected={needs}
        onToggle={(v) => setNeeds((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))}
        render={(v) => t.needLabels[v]}
      />
      <PolicyBox accepted={agreed} onChange={setAgreed} updated={!profile.policy_accepted && Boolean(profile.policy_accepted_at)} />
      <ErrorText>{error}</ErrorText>
      <Button label={t.save} onPress={save} busy={busy} disabled={!ok} />
    </Screen>
  )
}
