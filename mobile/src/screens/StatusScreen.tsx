import { Text, View } from 'react-native'
import type { Profile } from '../api'
import { useT } from '../i18n'
import { Button, Card, colors, Screen, styles } from '../ui'

export default function StatusScreen({
  profile,
  onRefresh,
  onLogout,
}: {
  profile: Profile
  onRefresh: () => void
  onLogout: () => void
}) {
  const { t } = useT()
  const approved = profile.status === 'approved'
  const suspended = profile.status === 'suspended'
  const title = approved ? t.approvedTitle : suspended ? t.suspendedTitle : t.submittedTitle
  const body = approved ? t.approvedBody : suspended ? profile.rejection_reason ?? '' : t.submittedBody

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginTop: 48, marginBottom: 24, gap: 16 }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: approved ? colors.ok : suspended ? colors.danger : colors.mustard,
          }}
        >
          <Text style={{ fontSize: 44, fontWeight: '900', color: approved || suspended ? '#fff' : colors.green }}>
            {approved ? '✓' : suspended ? '!' : '…'}
          </Text>
        </View>
        <Text style={{ fontSize: 26, fontWeight: '900', color: colors.green, textAlign: 'center' }}>{title}</Text>
        {profile.full_name && <Text style={[styles.body16, { fontWeight: '700' }]}>{profile.full_name}</Text>}
      </View>
      <Card>
        <Text style={styles.body16}>{body}</Text>
        <Text style={styles.muted}>{t.contact}</Text>
      </Card>
      {!approved && <Button label={t.refresh} variant="secondary" onPress={onRefresh} />}
      <Button label={t.logout} variant="ghost" onPress={onLogout} />
    </Screen>
  )
}
