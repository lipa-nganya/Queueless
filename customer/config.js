// Origin of the Queueless API. Local development keeps talking to the local
// backend; production uses Railway, develop uses Cloud Run (queueless-develop).
// *.queueless.co.ke is production; everything else deployed is develop/staging.
window.QUEUELESS_API_ORIGIN = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? ""
  : location.hostname.endsWith("queueless.co.ke")
    ? "https://queueless-prod.up.railway.app"
    : "https://queueless-api-958382779776.africa-south1.run.app";

window.QUEUELESS_CUSTOMER_APP_VERSION = "2.1.2";
