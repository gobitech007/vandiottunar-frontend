import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'vo_driver_token'
const LANG_KEY = 'vo_lang'
const ROLE_KEY = 'vo_role'

export async function loadToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY)
  } catch {
    return null
  }
}

export async function saveToken(token: string | null): Promise<void> {
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token)
    else await SecureStore.deleteItemAsync(TOKEN_KEY)
  } catch {
    /* if secure storage fails the driver simply logs in again next time */
  }
}

export async function loadLang(): Promise<'ta' | 'en'> {
  try {
    return (await SecureStore.getItemAsync(LANG_KEY)) === 'en' ? 'en' : 'ta'
  } catch {
    return 'ta'
  }
}

export async function saveLang(lang: 'ta' | 'en'): Promise<void> {
  try {
    await SecureStore.setItemAsync(LANG_KEY, lang)
  } catch {
    /* ignore */
  }
}

/** driver | customer | employer: which side of the app to open */
export async function loadRole(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ROLE_KEY)
  } catch {
    return null
  }
}

export async function saveRole(role: string | null): Promise<void> {
  try {
    if (role) await SecureStore.setItemAsync(ROLE_KEY, role)
    else await SecureStore.deleteItemAsync(ROLE_KEY)
  } catch {
    /* ignore */
  }
}
