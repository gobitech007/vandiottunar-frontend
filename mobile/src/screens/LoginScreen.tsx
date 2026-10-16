import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { api } from '../api'
import { errorText, useT } from '../i18n'
import { Button, Chips, colors, ErrorText, Field, Screen, styles } from '../ui'

interface OtpOut {
  resend_after_seconds: number
  dev_code: string | null
}

const ROLES = ['driver', 'customer', 'employer'] as const

export default function LoginScreen({ onLoggedIn }: { onLoggedIn: (token: string, role: string) => void }) {
  const { t, lang, setLang } = useT()
  const [role, setRole] = useState<(typeof ROLES)[number]>('driver')
  const [note, setNote] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [wait, setWait] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (wait <= 0) return
    const id = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(id)
  }, [wait])

  async function sendCode() {
    setBusy(true)
    setError(null)
    try {
      const res = await api.post<OtpOut>('/auth/otp/request', { phone })
      setDevCode(res.dev_code)
      setWait(res.resend_after_seconds)
      setStep('code')
    } catch (err) {
      setError(errorText(err, t))
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    setBusy(true)
    setError(null)
    try {
      const res = await api.post<{ access_token: string; role: string }>('/auth/otp/verify', {
        phone,
        code,
        role, // used for new numbers; an existing number keeps the role it registered with
      })
      if (res.role !== role) {
        setNote(t.roleNote(t.roleLabels[res.role] ?? res.role))
        await new Promise((r) => setTimeout(r, 1500))
      }
      onLoggedIn(res.access_token, res.role)
    } catch (err) {
      setError(errorText(err, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        {(['ta', 'en'] as const).map((l) => (
          <Pressable
            key={l}
            onPress={() => setLang(l)}
            accessibilityRole="button"
            accessibilityState={{ selected: lang === l }}
            style={{
              minHeight: 44,
              paddingHorizontal: 14,
              justifyContent: 'center',
              borderRadius: 999,
              backgroundColor: lang === l ? colors.green : 'transparent',
            }}
          >
            <Text style={{ fontWeight: '700', color: lang === l ? colors.cream : colors.green }}>
              {l === 'ta' ? 'தமிழ்' : 'English'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ marginTop: 24, marginBottom: 16, gap: 6 }}>
        <Text style={{ fontSize: 34, fontWeight: '900', color: colors.green }}>{t.appName}</Text>
        <Text style={[styles.body16, { fontSize: 18 }]}>{t.tagline}</Text>
      </View>

      {step === 'phone' ? (
        <>
          <Chips
            label={t.iAm}
            options={ROLES}
            selected={[role]}
            onToggle={(v) => setRole(v as (typeof ROLES)[number])}
            render={(v) => t.roleLabels[v]}
          />
          <Field
            label={t.phoneLabel}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="98765 43210"
            maxLength={15}
          />
          <ErrorText>{error}</ErrorText>
          <Button label={t.sendCode} onPress={sendCode} busy={busy} disabled={phone.replace(/\D/g, '').length < 10} />
        </>
      ) : (
        <>
          <Field
            label={t.codeLabel(phone)}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            maxLength={6}
            autoFocus
          />
          {devCode && <Text style={styles.muted}>{`${t.devCode}: ${devCode}`}</Text>}
          {note && <Text style={{ color: colors.green, fontWeight: '700' }}>{note}</Text>}
          <ErrorText>{error}</ErrorText>
          <Button label={t.verify} onPress={verify} busy={busy} disabled={code.length < 6} />
          <Button
            label={wait > 0 ? t.resendIn(wait) : t.resend}
            onPress={sendCode}
            variant="secondary"
            disabled={wait > 0 || busy}
          />
          <Button
            label={t.changeNumber}
            variant="ghost"
            onPress={() => {
              setStep('phone')
              setCode('')
              setError(null)
            }}
          />
        </>
      )}
    </Screen>
  )
}
