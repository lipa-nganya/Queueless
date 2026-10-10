/**
 * Vendor web push service worker.
 *
 * Handles FCM web pushes directly instead of through the Firebase SDK: the
 * browser can start this worker just to deliver a push, and listeners must be
 * registered synchronously during that first evaluation or the push is lost.
 * The page still uses the Firebase SDK to obtain the FCM token.
 */

function parsePush(event) {
  if (!event.data) return { data: {} };
  try {
    const payload = event.data.json();
    const data = payload?.data || {};
    const notification = payload?.notification || {};
    return {
      title: notification.title || data.title || "Queueless Vendor",
      body: notification.body || data.body || data.message || "You have a new update.",
      data,
    };
  } catch {
    return { title: "Queueless Vendor", body: event.data.text(), data: {} };
  }
}

function queueTarget(data = {}) {
  const businessId = String(data.business_id || "").trim();
  const kind = String(data.type || "");
  if (businessId && (kind === "queue_join" || kind === "queue_leave")) {
    return `#queue-${businessId}`;
  }
  return "";
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const { title, body, data } = parsePush(event);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const visible = clients.filter((client) => client.visibilityState === "visible");
      for (const client of clients) {
        client.postMessage({
          type: "queueless-push",
          title,
          body,
          data,
          shown: visible.length === 0,
        });
      }
      if (visible.length) return undefined;
      return self.registration.showNotification(title, {
        body,
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        tag: data.entry_id ? `${data.type}-${data.entry_id}` : `${data.type || "queueless"}-${Date.now()}`,
        data,
      });
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const hash = queueTarget(data);
  const targetUrl = new URL(`/${hash}`, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const client = clients.find((c) => new URL(c.url).origin === self.location.origin);
      if (client) {
        client.postMessage({ type: "queueless-push-click", data });
        await client.focus();
        if (hash && !client.url.endsWith(hash) && "navigate" in client) {
          try {
            await client.navigate(targetUrl);
          } catch {
            /* uncontrolled clients cannot be navigated; the postMessage handles it */
          }
        }
        return undefined;
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
    })
  );
});
