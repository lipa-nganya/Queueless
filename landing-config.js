// Destinations and product versions from the Queueless landing page.
(function () {
  const host = typeof location !== "undefined" ? location.hostname : "";
  const isLocal = host === "localhost" || host === "127.0.0.1";

  window.QUEUELESS_LANDING = {
    // Local: customer app on :3000. Develop: dedicated customer subdomain.
    customerUrl: isLocal
      ? "http://localhost:3000/"
      : "https://customer.thewolfgang.tech/",
    vendorWebUrl: isLocal
      ? "http://localhost:3500/"
      : "https://vendor.queueless.thewolfgang.tech",
    // Play Store listing for the customer app. Leave blank until the listing is public.
    customerPlayUrl: "",
    customerAppUrl:
      "https://play.google.com/store/apps/details?id=tech.thewolfgang.queueless.customer",
    vendorAppUrl:
      "https://play.google.com/store/apps/details?id=tech.thewolfgang.queueless.vendor",
    // Keep in sync with customer/config.js, vendor/config.js, android-vendor versionName.
    customerAppVersion: "1.4.0",
    vendorWebVersion: "1.4.0",
    vendorAppVersion: "1.4.0",
  };
})();
