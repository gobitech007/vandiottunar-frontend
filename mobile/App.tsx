import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, BackHandler, Text, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { api, ApiError, setAuthToken, type Checklist, type Profile } from './src/api'
import { errorText, LangContext, strings, type Lang } from './src/i18n'
import ConsentScreen from './src/screens/ConsentScreen'
import DocumentsScreen from './src/screens/DocumentsScreen'
import HubScreen, { type Step } from './src/screens/HubScreen'
import LocationScreen from './src/screens/LocationScreen'
import LoginScreen from './src/screens/LoginScreen'
import ProfileScreen from './src/screens/ProfileScreen'
import StatusScreen from './src/screens/StatusScreen'
import { loadLang, loadToken, saveLang, saveToken } from './src/session'
import { Button, colors } from './src/ui'

export default function App() {
  const [lang, setLangState] = useState<Lang>('ta')
  const [booting, setBooting] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [step, setStep] = useState<Step | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const t = strings[lang]
  const langValue = useMemo(
    () => ({
      lang,
      t,
      setLang: (l: Lang) => {
        setLangState(l)
        void saveLang(l)
      },
    }),
    [lang, t],
  )

  const logout = useCallback(() => {
    setAuthToken(null)
    void saveToken(null)
    setToken(null)
    setProfile(null)
    setChecklist(null)
    setStep(null)
  }, [])

  const refresh = useCallback(async () => {
    setLoadError(null)
    try {
      const [p, c] = await Promise.all([api.get<Profile>('/drivers/me'), api.get<Checklist>('/drivers/me/checklist')])
      setProfile(p)
      setChecklist(c)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) logout()
      else setLoadError(errorText(err, strings[lang]))
    }
  }, [lang, logout])

  // Restore session and language on launch
  useEffect(() => {
    void (async () => {
      const [savedToken, savedLang] = await Promise.all([loadToken(), loadLang()])
      setLangState(savedLang)
      if (savedToken) {
        setAuthToken(savedToken)
        setToken(savedToken)
      }
      setBooting(false)
    })()
  }, [])

  useEffect(() => {
    if (token) void refresh()
  }, [token, refresh])

  // Android back button closes an open step instead of exiting the app
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step) {
        setStep(null)
        return true
      }
      return false
    })
    return () => sub.remove()
  }, [step])

  const finishStep = useCallback(async () => {
    setStep(null)
    await refresh()
  }, [refresh])

  let content: React.ReactNode
  if (booting) {
    content = <Centered />
  } else if (!token) {
    content = (
      <LoginScreen
        onLoggedIn={(tok) => {
          setAuthToken(tok)
          void saveToken(tok)
          setToken(tok)
        }}
      />
    )
  } else if (!profile || !checklist) {
    content = (
      <Centered>
        {loadError && (
          <>
            <Text style={{ color: colors.danger, fontWeight: '700', textAlign: 'center' }}>{loadError}</Text>
            <Button label={t.refresh} onPress={refresh} variant="secondary" />
          </>
        )}
      </Centered>
    )
  } else if (!['draft', 'rejected'].includes(profile.status)) {
    content = <StatusScreen profile={profile} onRefresh={refresh} onLogout={logout} />
  } else if (step === 'consent') {
    content = <ConsentScreen version={checklist.current_consent_version} onDone={finishStep} onBack={() => setStep(null)} />
  } else if (step === 'profile') {
    content = <ProfileScreen profile={profile} onDone={finishStep} onBack={() => setStep(null)} />
  } else if (step === 'location') {
    content = <LocationScreen profile={profile} onDone={finishStep} onBack={() => setStep(null)} />
  } else if (step === 'documents') {
    content = <DocumentsScreen onDone={finishStep} onBack={() => setStep(null)} />
  } else {
    content = (
      <HubScreen profile={profile} checklist={checklist} onOpen={setStep} onSubmitted={refresh} onLogout={logout} />
    )
  }

  return (
    <SafeAreaProvider>
      <LangContext.Provider value={langValue}>
        <StatusBar style="dark" />
        {content}
      </LangContext.Provider>
    </SafeAreaProvider>
  )
}

function Centered({ children }: { children?: React.ReactNode }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: colors.cream }}>
      {children ?? <ActivityIndicator size="large" color={colors.green} />}
    </View>
  )
}
