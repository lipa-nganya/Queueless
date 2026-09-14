// Origin of the Queueless API. Local development talks to the local backend;
// deployed builds use the Railway service.
window.QUEUELESS_API_ORIGIN = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? "http://localhost:4000"
  : "https://queueless-staging.up.railway.app";

// Keep in sync with android-vendor versionName (app/build.gradle.kts).
window.QUEUELESS_VENDOR_APP_VERSION = "1.0.0";
