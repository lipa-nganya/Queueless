/* global importScripts, firebase */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

const DEFAULT_API_ORIGINS = {
  local: "http://localhost:4000",
  staging: "https://queueless-staging.up.railway.app",
};

function resolveApiOrigin() {
  try {
    const host = self.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return DEFAULT_API_ORIGINS.local;
  } catch {
    /* ignore */
  }
  return DEFAULT_API_ORIGINS.staging;
}

async function loadFirebaseWebConfig() {
  if (self.QUEUELESS_FIREBASE_WEB?.apiKey && self.QUEUELESS_FIREBASE_WEB?.appId) {
    return self.QUEUELESS_FIREBASE_WEB;
  }
  try {
    const local = await fetch("./firebase-web-config.js", { cache: "no-store" });
    if (local.ok) {
      const text = await local.text();
      // Evaluate config assignment safely by extracting JSON after first "="
      const match = text.match(/self\.QUEUELESS_FIREBASE_WEB\s*=\s*(\{[\s\S]*?\}|null)\s*;/);
      if (match?.[1] && match[1] !== "null") {
        const cfg = JSON.parse(match[1]);
        if (cfg?.apiKey) {
          self.QUEUELESS_FIREBASE_WEB = cfg;
          return cfg;
        }
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const response = await fetch(`${resolveApiOrigin()}/api/vendor/push-config`, {
      headers: { Accept: "application/json" },
    });
    const data = await response.json();
    if (data?.enabled && data.config) {
      self.QUEUELESS_FIREBASE_WEB = data.config;
      return data.config;
    }
  } catch (error) {
    console.error("[queueless-sw] config fetch failed", error);
  }
  return null;
}

async function initMessaging() {
  const config = await loadFirebaseWebConfig();
  if (!config?.apiKey || !config?.projectId || !config?.appId) return;
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      });
    }
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title =
        payload.notification?.title ||
        payload.data?.title ||
        "Queueless Vendor";
      const body =
        payload.notification?.body ||
        payload.data?.body ||
        "You have a new update.";
      const data = payload.data || {};
      self.registration.showNotification(title, {
        body,
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        tag: data.type || "queueless-vendor",
        renotify: true,
        data,
      });
    });
  } catch (error) {
    console.error("[queueless-sw] init failed", error);
  }
}

void initMessaging();

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const businessId = String(data.business_id || "").trim();
  const kind = String(data.type || "");
  let targetUrl = data.link || data.url || "./";
  if (businessId && (kind === "queue_join" || kind === "queue_leave")) {
    targetUrl = `./#queue-${businessId}`;
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.postMessage({
            type: "queueless-push-click",
            data,
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
