// City chips shown before the pincode (customers and drivers). The list comes from the user-service
// (ENABLED_CITIES), so more Tamil Nadu districts can be switched on later without a new app release.
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { API_URL, DEFAULT_CITIES, type City } from './api'
import { useT } from './i18n'
import { Chips, styles } from './ui'

export default function CityPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t, lang } = useT()
  const [cities, setCities] = useState<City[]>(DEFAULT_CITIES)
  useEffect(() => {
    fetch(`${API_URL}/cities`)
      .then((r) => (r.ok ? r.json() : null))
      .then((list: City[] | null) => list && list.length > 0 && setCities(list))
      .catch(() => undefined)
  }, [])
  const names = Object.fromEntries(cities.map((c) => [c.slug, lang === 'ta' ? c.name_ta : c.name_en]))
  return (
    <View style={{ gap: 4 }}>
      <Chips
        label={t.city}
        options={cities.map((c) => c.slug)}
        selected={value ? [value] : []}
        onToggle={onChange}
        render={(slug) => names[slug] ?? slug}
      />
      <Text style={[styles.muted, { fontSize: 13 }]}>{t.cityHint}</Text>
    </View>
  )
}
