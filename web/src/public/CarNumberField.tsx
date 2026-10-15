import { useId, useState } from 'react'
import { useT } from '../i18n'
import { findCarNumber } from './idNumbers'
import { needsFirstDownload, readImageText } from './licenceOcr'

/**
 * Car number input with "take a photo of the number plate or RC". The photo is read in the browser
 * and never uploaded; the number found is put in the field and shown under it for the customer to check.
 */
export default function CarNumberField({
  id,
  label,
  value,
  onChange,
  invalid,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  invalid: boolean
}) {
  const { t } = useT()
  const fileId = useId()
  const [reading, setReading] = useState(false)
  const [firstLoad, setFirstLoad] = useState(false)
  const [result, setResult] = useState<{ found: string | null } | null>(null)

  async function read(file: File | undefined) {
    if (!file) return
    setReading(true)
    setResult(null)
    setFirstLoad(needsFirstDownload())
    try {
      // Documents (RC card, screenshot) read best in normal mode; a plate on a car in sparse mode
      let found = findCarNumber(await readImageText(file))
      if (!found) found = findCarNumber(await readImageText(file, { sparse: true }))
      if (found) onChange(found)
      setResult({ found })
    } catch {
      setResult({ found: null })
    } finally {
      setReading(false)
      setFirstLoad(false)
    }
  }

  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="input-with-action">
        <input
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value.toUpperCase())
            setResult(null)
          }}
          placeholder={t.carNumberPh}
          maxLength={16}
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={`${id}-read`}
        />
        <label htmlFor={fileId} className={`btn ${reading ? 'disabled' : ''}`} title={t.carFromPhoto}>
          <span aria-hidden="true">📷</span>
          <span className="sr-only">{t.carFromPhoto}</span>
        </label>
        <input
          id={fileId}
          className="sr-only"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={reading}
          onChange={(e) => {
            void read(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
      <p id={`${id}-read`} className="field-note" role="status">
        {reading ? (
          <>
            <span className="spinner" aria-hidden="true" /> {t.carReading}
            {firstLoad && <span className="muted"> {t.firstLoad}</span>}
          </>
        ) : result?.found ? (
          <span className="ok-text">{t.carRead(result.found)}</span>
        ) : result ? (
          <span className="warn-text">{t.carNotFound}</span>
        ) : (
          <span className="muted">
            📷 {t.carFromPhoto}. {t.carPhotoNote}
          </span>
        )}
      </p>
    </>
  )
}
