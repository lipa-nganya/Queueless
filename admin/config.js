// Origin of the Queueless API. Local development talks to the local backend.
// Production (*.queueless.co.ke) uses api.queueless.co.ke, which points at
// Railway today; develop (dev.* / dev-*.queueless.co.ke) uses Cloud Run.
window.QUEUELESS_API_ORIGIN = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? ""
  : location.hostname.endsWith("queueless.co.ke") && !/^dev[.-]/.test(location.hostname)
    ? "https://api.queueless.co.ke"
    : "https://queueless-api-958382779776.africa-south1.run.app";

window.QUEUELESS_ADMIN_APP_VERSION = "2.1.2";
