import * as ImagePicker from 'expo-image-picker'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Linking, Text, View } from 'react-native'
import {
  api,
  DEFAULT_CODE,
  LICENCE_GROUPS,
  type DocType,
  type DocumentInfo,
  type LicenceGroup,
  type ParsedLicence,
  type Profile,
} from '../api'
import { errorText, useT } from '../i18n'
import { Button, Card, Chips, colors, ErrorText, Field, Screen, styles } from '../ui'
import { compress } from './DocumentsScreen'

const SIDES: DocType[] = ['licence_front', 'licence_back']
const GROUPS: LicenceGroup[] = ['two_wheeler', 'four_wheeler', 'heavy']
const inGroup = (codes: string[], g: LicenceGroup) => codes.some((c) => (LICENCE_GROUPS[g] as readonly string[]).includes(c))

/**
 * Licence photos, then number and vehicle classes. When the server reads licences (OCR_PROVIDER=textract)
 * the fields fill in by themselves; otherwise the driver types them and an admin checks against the photos.
 */
export default function LicenceScreen({
  profile,
  serverOcr,
  onDone,
  onBack,
}: {
  profile: Profile
  serverOcr: boolean
  onDone: () => void
  onBack: () => void
}) {
  const { t } = useT()
  const [uploaded, setUploaded] = useState<Set<DocType>>(new Set())
  const [working, setWorking] = useState<DocType | null>(null)
  const [reading, setReading] = useState(false)
  const [readOk, setReadOk] = useState<boolean | null>(null)
  const [number, setNumber] = useState(profile.licence_number ?? '')
  const [codes, setCodes] = useState<string[]>(profile.licence_classes ?? [])
  const [validTill, setValidTill] = useState<string | null>(profile.licence_valid_till)
  const [source, setSource] = useState(profile.licence_source ?? 'manual')
  const [rawText, setRawText] = useState<string | null>(null)
  const [cameraDenied, setCameraDenied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const typedNumber = useRef(Boolean(profile.licence_number))

  useEffect(() => {
    api
      .get<DocumentInfo[]>('/drivers/me/documents')
      .then((docs) => setUploaded(new Set(docs.map((d) => d.doc_type).filter((d) => SIDES.includes(d)))))
      .catch((err) => setError(errorText(err, t)))
  }, [t])

  async function scan() {
    if (!serverOcr) return
    setReading(true)
    setReadOk(null)
    try {
      const r = await api.post<ParsedLicence>('/drivers/me/licence/scan')
      if (r.licence_number && !typedNumber.current) setNumber(r.licence_number)
      if (r.classes.length) setCodes((prev) => [...new Set([...prev, ...r.classes])])
      if (r.valid_till) setValidTill(r.valid_till)
      const found = Boolean(r.licence_number || r.classes.length)
      if (found) {
        setSource('ocr_server')
        setRawText(r.raw_text)
      }
      setReadOk(found)
    } catch {
      setReadOk(false)
    } finally {
      setReading(false)
    }
  }

  async function capture(side: DocType, from: 'camera' | 'gallery') {
    setError(null)
    setCameraDenied(false)
    try {
      let result: ImagePicker.ImagePickerResult
      if (from === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync()
        if (!perm.granted) {
          setCameraDenied(true)
          return
        }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 })
      }
      if (result.canceled || !result.assets?.[0]) return
      setWorking(side)
      const uri = await compress(result.assets[0].uri)
      await api.upload(`/drivers/me/documents/${side}`, { uri, name: `${side}.jpg`, type: 'image/jpeg' })
      const next = new Set(uploaded).add(side)
      setUploaded(next)
      setWorking(null)
      if (SIDES.every((s) => next.has(s))) await scan()
    } catch (err) {
      setError(errorText(err, t))
    } finally {
      setWorking(null)
    }
  }

  function toggle(g: string) {
    const group = g as LicenceGroup
    setCodes((prev) =>
      inGroup(prev, group)
        ? prev.filter((c) => !(LICENCE_GROUPS[group] as readonly string[]).includes(c))
        : [...prev, DEFAULT_CODE[group]],
    )
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await api.put('/drivers/me/licence', {
        licence_number: number.trim(),
        classes: codes,
        valid_till: validTill,
        source,
        raw_text: rawText,
      })
      onDone()
    } catch (err) {
      setError(errorText(err, t))
    } finally {
      setBusy(false)
    }
  }

  const bothUploaded = SIDES.every((s) => uploaded.has(s))
  const canSave = bothUploaded && number.replace(/[\s-]/g, '').length >= 8 && GROUPS.some((g) => inGroup(codes, g))

  return (
    <Screen title={t.stepLicence} onBack={onBack}>
      <Text style={styles.body16}>{t.licenceIntro}</Text>
      {cameraDenied && (
        <Card>
          <Text style={[styles.body16, { color: colors.danger, fontWeight: '700' }]}>{t.cameraDenied}</Text>
          <Button label={t.openSettings} variant="secondary" onPress={() => Linking.openSettings()} />
        </Card>
      )}
      {SIDES.map((side) => {
        const done = uploaded.has(side)
        return (
          <Card key={side}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink }}>{t.labels[side]}</Text>
              <Text style={{ fontWeight: '700', color: done ? colors.ok : colors.muted }}>
                {working === side ? t.uploading : done ? `✓ ${t.uploaded}` : t.required}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label={done ? t.replace : t.takePhoto}
                  variant={done ? 'secondary' : 'primary'}
                  onPress={() => capture(side, 'camera')}
                  busy={working === side}
                  disabled={(working !== null && working !== side) || reading}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={t.gallery}
                  variant="secondary"
                  onPress={() => capture(side, 'gallery')}
                  disabled={working !== null || reading}
                />
              </View>
            </View>
          </Card>
        )
      })}

      {reading && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={colors.green} />
          <Text style={[styles.body16, { fontWeight: '700' }]}>{t.reading}</Text>
        </View>
      )}
      {readOk === true && <Text style={[styles.body16, { color: colors.ok, fontWeight: '700' }]}>{t.readDone}</Text>}
      {readOk === false && <Text style={[styles.body16, { color: colors.danger }]}>{t.readFailed}</Text>}

      <Field
        label={t.licenceNumber}
        value={number}
        onChangeText={(v) => {
          typedNumber.current = true
          setNumber(v.toUpperCase())
        }}
        autoCapitalize="characters"
        placeholder="TN38 20200001234"
        maxLength={20}
      />
      <Chips
        label={t.licenceClasses}
        options={GROUPS}
        selected={GROUPS.filter((g) => inGroup(codes, g))}
        onToggle={toggle}
        render={(g) => t.groupLabels[g]}
      />
      {codes.length > 0 && <Text style={styles.muted}>{t.readFrom(codes.join(', '))}</Text>}
      <ErrorText>{error}</ErrorText>
      <Button label={t.save} onPress={save} busy={busy} disabled={!canSave || reading} />
    </Screen>
  )
}
