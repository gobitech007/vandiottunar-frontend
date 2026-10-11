export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

// Admin and public (driver/customer) sign-ins are kept separate, so testing one never logs out the other
const ADMIN_KEY = 'vo_admin_token'
const USER_KEY = 'vo_user_session'

export type UserRole = 'driver' | 'customer' | 'employer' | 'admin'
export interface UserSession {
  token: string
  role: UserRole
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    /* storage unavailable — session lasts until reload */
  }
}

export const getToken = () => read(ADMIN_KEY)
export const setToken = (token: string | null) => write(ADMIN_KEY, token)

export function getUserSession(): UserSession | null {
  const raw = read(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserSession
  } catch {
    return null
  }
}

export const setUserSession = (session: UserSession | null) => write(USER_KEY, session ? JSON.stringify(session) : null)

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

interface RequestOptions {
  method?: string
  body?: unknown
  form?: FormData
  scope?: 'admin' | 'user'
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const scope = options.scope ?? 'admin'
  const headers: Record<string, string> = {}
  const token = scope === 'admin' ? getToken() : getUserSession()?.token
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? (options.body !== undefined || options.form ? 'POST' : 'GET'),
      headers,
      body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    })
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your internet connection and try again.')
  }
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }
  if (!res.ok) {
    if (res.status === 401) {
      if (scope === 'admin') setToken(null)
      else setUserSession(null)
    }
    throw new ApiError(res.status, messageFrom(body, `Request failed (${res.status})`))
  }
  return body as T
}

/** Admin panel calls */
export const api = <T>(path: string, options: Omit<RequestOptions, 'scope'> = {}) => request<T>(path, options)

/** Driver / customer calls from the public site */
export const userApi = <T>(path: string, options: Omit<RequestOptions, 'scope'> = {}) =>
  request<T>(path, { ...options, scope: 'user' })

export type DriverStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'suspended'

export interface DriverSummary {
  id: string
  full_name: string | null
  phone: string
  status: DriverStatus
  home_pincode: string | null
  home_area: string | null
  experience_years: number | null
  work_preferences: string[]
  police_verified: boolean
  submitted_at: string | null
  created_at: string
}

export interface DriverDocument {
  id: string
  doc_type: string
  content_type: string
  size_bytes: number
  uploaded_at: string
  view_url: string
}

export interface DriverDetail extends DriverSummary {
  preferred_language: string
  licence_number: string | null
  vehicle_types: string[]
  availability: string | null
  expected_pay_note: string | null
  home_lat: number | null
  home_lng: number | null
  service_radius_km: number
  registration_lat: number | null
  registration_lng: number | null
  registration_accuracy_m: number | null
  location_captured_at: string | null
  rejection_reason: string | null
  police_reference: string | null
  reviewed_at: string | null
  documents: DriverDocument[]
  consent_version: string | null
  consent_accepted_at: string | null
}

export interface Stats {
  by_status: Record<DriverStatus, number>
  signups_by_pincode: { pincode: string; drivers: number }[]
}

export const LABELS: Record<string, string> = {
  car_manual: 'Car (manual)',
  car_automatic: 'Car (automatic)',
  suv: 'SUV',
  van: 'Van',
  light_commercial: 'Light commercial',
  heavy_vehicle: 'Heavy vehicle',
  full_time: 'Full time',
  part_time: 'Part time',
  weekends: 'Weekends',
  on_demand: 'On-demand trips',
  job: 'Job placement',
  licence_front: 'Licence — front',
  licence_back: 'Licence — back',
  id_proof: 'ID proof',
  address_proof: 'Address proof',
  selfie: 'Selfie',
  ta: 'Tamil',
  en: 'English',
}

export const label = (v: string) => LABELS[v] ?? v

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

// ---- Public site (driver / customer registration) ----

export type DocType = 'licence_front' | 'licence_back' | 'id_proof' | 'address_proof' | 'selfie'

export interface DriverProfile {
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
  content_type: string
  uploaded_at: string
}

export interface CustomerProfile {
  id: string
  full_name: string | null
  email: string | null
  preferred_language: string
  company_name: string | null
  home_pincode: string | null
  home_area: string | null
  needs: string[]
  vehicle_note: string | null
  profile_complete: boolean
  created_at: string
}

export interface AdminCustomer extends CustomerProfile {
  phone: string
  role: 'customer' | 'employer'
}
