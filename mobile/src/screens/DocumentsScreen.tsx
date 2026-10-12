import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { useEffect, useState } from 'react'
import { Linking, Text, View } from 'react-native'
import { api, type DocType, type DocumentInfo } from '../api'
import { errorText, useT } from '../i18n'
import { Button, Card, colors, ErrorText, Screen, styles } from '../ui'

// Licence photos are taken on the licence screen
const DOCS: { type: DocType; required: boolean; front?: boolean }[] = [
  { type: 'id_proof', required: true },
  { type: 'selfie', required: true, front: true },
  { type: 'address_proof', required: false },
]

// Shrink photos before upload: faster on mobile data and well under the 5 MB limit
export async function compress(uri: string): Promise<string> {
  const image = await ImageManipulator.manipulate(uri).resize({ width: 1600 }).renderAsync()
  const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG })
  return saved.uri
}

export default function DocumentsScreen({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { t } = useT()
  const [uploaded, setUploaded] = useState<Set<DocType>>(new Set())
  const [working, setWorking] = useState<DocType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cameraDenied, setCameraDenied] = useState(false)

  useEffect(() => {
    api
      .get<DocumentInfo[]>('/drivers/me/documents')
      .then((docs) => setUploaded(new Set(docs.map((d) => d.doc_type))))
      .catch((err) => setError(errorText(err, t)))
  }, [t])

  async function capture(type: DocType, source: 'camera' | 'gallery', front?: boolean) {
    setError(null)
    setCameraDenied(false)
    try {
      let result: ImagePicker.ImagePickerResult
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync()
        if (!perm.granted) {
          setCameraDenied(true)
          return
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.9,
          cameraType: front ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
        })
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 })
      }
      if (result.canceled || !result.assets?.[0]) return

      setWorking(type)
      const uri = await compress(result.assets[0].uri)
      await api.upload(`/drivers/me/documents/${type}`, { uri, name: `${type}.jpg`, type: 'image/jpeg' })
      setUploaded((prev) => new Set(prev).add(type))
    } catch (err) {
      setError(errorText(err, t))
    } finally {
      setWorking(null)
    }
  }

  const allRequired = DOCS.filter((d) => d.required).every((d) => uploaded.has(d.type))

  return (
    <Screen title={t.stepDocuments} onBack={onBack}>
      <Text style={styles.body16}>{t.docTip}</Text>
      {cameraDenied && (
        <Card>
          <Text style={[styles.body16, { color: colors.danger, fontWeight: '700' }]}>{t.cameraDenied}</Text>
          <Button label={t.openSettings} variant="secondary" onPress={() => Linking.openSettings()} />
        </Card>
      )}
      {DOCS.map((d) => {
        const done = uploaded.has(d.type)
        const busy = working === d.type
        return (
          <Card key={d.type}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink, flexShrink: 1 }}>{t.labels[d.type]}</Text>
              <Text style={{ fontWeight: '700', color: done ? colors.ok : colors.muted }}>
                {busy ? t.uploading : done ? `✓ ${t.uploaded}` : d.required ? t.required : t.optional}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label={done ? t.replace : t.takePhoto}
                  variant={done ? 'secondary' : 'primary'}
                  onPress={() => capture(d.type, 'camera', d.front)}
                  busy={busy}
                  disabled={working !== null && !busy}
                />
              </View>
              {d.type !== 'selfie' && (
                <View style={{ flex: 1 }}>
                  <Button
                    label={t.gallery}
                    variant="secondary"
                    onPress={() => capture(d.type, 'gallery')}
                    disabled={working !== null}
                  />
                </View>
              )}
            </View>
          </Card>
        )
      })}
      <ErrorText>{error}</ErrorText>
      <Button label={t.continue} onPress={onDone} disabled={!allRequired || working !== null} />
    </Screen>
  )
}
