# Vandi Ottunar — Frontend

Two apps that talk to [`vandiottunar-user-service`](https://github.com/gobitech007/vandiottunar-user-service):

| Folder | App | Stack |
|---|---|---|
| `web/` | **Admin panel** — review driver applications, view documents, approve/reject | React 19 + Vite + TypeScript |
| `mobile/` | **Driver app (Android)** — register from anywhere: OTP, privacy notice, profile, GPS location, document photos | Expo SDK 57 + React Native + TypeScript |

Both apps use the Vandi Ottunar look (green `#0E3B2E`, mustard `#F2B705`, cream `#F7F1E3`). The driver app is **Tamil first** with an English toggle.

## Start the API first

```bash
cd ../vandiottunar-user-service
cp .env.example .env     # put your mobile number in ADMIN_PHONES
docker compose up --build
```

In development the OTP appears on screen ("Development code"), so no SMS account is needed.

## Web admin

```bash
cd web
cp .env.example .env     # VITE_API_URL=http://localhost:8000
npm install
npm run dev              # http://localhost:5173
```

Sign in with a number listed in `ADMIN_PHONES`.

- **Waiting for review** tab lists submitted drivers, oldest work first
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

Android package: `in.vandiottunar.driver`. Location is requested only while the app is in use; background location and microphone are disabled.

## Checks

```bash
cd web && npm run build && npm run lint
cd mobile && npx tsc --noEmit && npx expo export --platform android
```
