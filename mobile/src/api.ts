// Android emulator reaches your computer's localhost at 10.0.2.2.
// On a real phone set EXPO_PUBLIC_API_URL to your computer's LAN IP, e.g. http://192.168.1.20:8000
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000'

let authToken: string | null = null
export const setAuthToken = (token: string | null) => {
  authToken = token
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function messageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error, /, '')
    if (detail && typeof detail === 'object' && 'message' in detail) return String((detail as { message: unknown }).message)
  }
  return fallback
}

async function send<T>(path: string, init: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) }
  if (authToken) headers.Authorization = `Bearer ${authToken}`
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'network')
  }
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }
  if (!res.ok) throw new ApiError(res.status, messageFrom(body, `Request failed (${res.status})`))
  return body as T
}

export const api = {
  get: <T>(path: string) => send<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    send<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(path: string, body: unknown) =>
    send<T>(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  upload: <T>(path: string, file: { uri: string; name: string; type: string }) => {
    const form = new FormData()
    // React Native's FormData accepts { uri, name, type } for files
    form.append('file', file as unknown as Blob)
    return send<T>(path, { method: 'POST', body: form })
  },
}

export type DriverStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'suspended'
export type DocType = 'licence_front' | 'licence_back' | 'id_proof' | 'address_proof' | 'selfie'

export interface Profile {
  id: string
  full_name: string | null
  preferred_language: 'ta' | 'en'
  licence_number: string | null
  experience_years: number | null
  vehicle_types: string[]
  availability: string | null
  work_preferences: string[]
  expected_pay_note: string | null
  home_pincode: string | null
  home_area: string | null
  service_radius_km: number
  registration_lat: number | null
  registration_lng: number | null
  status: DriverStatus
  rejection_reason: string | null
  police_verified: boolean
}

export interface Checklist {
  profile_complete: boolean
  location_captured: boolean
  consent_accepted: boolean
  missing_documents: DocType[]
  missing_fields: string[]
  ready_to_submit: boolean
  current_consent_version: string
}

export interface DocumentInfo {
  id: string
  doc_type: DocType
  uploaded_at: string
}
