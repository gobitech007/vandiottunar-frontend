export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'
// Bookings and driver assignment live in the order-service
export const ORDER_API_URL = (import.meta.env.VITE_ORDER_API_URL as string | undefined) ?? 'http://localhost:8001'
// ₹1 booking confirmation payments
export const PAYMENT_API_URL = (import.meta.env.VITE_PAYMENT_API_URL as string | undefined) ?? 'http://localhost:8002'

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
  base?: string
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const scope = options.scope ?? 'admin'
  const headers: Record<string, string> = {}
  const token = scope === 'admin' ? getToken() : getUserSession()?.token
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`${options.base ?? API_URL}${path}`, {
      method: options.method ?? (options.body !== undefined || options.form ? 'POST' : 'GET'),
      headers,
      body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    })
  } catch {
    const base = options.base ?? API_URL
    throw new ApiError(
      0,
      import.meta.env.DEV
        ? `Could not reach ${base}. Is that server running? (If it is, check its CORS_ORIGINS includes ${window.location.origin}.)`
        : 'Could not reach the server. Check your internet connection and try again.',
    )
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

/** Order-service calls (bookings, assignments) */
export const orderApi = <T>(path: string, options: Omit<RequestOptions, 'scope' | 'base'> = {}) =>
  request<T>(path, { ...options, scope: 'user', base: ORDER_API_URL })
export const adminOrderApi = <T>(path: string, options: Omit<RequestOptions, 'scope' | 'base'> = {}) =>
  request<T>(path, { ...options, scope: 'admin', base: ORDER_API_URL })
/** Payment-service calls */
export const paymentApi = <T>(path: string, options: Omit<RequestOptions, 'scope' | 'base'> = {}) =>
  request<T>(path, { ...options, scope: 'user', base: PAYMENT_API_URL })

export interface Payment {
  id: string
  purpose: 'booking_confirmation' | 'cancellation_fee'
  booking_id: string
  amount_paise: number
  status: 'created' | 'paid' | 'failed' | 'expired'
  pay_url: string | null
}

export interface ChatMessage {
  sender: 'customer' | 'driver' | 'system'
  body: string
  delivery: string
  created_at: string
}

export type DriverStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'suspended'

export interface DriverSummary {
  id: string
  user_id: string
  full_name: string | null
  two_wheeler: boolean
  four_wheeler: boolean
  heavy_vehicle: boolean
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
  licence_classes: string[]
  licence_valid_till: string | null
  licence_source: string | null
  licence_verified: boolean
  aadhaar_last4: string | null
  licence_raw_text: string | null
  licence_wording_found: boolean | null
  aadhaar_source: string | null
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
  licence_classes: string[]
  licence_valid_till: string | null
  licence_source: string | null
  licence_verified: boolean
  two_wheeler: boolean
  four_wheeler: boolean
  heavy_vehicle: boolean
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
  car_number: string | null
  current_policy_version: string
  policy_accepted: boolean
  policy_accepted_at: string | null
  profile_complete: boolean
  created_at: string
}

/** Fees shown in the booking & cancellation policy (order-service GET /bookings/policy) */
export interface BookingPolicy {
  confirmation_fee_paise: number
  cancellation_fee_paise: number
  cancellation_fee_applies: 'assigned' | 'always' | 'never'
}

export interface AdminCustomer extends CustomerProfile {
  phone: string
  role: 'customer' | 'employer'
}

export interface ParsedLicence {
  licence_number: string | null
  classes: string[]
  valid_till: string | null
  two_wheeler: boolean
  four_wheeler: boolean
  heavy: boolean
  wording_found: boolean
  looks_like_licence: boolean
  expired: boolean
  raw_text: string | null
}

export interface ParsedAadhaar {
  aadhaar_number: string | null
  masked: string | null
  wording_found: boolean
}

// ---- Bookings (order-service) ----

export type BookingStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
export type BookingType = 'on_demand' | 'job'
export type VehicleClass = 'two_wheeler' | 'four_wheeler' | 'heavy'

export interface Booking {
  id: string
  reference: string
  booking_type: BookingType
  vehicle_class: VehicleClass
  car_number: string | null
  vehicle_note: string | null
  start_at: string
  end_at: string | null
  pickup_address: string | null
  pickup_area: string | null
  pickup_pincode: string
  pickup_lat: number | null
  pickup_lng: number | null
  notes: string | null
  status: BookingStatus
  driver_name: string | null
  assigned_at: string | null
  // Booking confirmation (₹1). Until it's paid the customer sees no chat link and no start code
  payment_status: 'unpaid' | 'paid' | 'waived'
  paid_at: string | null
  /** Encrypted WhatsApp relay link (customer: to the driver; driver: to the customer) */
  chat_url?: string | null
  fee_paise?: number
  /** What cancelling now costs (0 = free); above 0 the customer pays it to cancel */
  cancellation_fee_paise?: number
  /** After a paid cancellation */
  cancel_fee_status?: 'none' | 'paid'
  cancel_fee_paise?: number
  started_at: string | null
  completed_at: string | null
  distance_m: number
  last_location_at: string | null
  cancel_reason: string | null
  created_at: string
  // Only in the customer's own bookings
  start_code?: string | null
  end_code?: string | null
}

export interface TrackPoint {
  lat: number
  lng: number
  recorded_at: string
  accuracy_m: number | null
}

export interface Track {
  booking_id: string
  status: BookingStatus
  started_at: string | null
  completed_at: string | null
  distance_km: number
  last: TrackPoint | null
  path: [number, number][]
  pickup_lat: number | null
  pickup_lng: number | null
  driver_name: string | null
}

export interface DriverBooking extends Booking {
  customer_name: string | null
  customer_phone: string
  company_name: string | null
}

export interface AdminBooking extends DriverBooking {
  customer_user_id: string
  customer_role: string
  driver_user_id: string | null
  driver_phone: string | null
  payment_id: string | null
  cancel_payment_id: string | null
  assignment_mode: string | null
  cancelled_by: string | null
}

export interface Candidate {
  driver_user_id: string
  driver_id: string
  full_name: string | null
  phone: string
  home_area: string | null
  home_pincode: string | null
  two_wheeler: boolean
  four_wheeler: boolean
  heavy_vehicle: boolean
  licence_classes: string[]
  experience_years: number | null
  distance_km: number | null
  within_service_area: boolean | null
  pincode_match: number
  upcoming: number
  eligible: boolean
  reasons: string[]
}

export interface AutoAssignResult {
  booking_id: string
  reference: string
  assigned: boolean
  driver_name: string | null
  reason: string | null
}

/** "Mon, 13 Oct, 9:00 am" in India time */
export function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}

export const mapLink = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`

// Class-of-vehicle codes on Indian licences, grouped like the user-service's parser (app/services/licence.py)
export const LICENCE_GROUPS = {
  two_wheeler: ['MCWG', 'MCWOG', 'MC50CC', 'MCEX50CC', 'FVG'],
  four_wheeler: ['LMV', 'LMVNT', 'LMVTR', 'LMVCAB', 'LMVTAXI', 'LMVINVCRG', '3WNT', '3WT', 'LMVAR'],
  heavy: ['HMV', 'HGMV', 'HPMV', 'HTV', 'HTRAILER', 'HGV', 'HPV', 'MGV', 'MPMV', 'MMV', 'TRAILR'],
} as const
export type LicenceGroup = keyof typeof LICENCE_GROUPS
/** The code added when someone ticks a group by hand */
export const DEFAULT_CODE: Record<LicenceGroup, string> = { two_wheeler: 'MCWG', four_wheeler: 'LMV', heavy: 'HGMV' }
