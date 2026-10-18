// Origin of the Queueless API. Local development keeps talking to the local
// backend; deployed builds use the Railway service for their environment.
// *.queueless.co.ke is production; everything else deployed is develop/staging.
window.QUEUELESS_API_ORIGIN = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? ""
  : location.hostname.endsWith("queueless.co.ke")
    ? "https://queueless.up.railway.app"
    : "https://queueless-staging.up.railway.app";

window.QUEUELESS_CUSTOMER_APP_VERSION = "1.4.0";
