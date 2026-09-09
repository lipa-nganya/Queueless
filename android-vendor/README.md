# Queueless Vendor (Android)

Native Kotlin + Jetpack Compose app for day-to-day vendor queue management. Calls the same `/api/vendor/*` endpoints as the web vendor SPA.

- **Application id:** `tech.thewolfgang.queueless.vendor` (+ `.local` / `.dev` suffixes)
- **Min SDK 26 · Target SDK 35**

## Environments

Product flavors (pick one in Android Studio’s build variant dropdown):

| Flavor | App id suffix | API base URL | Notes |
| --- | --- | --- | --- |
| **local** | `.local` | `http://10.0.2.2:4000/api` | Emulator → host localhost; cleartext allowed |
| **dev** | `.dev` | `https://queueless-staging.up.railway.app/api` | Develop / Railway staging |
| **production** | _(none)_ | `https://queueless.up.railway.app/api` | Live API |

All three can be installed side-by-side. Non-production builds show the env name + API URL on the login screen.

### Override URLs (optional)

In `android-vendor/local.properties` (gitignored):

```properties
queueless.api.local=http://192.168.1.20:4000/api
queueless.api.dev=https://queueless-staging.up.railway.app/api
queueless.api.production=https://queueless.up.railway.app/api
```

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

`10.0.2.2` only works on the emulator. On a real phone, either:

1. **Preferred:** USB reverse, then point local flavor at loopback:

   ```bash
   adb reverse tcp:4000 tcp:4000
   ```

   Set in `local.properties`:

   ```properties
   queueless.api.local=http://127.0.0.1:4000/api
   ```

2. Or use your Mac’s LAN IP, e.g. `queueless.api.local=http://192.168.1.20:4000/api`, with the backend bound to `0.0.0.0`.

Cleartext HTTP is allowed for the **local** flavor only (`src/local/AndroidManifest.xml` + `network_security_config.xml`).

## Screens

1. **Login** → `POST /vendor/login` (JWT stored in EncryptedSharedPreferences, per environment)
2. **Businesses** → `GET /vendor/businesses` (auto-opens queue when only one business)
3. **Queue desk** → polls `GET .../queue` every 8s while the app is foregrounded; walk-ins `PUT`; Serve / No-show
4. **Menu → Profile** → edit business name, active status, and operating hours (`GET/PUT /vendor/businesses/:id`)

## Out of scope (first slice)

Push/FCM, WhatsApp from the app, Play Store signing, removing the web `vendor/` site.
