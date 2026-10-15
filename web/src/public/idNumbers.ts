// Checks and finders for numbers read from photos: Aadhaar (Verhoeff check digit) and vehicle
// registration numbers. Licence parsing lives in the user-service so the apps share it.

const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

export const aadhaarDigits = (v: string) => v.replace(/\D/g, '').slice(0, 12)

export function validAadhaar(v: string): boolean {
  const n = aadhaarDigits(v)
  if (!/^[2-9]\d{11}$/.test(n)) return false
  let c = 0
  ;[...n].reverse().forEach((ch, i) => {
    c = D[c][P[i % 8][Number(ch)]]
  })
  return c === 0
}

/** 234567890124 → "2345 6789 0124" while typing */
export const formatAadhaar = (v: string) => aadhaarDigits(v).replace(/(\d{4})(?=\d)/g, '$1 ')
export const maskAadhaar = (last4: string) => `XXXX XXXX ${last4}`

// ---- Vehicle registration numbers ----

const STATES = new Set(
  'AN AP AR AS BR CG CH DD DL DN GA GJ HP HR JH JK KA KL LA LD MH ML MN MP MZ NL OD OR PB PY RJ SK TN TR TS UK UP WB'.split(' '),
)
const toDigits = (s: string) => s.replace(/[OQD]/g, '0').replace(/[IL]/g, '1').replace(/Z/g, '2').replace(/S/g, '5').replace(/B/g, '8').replace(/G/g, '6')
const toLetters = (s: string) => s.replace(/0/g, 'O').replace(/1/g, 'I').replace(/2/g, 'Z').replace(/5/g, 'S').replace(/8/g, 'B')

// TN 48 AZ 1188 / TN-48-AZ-1188 / TN48AZ1188 (letters and digits may be misread either way)
const PLATE = /(?<![A-Z0-9])([A-Z0-9]{2})[\s.-]*([0-9OQDILZSBG]{1,2})[\s.-]*([A-Z0-9]{0,3}?)[\s.-]*([0-9OQDILZSBG]{4})(?![A-Z0-9])/g
const BHARAT = /(?<![A-Z0-9])(\d{2})[\s.-]*BH[\s.-]*(\d{4})[\s.-]*([A-Z]{1,2})(?![A-Z0-9])/g
const LABEL = /(?:REGN|REGISTRATION|REG|VEHICLE)\.?\s*(?:NO|NUMBER|NUM)\.?\s*[:\-]?\s*(.{6,20})/

function scan(text: string): string | null {
  for (const m of text.matchAll(BHARAT)) return `${m[1]}BH${m[2]}${m[3]}`
  for (const m of text.matchAll(PLATE)) {
    const state = toLetters(m[1])
    const series = toLetters(m[3])
    if (!STATES.has(state) || !/^[A-Z]{0,3}$/.test(series)) continue
    return `${state}${toDigits(m[2]).padStart(2, '0')}${series}${toDigits(m[4])}`
  }
  return null
}

/** Best guess at the vehicle number in text read from a number plate photo or an RC card/screenshot. */
export function findCarNumber(raw: string): string | null {
  const text = raw.toUpperCase().replace(/\bIND\b/g, ' ')
  const labelled = LABEL.exec(text)
  return (labelled && scan(labelled[1])) || scan(text) || scan(text.replace(/\s+/g, ''))
}

// ---- Licence class codes ----
const CLASS_DISPLAY: Record<string, string> = {
  LMVNT: 'LMV-NT',
  LMVTR: 'LMV-TR',
  LMVCAB: 'LMV-CAB',
  LMVTAXI: 'LMV-TAXI',
  LMVINVCRG: 'LMV-INVCRG',
  LMVAR: 'LMV-AR',
  MC50CC: 'MC 50CC',
  MCEX50CC: 'MC EX50CC',
  '3WNT': '3W-NT',
  '3WT': '3W-T',
}
export const displayClass = (code: string) => CLASS_DISPLAY[code] ?? code
