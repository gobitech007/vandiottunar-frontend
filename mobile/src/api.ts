// Android emulator reaches your computer's localhost at 10.0.2.2.
// On a real phone set EXPO_PUBLIC_API_URL to your computer's LAN IP, e.g. http://192.168.1.20:8000
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000'
// Bookings and assignments (order-service)
export const ORDER_API_URL = process.env.EXPO_PUBLIC_ORDER_API_URL ?? 'http://10.0.2.2:8001'

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

async function send<T>(path: string, init: RequestInit, base: string = API_URL): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) }
  if (authToken) headers.Authorization = `Bearer ${authToken}`
  let res: Response
  try {
    res = await fetch(`${base}${path}`, { ...init, headers })
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
  licence_classes: string[]
  licence_valid_till: string | null
  licence_source: string | null
  aadhaar_last4: string | null
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
  licence_complete: boolean
  aadhaar_captured: boolean
  server_ocr_available: boolean
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

export interface ParsedLicence {
  licence_number: string | null
  classes: string[]
  valid_till: string | null
  raw_text: string | null
}

// Class-of-vehicle codes on Indian licences, grouped like the user-service's parser
export const LICENCE_GROUPS = {
  two_wheeler: ['MCWG', 'MCWOG', 'MC50CC', 'MCEX50CC', 'FVG'],
  four_wheeler: ['LMV', 'LMVNT', 'LMVTR', 'LMVCAB', 'LMVTAXI', 'LMVINVCRG', '3WNT', '3WT', 'LMVAR'],
  heavy: ['HMV', 'HGMV', 'HPMV', 'HTV', 'HTRAILER', 'HGV', 'HPV', 'MGV', 'MPMV', 'MMV', 'TRAILR'],
} as const
export type LicenceGroup = keyof typeof LICENCE_GROUPS
export const DEFAULT_CODE: Record<LicenceGroup, string> = { two_wheeler: 'MCWG', four_wheeler: 'LMV', heavy: 'HGMV' }

export const orderApi = {
  get: <T>(path: string) => send<T>(path, { method: 'GET' }, ORDER_API_URL),
  post: <T>(path: string) => send<T>(path, { method: 'POST' }, ORDER_API_URL),
}

export interface Assignment {
  id: string
  reference: string
  booking_type: 'on_demand' | 'job'
  vehicle_class: 'two_wheeler' | 'four_wheeler' | 'heavy'
  car_number: string | null
  start_at: string
  end_at: string | null
  pickup_address: string | null
  pickup_area: string | null
  pickup_pincode: string
  pickup_lat: number | null
  pickup_lng: number | null
  notes: string | null
  status: 'assigned' | 'completed'
  customer_name: string | null
  customer_phone: string
  company_name: string | null
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}
