# CLAUDE.md: vandiottunar-frontend

Two apps for the same users. **Keep them in step** (rule 1 below).

- `web/`: React 19 + Vite + TypeScript + react-router 7. Public site (home, driver/customer registration, login, `/dashboard` for drivers and customers) and the admin panel (`/admin`). Port **5173**.
- `mobile/`: Expo SDK 57 + React Native (Android). One app with **driver** and **customer** sides, chosen at login. Package `in.vandiottunar.driver`, deep-link scheme `vandiottunar://`. See `mobile/AGENTS.md`: check versioned Expo docs before using Expo APIs; install with `npx expo install` when online (offline: use versions from `node_modules/expo/bundledNativeModules.json`).

## web/ layout

```
src/api.ts            API_URL (8000), ORDER_API_URL (8001), PAYMENT_API_URL (8002); userApi/orderApi/paymentApi (user session), api/adminOrderApi (admin session); types
src/i18n.tsx          en + ta strings (LangProvider, useT, EnglishOnly for admin)
src/public/           Home, DriverRegister (steps incl. LicenceStep with OCR, DocumentsStep with Aadhaar), CustomerRegister, LoginPage, Dashboard (driver + customer), CarNumberField (plate/RC photo → number), idNumbers.ts (Verhoeff, plate finder), licenceOcr.ts (Tesseract.js from CDN)
src/trip/             DriverTrip (start/end with code, location sharing via tracker.ts), CustomerTrip (codes), LiveTrip + TrackMap (Leaflet, lazy), BookingConfirm (Pay ₹1, WhatsApp button)
src/admin/            Drivers, DriverDetail (licence/Aadhaar checks, approve), Bookings (tabs incl. On a trip), BookingDetail (assign, payment, trip map, chat log), Customers
```

## mobile/ layout

```
App.tsx               session + role routing: driver flow (Hub → steps → StatusScreen) or CustomerApp
index.ts              imports src/tripTracking first (defines the background location task)
src/api.ts            API/ORDER/PAYMENT URLs from EXPO_PUBLIC_*; api, orderApi, paymentApi; types
src/i18n.ts           en + ta
src/session.ts        token, language, role in SecureStore
src/screens/          Login (role chips), Hub, Consent, Profile, Licence, Location, Documents (Aadhaar), Status (driver jobs), TripPanel
src/tripTracking.ts   expo-location background updates (foreground service) + TaskManager task posting GPS to the order-service
src/customer/         CustomerApp, CustomerProfileScreen, NewBookingScreen (native date/time pickers, GPS pickup), BookingCard (Pay ₹1 via in-app browser → vandiottunar://payment, WhatsApp, codes), LiveMap (Leaflet in WebView)
```

## Parity checklist (web ↔ mobile)

| Feature | web | mobile |
|---|---|---|
| Driver registration steps, licence OCR result + checks | ✓ | ✓ (server OCR only; no on-device OCR) |
| Aadhaar number (masked, last 4 kept) | ✓ | ✓ (typed or server OCR) |
| Driver trips: waiting for confirmation, start/end code, location sharing, WhatsApp to customer | ✓ | ✓ (+ background tracking) |
| Customer: register/details, book, Pay ₹1, WhatsApp chat, start/end code, live map, route | ✓ | ✓ |
| Car number from a photo of the plate/RC | ✓ (Tesseract in browser) | ✗ not yet (no on-device OCR) |
| Admin panel | ✓ | web only |

## Commands

```powershell
cd web;    npm install; npm run dev        # checks: npx tsc -b; npm run build; npm run lint
cd mobile; npm install; npx expo start     # checks: npx tsc --noEmit; npx expo export --platform android
```

`web/.env`: `VITE_API_URL`, `VITE_ORDER_API_URL`, `VITE_PAYMENT_API_URL`. `mobile/.env`: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_ORDER_API_URL`, `EXPO_PUBLIC_PAYMENT_API_URL` (emulator: `http://10.0.2.2:800x`; phone: your PC's Wi-Fi IP).

## Feature log

- Public site + admin panel; driver registration; customer registration with booking.
- Login after registration; dashboards for drivers (assignments) and customers (bookings with driver).
- Licence OCR and checks; Aadhaar; car number from photo (web).
- Professional driver hero illustration; VS Code workspace that starts all services.
- Trips: start/end codes, live map, Android background tracking.
- ₹1 confirmation (Razorpay), driver contact hidden, WhatsApp chat link; customer side in the Android app.

## Vandi Ottunar: the whole project

