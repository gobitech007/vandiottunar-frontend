# Vandi Ottunar — Frontend

Two apps that talk to [`vandiottunar-user-service`](https://github.com/gobitech007/vandiottunar-user-service) (accounts, drivers) and [`vandiottunar-order-service`](https://github.com/gobitech007/vandiottunar-order-service) (bookings, driver assignment):

| Folder | App | Stack |
|---|---|---|
| `web/` | **Public website** — home page with *Register as driver* / *Register as customer*, full registration in Tamil or English — plus the **admin panel** at `/admin` | React 19 + Vite + TypeScript |
| `mobile/` | **Driver app (Android)** — register from anywhere: OTP, privacy notice, profile, GPS location, document photos | Expo SDK 57 + React Native + TypeScript |

Both apps use the Vandi Ottunar look (green `#0E3B2E`, mustard `#F2B705`, cream `#F7F1E3`). The driver app is **Tamil first** with an English toggle.

## Start the API first

```bash
cd ../vandiottunar-user-service
cp .env.example .env     # put your mobile number in ADMIN_PHONES
docker compose up --build
```

In development the OTP appears on screen ("Development code"), so no SMS account is needed.

## Website

```bash
cd web
cp .env.example .env     # VITE_API_URL=http://localhost:8000, VITE_ORDER_API_URL=http://localhost:8001
npm install
npm run dev              # http://localhost:5173
```

| Page | What it does |
|---|---|
| `/` | Home page (Tamil / English) with **Register as customer** and **Register as driver** |
| `/register/driver` | OTP → privacy notice → details → browser location → licence/ID/selfie upload (photos shrunk in the browser) → submit → status |
| `/register/customer` | Choose *Car owner* or *Business* → OTP → name, pincode, needs (company for businesses) → done |
| `/login` | One sign-in for everyone: drivers and customers go to their dashboard, admins to the admin panel |
| `/dashboard` | **Driver:** status, then assigned customers (name, phone, car number, pickup, dates). **Customer:** bookings with the assigned driver's name and phone, and *Book a driver* |
| Trips | The customer's booking shows a **start code**; the driver taps *Start trip* and enters it. Then the customer sees an **end code** and a **live map** of the driver (refreshes every 10 s); the driver enters the end code to finish. Admin: *Bookings → On a trip* shows the same map |
| `/admin` | Admin panel: **Drivers**, **Bookings** (auto-assign all waiting, or open a booking to assign manually from ranked drivers) and **Customers** |

After registering (same OTP), people go straight to their dashboard.

**Licence reading:** in the driver's *Driving licence* step, the photos are read automatically. If the user-service has `OCR_PROVIDER=textract`, AWS Textract reads them on the server; otherwise the browser reads them with Tesseract.js (downloads about 10 MB from cdn.jsdelivr.net the first time). Either way the text goes to the user-service's parser, which finds the licence number, validity and vehicle classes (MCWG → two-wheeler, LMV → car, HMV/HGMV/HPMV → heavy). The driver confirms and an admin checks against the photo before approving.

- **Licence check:** the page says whether the photo reads like a real licence (wording such as *Indian Union Driving Licence* / *Transport Department*, plus number and dates), shows the number, each class with its meaning (MCWG, LMV, LMV-TR …) and the expiry under its field. An expired licence can't be saved.
- **Aadhaar:** in *Documents*, the Aadhaar photo is read the same way and the number appears under the *Aadhaar number* field. It is checked (12 digits, Verhoeff check digit) and **only the last 4 digits are stored**.
- **Car number:** customers can tap 📷 next to *Car number* to photograph the number plate or the RC (a screenshot works too). The photo is read in the browser and never uploaded.

A phone number belongs to one role: if a driver's number is used on the customer page (or the other way round), the page says so and links to the right one.

Browser location only works on `https://` or `localhost`.

### Admin panel

Sign in at `/admin` with a number listed in `ADMIN_PHONES` in the API's `.env` (restart the API after changing it). Other numbers are refused.

- **Waiting for review** tab lists submitted drivers, newest first
- Driver page shows profile, registration GPS + work area on Google Maps, consent record and document photos
- **Approve** is only possible after you tick *Police verification is complete*
- **Reject** sends the reason to the driver, who can fix and resubmit
- "Where drivers are signing up" shows sign-ups by pincode

## Driver app (Android)

```bash
cd mobile
cp .env.example .env     # EXPO_PUBLIC_API_URL — see below
npm install
npx expo start           # press "a" for the Android emulator
```

- **Android emulator:** `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000`
- **Real phone (Expo Go or dev build):** use your computer's Wi-Fi IP, e.g. `http://192.168.1.20:8000`. The phone and computer must be on the same network.

Flow: phone + OTP → privacy notice (bilingual, recorded with version) → details → **"Use my current location"** (GPS + pincode/area prefilled from the phone, editable, service radius) → licence front/back, ID and selfie photos (compressed to ~1600 px before upload) → submit → status screen.

### Building an APK / Play Store bundle

Use EAS Build:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview      # installable APK for testing
eas build --platform android --profile production   # AAB for the Play Store
```

Set `EXPO_PUBLIC_API_URL` to your HTTPS API domain (e.g. `https://api.vandiottunar.in`) in the EAS build environment.

Android package: `in.vandiottunar.driver`. Microphone is disabled.

**Trip location in the app:** when a driver starts a trip, the app explains why it needs location, then asks for "Allow all the time". With that, a foreground service (a visible notification) keeps sending GPS every ~15 s with the screen off, until the end code. Without it, the app shares only while it is open. Background location needs a **development or EAS build**: Expo Go can't run it. For the Play Store you must fill in the *Location permissions* declaration (background location for "trip tracking during a booked trip") and upload a short video of the disclosure screen.

On the website, the driver's browser shares location while the page is open (the screen is kept on where the browser allows).

## Checks

```bash
cd web && npm run build && npm run lint
cd mobile && npx tsc --noEmit && npx expo export --platform android
```

## VS Code: start everything automatically

Keep the three repos side by side in one folder (`vandiottunar-frontend`, `vandiottunar-user-service`, `vandiottunar-order-service`), then open **`vandiottunar-frontend/vandiottunar.code-workspace`** (File → Open Workspace from File).

When the workspace opens, VS Code runs:

| Terminal | What it does |
|---|---|
| User service | `alembic upgrade head`, then uvicorn on **8000** (auto-reload) |
| Order service | `alembic upgrade head`, then uvicorn on **8001** (auto-reload) |
| Website | `npm run dev` in `web/` on **5173** |

The first time, VS Code asks whether to allow automatic tasks: choose **Allow** (or Command Palette → *Tasks: Manage Automatic Tasks* → *Allow*). Each service needs its own `.venv` and `.env`, and `web/` needs `npm install`, done once.

**Debugging (F5):** stop the auto-started server first (Command Palette → *Tasks: Terminate Task*), then pick *User service: debug*, *Order service: debug*, or *Debug all* in the Run and Debug panel. *Website: open in Chrome (debug)* attaches to the running site, so it doesn't need stopping.

Opening one repo on its own starts just that app.
