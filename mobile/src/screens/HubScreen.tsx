import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { api, type Checklist, type Profile } from '../api'
import { errorText, useT } from '../i18n'
import { Button, Card, colors, ErrorText, Screen, styles } from '../ui'

export type Step = 'consent' | 'profile' | 'licence' | 'location' | 'documents'

const LICENCE_SIDES = ['licence_front', 'licence_back']

export default function HubScreen({
  profile,
  checklist,
  onOpen,
  onSubmitted,
  onLogout,
}: {
  profile: Profile
  checklist: Checklist
  onOpen: (step: Step) => void
  onSubmitted: () => void
  onLogout: () => void
}) {
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const steps: { key: Step; title: string; done: boolean }[] = [
    { key: 'consent', title: t.stepConsent, done: checklist.consent_accepted },
    { key: 'profile', title: t.stepProfile, done: checklist.profile_complete },
    {
      key: 'licence',
      title: t.stepLicence,
      done: checklist.licence_complete && !checklist.missing_documents.some((d) => LICENCE_SIDES.includes(d)),
    },
    { key: 'location', title: t.stepLocation, done: checklist.location_captured },
    {
      key: 'documents',
      title: t.stepDocuments,
      done: !checklist.missing_documents.some((d) => !LICENCE_SIDES.includes(d)),
    },
  ]
  const next = steps.find((s) => !s.done)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await api.post('/drivers/me/submit')
      onSubmitted()
    } catch (err) {
      setError(errorText(err, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title={t.hubTitle}>
      {profile.status === 'rejected' && (
        <Card>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.danger }}>{t.rejectedTitle}</Text>
          {profile.rejection_reason && <Text style={styles.body16}>{profile.rejection_reason}</Text>}
        </Card>
      )}

      {steps.map((s, i) => (
        <Pressable
          key={s.key}
          onPress={() => onOpen(s.key)}
          accessibilityRole="button"
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              backgroundColor: colors.paper,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: s.done ? colors.ok : colors.line,
              padding: 16,
              minHeight: 68,
            },
            pressed && { opacity: 0.85 },
          ]}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: s.done ? colors.ok : colors.mustard,
            }}
          >
            <Text style={{ fontWeight: '900', color: s.done ? '#fff' : colors.green }}>{s.done ? '✓' : i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink }}>{s.title}</Text>
            <Text style={{ color: s.done ? colors.ok : colors.muted, fontWeight: '600' }}>{s.done ? t.done : t.todo}</Text>
          </View>
          <Text style={{ fontSize: 26, color: colors.green }}>›</Text>
        </Pressable>
      ))}

      <ErrorText>{error}</ErrorText>
      {next ? (
        <Button label={t.continue} onPress={() => onOpen(next.key)} />
      ) : (
        <Button label={t.submit} onPress={submit} busy={busy} disabled={!checklist.ready_to_submit} />
      )}
      <Button label={t.logout} variant="ghost" onPress={onLogout} />
    </Screen>
  )
}