**Vandi Ottunar** (வண்டி ஓட்டுநர், "vehicle driver") is a driver-hiring platform for Tamil Nadu, starting in Coimbatore.
Customers (car owners) and businesses book verified drivers by the hour/day/outstation trip or hire permanent drivers.
Drivers register from their phone, upload their licence and Aadhaar, get police-verified and approved, then receive bookings.
Domain: vandiottunar.in. Owner: Gobinath (gobitech007). Brand: green `#0E3B2E`, mustard `#F2B705`, cream `#F7F1E3`.
**Tamil first, English second**: every user-facing string exists in both languages.

### Repositories (all under github.com/gobitech007, checked out side by side)

| Repo | What | Port | Database |
|---|---|---|---|
| `vandiottunar-user-service` | Accounts, OTP login (JWT), driver onboarding (profile, licence OCR, Aadhaar last-4, documents, consent), customer profiles, admin approval | 8000 | `vandi_users` |
| `vandiottunar-order-service` | Bookings, driver matching/assignment, ₹1 confirmation gate, trip start/end codes, live GPS tracking, WhatsApp chat relay | 8001 | `vandi_orders` |
| `vandiottunar-payment-service` | ₹1 booking confirmation via Razorpay Payment Links (mock checkout in dev) | 8002 | `vandi_payments` |
| `vandiottunar-report-service` | Planned: reports/analytics for admins | 8003 | `vandi_reports` |
| `vandiottunar-frontend` | `web/` React site (public + `/admin`) on 5173; `mobile/` Expo Android app (driver **and** customer) | 5173 | — |

### How the services talk

- **Login**: only the user-service issues JWTs (HS256). Every service verifies them with the **same `JWT_SECRET`**. Claims: `sub` (user id), `role` (`driver` | `customer` | `employer` | `admin`), `typ=access`.
- **Service to service**: `X-Service-Token: <SERVICE_TOKEN>` (same value in every `.env`). Each service exposes `/internal/...` only with that header.
  - order-service → user-service: `GET /internal/drivers?status=approved`, `GET /internal/users/{id}`
  - payment-service → order-service: `GET /internal/bookings/{id}`, `POST /internal/bookings/{id}/paid`
- **Booking lifecycle** (order-service `BookingStatus`): `pending` → `assigned` (admin manual/auto) → *customer pays ₹1* (`payment_status` `unpaid` → `paid`/`waived`) → `in_progress` (driver enters customer's **start code**) → `completed` (driver enters **end code**), or `cancelled`.
- **Privacy rules**: the customer never sees the driver's phone. After paying they get an encrypted WhatsApp link (`/chat/<Fernet token>`) that opens the business WhatsApp number with a 6-digit chat PIN; the relay forwards messages between registered numbers. Aadhaar: only the last 4 digits are stored. GPS points are accepted only between start and end codes and purged after 90 days.
- **Payment return**: payment-service redirects to `WEB_URL/dashboard?booking=<id>&payment=paid|failed` (web) or `vandiottunar://payment?booking=…&payment=…` (app).

### Owner's local setup (Windows)

- PowerShell, one `.venv` per service; always run tools as `python -m …` (`python -m uvicorn`, `python -m alembic`, `python -m pytest`).
- PostgreSQL 18 on `localhost:5432`, user `postgres`, password `admin`; create each database in pgAdmin once.
- VS Code: open `vandiottunar-frontend/vandiottunar.code-workspace`; tasks start every service on folder open (migrate first) and `npm run dev`.
- After pulling: `python -m alembic upgrade head` in each service that has new migrations.

### Rules for working on this project (Claude, read this)

1. **Web and mobile stay in step.** Any user-facing change in `web/` must also be made in `mobile/` (driver and customer sides) unless it is truly web-only (e.g. the admin panel). Say explicitly if something can't be mirrored.
2. **Both languages.** Add every new string to `en` *and* `ta` (web `src/i18n.tsx`, mobile `src/i18n.ts`). Plain, friendly wording; no jargon.
3. **Migrations.** Every model change gets an Alembic migration (`python -m alembic revision --autogenerate -m "…"`), checked with `python -m alembic check`. New NOT NULL columns need a `server_default` so existing rows migrate (this broke once).
4. **Tests.** Each service has pytest suites on SQLite (`python -m pytest -q`). Add tests for new rules. Web: `npx tsc -b && npm run build && npm run lint`. Mobile: `npx tsc --noEmit && npx expo export --platform android`.
5. **Cross-service contracts** live in this file. If you change an internal endpoint, a JWT claim, a status value or a redirect URL, update the CLAUDE.md in every repo.
6. **Secrets** only in `.env` (never committed). Keep `.env.example` complete and commented. Production refuses to start with dev settings (`validate_for_runtime`).
7. **Feature log.** When you add or change a feature, add a line to the *Feature log* in the CLAUDE.md of every repo it touches.
8. Commit messages: what changed and why, in plain words.
