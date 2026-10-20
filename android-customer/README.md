# Queueless Customer (Android)

Native Kotlin + Jetpack Compose customer app. Calls the same `/api/customer/*` endpoints as the customer web app.

- **Application id:** `tech.thewolfgang.queueless.customer` (+ `.local` / `.dev` suffixes)
- **Min SDK 26 · Target SDK 36**

## Environments

Product flavors (pick one in Android Studio’s build variant dropdown):

| Flavor | App id suffix | App name | API base URL | Notes |
| --- | --- | --- | --- | --- |
| **local** | `.local` | Queueless (Local) | `https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api` | Host API via ngrok |
| **dev** | `.dev` | Queueless (Dev) | `https://queueless-staging.up.railway.app/api` | Develop / Railway staging |
| **production** | _(none)_ | Queueless | `https://queueless-prod.up.railway.app/api` | Live API |

All three install side by side, and each keeps its own login. Local and dev builds show the API host next to the version on the login and profile screens.

### Override URLs (optional)

In `android-customer/local.properties` (gitignored):

```properties
queueless.api.local=https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api
queueless.api.dev=https://queueless-staging.up.railway.app/api
queueless.api.production=https://queueless-prod.up.railway.app/api
```

For a local API without ngrok, use `adb reverse tcp:4000 tcp:4000` and `queueless.api.local=http://127.0.0.1:4000/api`. Cleartext HTTP is allowed for the **local** flavor only.

## Open in Android Studio

1. **File → Open** → select this `android-customer` folder (not the monorepo root).
2. Let Gradle sync (JDK 17+; Android Studio’s bundled JBR works).
3. **Build → Select Build Variant** → `localDebug`, `devDebug`, or `productionRelease`.

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
app/build/outputs/apk/production/release/app-production-release-unsigned.apk
```

The production release APK is unsigned unless `keystore.properties` is set up (see below).

## Release to Google Play

Play takes an Android App Bundle (`.aab`) signed with your **upload key**. Play App Signing holds the real app-signing key.

1. Create an upload key once, keep it **outside the repo**, and back it up with its passwords:

   ```bash
   mkdir -p ~/queueless-keys
   keytool -genkeypair -v -keystore ~/queueless-keys/queueless-upload.jks \
     -alias queueless-upload -keyalg RSA -keysize 2048 -validity 10000
   ```

2. `cp keystore.properties.example keystore.properties` (gitignored) and fill in the path and passwords.
3. Bump `versionCode` (and `versionName` if needed) in `app/build.gradle.kts`. Play rejects a `versionCode` it has already seen.
4. Build the bundle:

   ```bash
   ./gradlew :app:bundleProductionRelease
   ```

   Output: `app/build/outputs/bundle/productionRelease/app-production-release.aab`

5. Upload it in Play Console for `tech.thewolfgang.queueless.customer`.

Without `keystore.properties`, release builds are unsigned and Play will not accept them.

