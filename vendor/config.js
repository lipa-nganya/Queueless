// Origin of the Queueless API. Local development talks to the local backend;
// deployed builds use the Railway service.
window.QUEUELESS_API_ORIGIN = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? "http://localhost:4000"
  : "https://queueless-staging.up.railway.app";

// Keep in sync with android-vendor versionName (app/build.gradle.kts).
window.QUEUELESS_VENDOR_APP_VERSION = "1.1.0";

// Public Firebase web push config (FCM). Also available from GET /api/vendor/push-config.
window.QUEUELESS_FIREBASE_WEB = {
  "apiKey": "AIzaSyCZYWNcjFMae9oHFvSKJw2vWsflSTC2vtU",
  "authDomain": "queueless-kenya.firebaseapp.com",
  "projectId": "queueless-kenya",
  "storageBucket": "queueless-kenya.firebasestorage.app",
  "messagingSenderId": "6982334572",
  "appId": "1:6982334572:web:3923a8953986c4e35b0049",
  "vapidKey": "BDb92bJ55lxHV0zJXnyQCtpVrADBFJrY0Ifkv3oiBU3fe5uRWXtVq8KXitVcnwJo8EW0XQ5hLawiwniNxR67WxI"
};
