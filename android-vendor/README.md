# Queueless Vendor (Android)

Native Kotlin + Jetpack Compose app for day-to-day vendor queue management. Calls the same `/api/vendor/*` endpoints as the web vendor SPA.

- **Application id:** `tech.thewolfgang.queueless.vendor` (+ `.local` / `.dev` suffixes)
- **Min SDK 26 · Target SDK 35**

## Environments

Product flavors (pick one in Android Studio’s build variant dropdown):

| Flavor | App id suffix | API base URL | Notes |
| --- | --- | --- | --- |
| **local** | `.local` | `https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api` | Host API via ngrok (physical device or emulator) |
| **dev** | `.dev` | `https://queueless-staging.up.railway.app/api` | Develop / Railway staging |
| **production** | _(none)_ | `https://queueless.up.railway.app/api` | Live API |

All three can be installed side-by-side. Non-production builds show the env name + API URL on the login screen.

### Override URLs (optional)

In `android-vendor/local.properties` (gitignored):

```properties
queueless.api.local=https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api
queueless.api.dev=https://queueless-staging.up.railway.app/api
queueless.api.production=https://queueless.up.railway.app/api
```

### Local API via ngrok (recommended)

1. Start local servers: `./start-servers.sh` (from the repo root).
2. Expose the API on the reserved domain: `./start-ngrok-api.sh`.
3. Build/run the **localDebug** variant — it already points at that ngrok URL.

The OkHttp client sends `ngrok-skip-browser-warning` automatically for ngrok hosts.

## Open in Android Studio

1. Open Android Studio → **File → Open** → select this `android-vendor` folder (not the monorepo root).
2. Let Gradle sync (JDK 17+; Android Studio’s bundled JBR works).
3. **Build → Select Build Variant** → e.g. `localDebug`, `devDebug`, or `productionRelease`.
4. Start an emulator or connect a device with USB debugging, then Run.

Seed credentials (local migrate): `vendor` / `vendor123`.

## Build APKs

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

./gradlew :app:assembleLocalDebug
./gradlew :app:assembleDevDebug
./gradlew :app:assembleProductionRelease
```

APK paths:

```text
app/build/outputs/apk/local/debug/app-local-debug.apk
app/build/outputs/apk/dev/debug/app-dev-debug.apk
app/build/outputs/apk/production/release/app-production-release.apk
```

Install example:

```bash
adb install -r app/build/outputs/apk/local/debug/app-local-debug.apk
```

## Local API from a physical device

Prefer **ngrok** (see above). Alternatives if ngrok is down:

1. USB reverse, then point local flavor at loopback:

   ```bash
   adb reverse tcp:4000 tcp:4000
   ```

   Set in `local.properties`:

   ```properties
   queueless.api.local=http://127.0.0.1:4000/api
   ```

2. Or use your Mac’s LAN IP, e.g. `queueless.api.local=http://192.168.1.20:4000/api`, with the backend bound to `0.0.0.0`.

Cleartext HTTP is allowed for the **local** flavor only (`src/local/AndroidManifest.xml` + `network_security_config.xml`) when you use those HTTP fallbacks.

## Screens

1. **Login** → `POST /vendor/login` (JWT stored in EncryptedSharedPreferences, per environment)
2. **Businesses** → `GET /vendor/businesses` (auto-opens queue when only one business)
3. **Queue desk** → polls `GET .../queue` every 8s while the app is foregrounded; walk-ins `PUT`; Serve / No-show
4. **Menu → Profile** → edit business name, active status, and operating hours (`GET/PUT /vendor/businesses/:id`)

## Push notifications (FCM)

Vendor activation, trial updates, and queue join/leave alerts are delivered as **Android push** (OTP stays on SMS).

1. Create a Firebase project and add Android apps for:
   - `tech.thewolfgang.queueless.vendor`
   - `tech.thewolfgang.queueless.vendor.local`
   - `tech.thewolfgang.queueless.vendor.dev`
2. Download `google-services.json` into `android-vendor/app/` (see `google-services.json.example`).
3. On the API, set either:
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — full service-account JSON string, or
   - `FIREBASE_SERVICE_ACCOUNT_PATH` — path to the JSON file
4. Rebuild the app. After PIN setup (pending) or login, the device registers via `POST /vendor/push-tokens` (or `/pending`).

Without `google-services.json`, the app still builds; push registration is skipped (`BuildConfig.PUSH_ENABLED=false`).

Optional: `VENDOR_PUSH_SMS_FALLBACK=1` also sends queue alerts over WhatsApp/SMS to assigned vendor phones (default off — push only for vendors).

## Out of scope (first slice)

WhatsApp from the app, Play Store signing, removing the web `vendor/` site.
