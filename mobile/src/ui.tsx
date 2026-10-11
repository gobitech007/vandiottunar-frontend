import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export const colors = {
  green: '#0E3B2E',
  green2: '#1B5443',
  mustard: '#F2B705',
  cream: '#F7F1E3',
  paper: '#FFFDF8',
  ink: '#1D2420',
  muted: '#5B6660',
  line: '#E2DCCB',
  danger: '#A3361A',
  ok: '#1F7A4D',
}

export function Screen({ children, title, onBack }: { children: ReactNode; title?: string; onBack?: () => void }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {(title || onBack) && (
        <View style={styles.header}>
          {onBack && (
            <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={styles.back}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
          )}
          {title && <Text style={styles.title}>{title}</Text>}
        </View>
      )}
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  busy,
  disabled,
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  busy?: boolean
  disabled?: boolean
}) {
  const off = disabled || busy
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'secondary' && styles.btnSecondary,
        variant === 'ghost' && styles.btnGhost,
        off && styles.btnOff,
        pressed && !off && { opacity: 0.85 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'primary' ? colors.cream : colors.green} />
      ) : (
        <Text style={[styles.btnText, variant === 'primary' && { color: colors.cream }]}>{label}</Text>
      )}
    </Pressable>
  )
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={styles.input} {...props} />
    </View>
  )
}

export function Chips({
  label,
  options,
  selected,
  onToggle,
  render,
}: {
  label: string
  options: readonly string[]
  selected: string[]
  onToggle: (value: string) => void
  render: (value: string) => string
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {options.map((o) => {
          const on = selected.includes(o)
          return (
            <Pressable
              key={o}
              onPress={() => onToggle(o)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && { color: colors.cream }]}>{render(o)}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <Text style={styles.error} accessibilityRole="alert">
      {children}
    </Text>
  )
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 34, color: colors.green, lineHeight: 38 },
  title: { fontSize: 22, fontWeight: '800', color: colors.green, flexShrink: 1 },
  body: { padding: 16, paddingBottom: 48, gap: 12 },
  btn: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnPrimary: { backgroundColor: colors.green },
  btnSecondary: { backgroundColor: colors.paper, borderWidth: 1.5, borderColor: colors.green },
  btnGhost: { backgroundColor: 'transparent' },
  btnOff: { opacity: 0.45 },
  btnText: { fontSize: 17, fontWeight: '700', color: colors.green },
  field: { gap: 6 },
  label: { fontSize: 15, fontWeight: '700', color: colors.ink },
  input: {
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    fontSize: 17,
    color: colors.ink,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  chipOn: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  error: { color: colors.danger, fontWeight: '700', fontSize: 15 },
  card: { backgroundColor: colors.paper, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 10 },
  muted: { color: colors.muted, fontSize: 15 },
  body16: { fontSize: 16, color: colors.ink, lineHeight: 24 },
})
