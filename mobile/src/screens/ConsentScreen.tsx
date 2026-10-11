import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { api } from '../api'
import { errorText, useT } from '../i18n'
import { Button, Card, colors, ErrorText, Screen, styles } from '../ui'

export default function ConsentScreen({
  version,
  onDone,
  onBack,
}: {
  version: string
  onDone: () => void
  onBack: () => void
}) {
  const { t } = useT()
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      await api.post('/drivers/me/consent', { version })
      onDone()
    } catch (err) {
      setError(errorText(err, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title={t.stepConsent} onBack={onBack}>
      <Card>
        <Text style={{ fontSize: 19, fontWeight: '800', color: colors.green }}>{t.consentTitle}</Text>
        {t.consentPoints.map((point, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
            <Text style={{ fontWeight: '800', color: colors.green, width: 20 }}>{i + 1}.</Text>
            <Text style={[styles.body16, { flex: 1 }]}>{point}</Text>
          </View>
        ))}
      </Card>

      <Pressable
        onPress={() => setAgreed((a) => !a)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: colors.green,
            backgroundColor: agreed ? colors.green : '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {agreed && <Text style={{ color: colors.cream, fontWeight: '900' }}>✓</Text>}
        </View>
        <Text style={[styles.body16, { flex: 1, fontWeight: '700' }]}>{t.agree}</Text>
      </Pressable>

      <ErrorText>{error}</ErrorText>
      <Button label={t.continue} onPress={accept} busy={busy} disabled={!agreed} />
    </Screen>
  )
}
