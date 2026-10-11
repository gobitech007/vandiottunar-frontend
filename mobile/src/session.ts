import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'vo_driver_token'
const LANG_KEY = 'vo_lang'

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
