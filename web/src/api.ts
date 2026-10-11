export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

const TOKEN_KEY = 'vo_admin_token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable — session lasts until reload */
  }
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

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  const text = await res.text()
  const body: unknown = text ? JSON.parse(text) : null
  if (!res.ok) {
    if (res.status === 401) setToken(null)
    throw new ApiError(res.status, messageFrom(body, `Request failed (${res.status})`))
  }
  return body as T
}

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
