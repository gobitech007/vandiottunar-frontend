// City picker shown before the pincode (customers and drivers). The list comes from the user-service
// (ENABLED_CITIES), so more Tamil Nadu districts can be switched on later without a new release.
import { useEffect, useState } from 'react'
import { API_URL, DEFAULT_CITIES, type City } from '../api'
import { useT } from '../i18n'

// Typical first pincode for each city, used as the pincode placeholder
const SAMPLE_PIN: Record<string, string> = { chennai: '600001', coimbatore: '641001', tiruchirappalli: '620001' }
export const pincodePlaceholder = (city: string) => SAMPLE_PIN[city] ?? '641001'

export function useCities(): City[] {
  const [cities, setCities] = useState<City[]>(DEFAULT_CITIES)
  useEffect(() => {
    fetch(`${API_URL}/cities`)
      .then((r) => (r.ok ? r.json() : null))
      .then((list: City[] | null) => list && list.length > 0 && setCities(list))
      .catch(() => undefined)
  }, [])
  return cities
}

export default function CitySelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const { t, lang } = useT()
  const cities = useCities()
  return (
    <>
      <label htmlFor={id}>{t.city}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="" disabled>
          {t.chooseCity}
        </option>
        {cities.map((c) => (
          <option key={c.slug} value={c.slug}>
            {lang === 'ta' ? c.name_ta : c.name_en}
          </option>
        ))}
      </select>
      <p className="hint">{t.cityHint}</p>
    </>
  )
}
