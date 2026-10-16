// Customer side of the app: details, bookings (pay ₹1, WhatsApp chat, trip codes, live map), new booking.
import { useCallback, useEffect, useState } from 'react'
import { BackHandler, Linking, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api, ApiError, orderApi, type Booking, type CustomerProfile } from '../api'
import { errorText, useT } from '../i18n'
import { Button, Card, colors, ErrorText, styles } from '../ui'
import BookingCard from './BookingCard'
import CustomerProfileScreen from './CustomerProfileScreen'
import NewBookingScreen from './NewBookingScreen'

export default function CustomerApp({ role, onLogout }: { role: string; onLogout: () => void }) {
  const { t, lang, setLang } = useT()
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [screen, setScreen] = useState<'home' | 'profile' | 'new'>('home')
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const p = await api.get<CustomerProfile>('/customers/me')
      setProfile(p)
      if (p.profile_complete) setBookings(await orderApi.get<Booking[]>('/bookings'))
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) onLogout()
      else setError(errorText(err, t))
    }
  }, [onLogout, t])

  useEffect(() => {
    void load()
  }, [load])

  // Coming back from the payment page through the deep link (e.g. the app was closed meanwhile)
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url || !url.startsWith('vandiottunar://payment')) return
      const ok = /[?&]payment=paid\b/.test(url)
      setNotice({ text: ok ? t.paymentDone : t.paymentFailed, ok })
      void load()
    }
    void Linking.getInitialURL().then(handle)
    const sub = Linking.addEventListener('url', (e) => handle(e.url))
    return () => sub.remove()
  }, [load, t])

  const active = (bookings ?? []).some((b) => ['pending', 'assigned', 'in_progress'].includes(b.status))
  useEffect(() => {
    if (!active || screen !== 'home') return
    const id = setInterval(() => void load(), 20_000)
    return () => clearInterval(id)
  }, [active, screen, load])

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen !== 'home') {
        setScreen('home')
        return true
      }
      return false
    })
    return () => sub.remove()
  }, [screen])

  if (!profile) {
    return (
      <SafeAreaView style={[styles.safe, { padding: 24, justifyContent: 'center', gap: 12 }]}>
        <ErrorText>{error}</ErrorText>
        {error && <Button label={t.refresh} variant="secondary" onPress={load} />}
      </SafeAreaView>
    )
  }
  if (!profile.profile_complete || screen === 'profile') {
    return (
      <CustomerProfileScreen
        profile={profile}
        role={role}
        onBack={profile.profile_complete ? () => setScreen('home') : undefined}
        onDone={async () => {
          setScreen('home')
          await load()
        }}
      />
    )
  }
  if (screen === 'new') {
    return (
      <NewBookingScreen
        profile={profile}
        onBack={() => setScreen('home')}
        onDone={async () => {
          setScreen('home')
          setNotice({ text: t.bookingCreated, ok: true })
          await load()
        }}
      />
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true)
              await load()
              setRefreshing(false)
            }}
          />
        }
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 26, fontWeight: '900', color: colors.green }}>{t.customerTitle}</Text>
          <Button label={lang === 'ta' ? 'English' : 'தமிழ்'} variant="ghost" onPress={() => setLang(lang === 'ta' ? 'en' : 'ta')} />
        </View>
        <Text style={styles.muted}>
          {t.hello(profile.full_name ?? '')}
          {profile.company_name ? ` · ${profile.company_name}` : ''}
          {profile.car_number ? ` · ${profile.car_number}` : ''}
        </Text>
        {notice && (
          <Card>
            <Text style={{ fontWeight: '800', color: notice.ok ? colors.ok : colors.danger }}>
              {notice.ok ? '✓ ' : ''}
              {notice.text}
            </Text>
          </Card>
        )}
        <ErrorText>{error}</ErrorText>
        <Button label={`+ ${t.bookDriver}`} onPress={() => setScreen('new')} />
        {bookings && bookings.length === 0 && (
          <Card>
            <Text style={styles.body16}>{t.noBookings}</Text>
          </Card>
        )}
        {(bookings ?? []).map((b) => (
          <BookingCard key={b.id} b={b} onChanged={load} onNotice={(text, ok) => setNotice({ text, ok })} />
        ))}
        <Button label={t.editDetails} variant="secondary" onPress={() => setScreen('profile')} />
        <Button label={t.logout} variant="ghost" onPress={onLogout} />
      </ScrollView>
    </SafeAreaView>
  )
}
