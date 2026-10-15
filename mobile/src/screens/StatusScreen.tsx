import { useCallback, useEffect, useState } from 'react'
import { Linking, Text, View } from 'react-native'
import { formatWhen, orderApi, type Assignment, type Profile } from '../api'
import { errorText, useT } from '../i18n'
import { Button, Card, colors, ErrorText, Screen, styles } from '../ui'
import TripPanel from './TripPanel'

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
  const [jobs, setJobs] = useState<Assignment[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadJobs = useCallback(async () => {
    if (!approved) return
    setError(null)
    try {
      setJobs(await orderApi.get<Assignment[]>('/driver/bookings'))
    } catch (err) {
      setError(errorText(err, t))
    }
  }, [approved, t])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  // A running trip first, then the rest soonest first
  const upcoming = (jobs ?? [])
    .filter((j) => j.status === 'assigned' || j.status === 'in_progress')
    .reverse()
    .sort((a, b) => Number(b.status === 'in_progress') - Number(a.status === 'in_progress'))

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginTop: approved ? 16 : 48, marginBottom: 16, gap: 12 }}>
        <View
          style={{
            width: approved ? 64 : 96,
            height: approved ? 64 : 96,
            borderRadius: 48,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: approved ? colors.ok : suspended ? colors.danger : colors.mustard,
          }}
        >
          <Text style={{ fontSize: approved ? 30 : 44, fontWeight: '900', color: approved || suspended ? '#fff' : colors.green }}>
            {approved ? '✓' : suspended ? '!' : '…'}
          </Text>
        </View>
        <Text style={{ fontSize: 24, fontWeight: '900', color: colors.green, textAlign: 'center' }}>{title}</Text>
        {profile.full_name && <Text style={[styles.body16, { fontWeight: '700' }]}>{profile.full_name}</Text>}
      </View>

      {approved ? (
        <>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.green }}>{t.myJobs}</Text>
          <ErrorText>{error}</ErrorText>
          {jobs && upcoming.length === 0 && (
            <Card>
              <Text style={styles.body16}>{t.noAssignments}</Text>
            </Card>
          )}
          {upcoming.map((j) => (
            <Card key={j.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '800', color: j.status === 'in_progress' ? colors.ok : colors.green }}>
                  {j.status === 'in_progress' ? `● ${t.onTrip}` : t.tripLabels[j.booking_type]}
                </Text>
                <Text style={styles.muted}>{j.reference}</Text>
              </View>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink }}>{formatWhen(j.start_at)}</Text>
              <Text style={styles.muted}>→ {j.end_at ? formatWhen(j.end_at) : t.noEnd}</Text>
              <Text style={[styles.body16, { fontWeight: '700' }]}>
                {j.customer_name ?? '—'}
                {j.company_name ? ` · ${j.company_name}` : ''}
              </Text>
              <Text style={styles.body16}>{j.car_number ?? ''}</Text>
              <Text style={styles.body16}>
                {t.pickup}: {[j.pickup_address, j.pickup_area, j.pickup_pincode].filter(Boolean).join(', ')}
              </Text>
              {j.notes && <Text style={styles.muted}>“{j.notes}”</Text>}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button label={`${t.call} ${j.customer_phone}`} onPress={() => Linking.openURL(`tel:${j.customer_phone}`)} />
                </View>
                {j.pickup_lat != null && j.pickup_lng != null && (
                  <View style={{ flex: 1 }}>
                    <Button
                      label={t.openMap}
                      variant="secondary"
                      onPress={() => Linking.openURL(`https://www.google.com/maps?q=${j.pickup_lat},${j.pickup_lng}`)}
                    />
                  </View>
                )}
              </View>
              <TripPanel job={j} onChange={loadJobs} />
            </Card>
          ))}
          <Button label={t.refresh} variant="secondary" onPress={() => void loadJobs()} />
        </>
      ) : (
        <>
          <Card>
            <Text style={styles.body16}>{body}</Text>
            <Text style={styles.muted}>{t.contact}</Text>
          </Card>
          <Button label={t.refresh} variant="secondary" onPress={onRefresh} />
        </>
      )}
      <Button label={t.logout} variant="ghost" onPress={onLogout} />
    </Screen>
  )
}
