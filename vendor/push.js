/**
 * Vendor web push (FCM) + custom in-app notification toasts.
 * Matches Android push events: activation, trial, queue join/leave.
 */
const FIREBASE_APP_CDN = "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js";
const FIREBASE_MSG_CDN =
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js";

let messagingInstance = null;
let initPromise = null;
let lastToken = null;

function apiOrigin() {
  const configured = String(window.QUEUELESS_API_ORIGIN || "").replace(/\/$/, "");
  if (configured) return configured;
  if (["localhost", "127.0.0.1"].includes(location.hostname)) {
    return "http://localhost:4000";
  }
  return location.origin;
}

function ensureToastRoot() {
  let root = document.getElementById("push-toast-root");
  if (root) return root;
  root = document.createElement("div");
  root.id = "push-toast-root";
  root.className = "push-toast-root";
  root.setAttribute("aria-live", "polite");
  root.setAttribute("aria-relevant", "additions");
  document.body.appendChild(root);
  return root;
}

export function showVendorToast({
  title = "Queueless",
  body = "",
  type = "info",
  timeoutMs = 7000,
} = {}) {
  const root = ensureToastRoot();
  const toast = document.createElement("article");
  toast.className = `push-toast push-toast-${String(type || "info").replace(/[^\w-]/g, "")}`;
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <div class="push-toast-accent" aria-hidden="true"></div>
    <div class="push-toast-copy">
      <strong class="push-toast-title"></strong>
      <p class="push-toast-body"></p>
    </div>
    <button type="button" class="push-toast-close" aria-label="Dismiss">✕</button>
  `;
  toast.querySelector(".push-toast-title").textContent = title;
  toast.querySelector(".push-toast-body").textContent = body;
  const remove = () => {
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 220);
  };
  toast.querySelector(".push-toast-close").addEventListener("click", remove);
  toast.addEventListener("click", (event) => {
    if (event.target.closest(".push-toast-close")) return;
    remove();
  });
  root.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  if (timeoutMs > 0) window.setTimeout(remove, timeoutMs);
  return toast;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some((script) => script.src === src)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function fetchPushConfig() {
  if (
    window.QUEUELESS_FIREBASE_WEB?.apiKey &&
    window.QUEUELESS_FIREBASE_WEB?.vapidKey &&
    window.QUEUELESS_FIREBASE_WEB?.appId
  ) {
    return window.QUEUELESS_FIREBASE_WEB;
  }
  const response = await fetch(`${apiOrigin()}/api/vendor/push-config`, {
    headers: { Accept: "application/json" },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.enabled || !data.config) {
    return null;
  }
  window.QUEUELESS_FIREBASE_WEB = data.config;
  return data.config;
}

function writeServiceWorkerConfig(config) {
  window.QUEUELESS_FIREBASE_WEB = config;
}

function navigateFromPushData(data = {}) {
  const businessId = String(data.business_id || "").trim();
  const kind = String(data.type || "");
  if (
    businessId &&
    (kind === "queue_join" || kind === "queue_leave") &&
    !location.hash.startsWith(`#queue-${businessId}`)
  ) {
    location.hash = `queue-${businessId}`;
  }
}

async function ensureMessaging() {
  if (messagingInstance) return messagingInstance;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return null;
    }
    const config = await fetchPushConfig();
    if (!config?.vapidKey) return null;
    writeServiceWorkerConfig(config);
    await loadScript(FIREBASE_APP_CDN);
    await loadScript(FIREBASE_MSG_CDN);
    if (!window.firebase) return null;

    if (!window.firebase.apps.length) {
      window.firebase.initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      });
    }

    const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js", {
      scope: "./",
    });
    await navigator.serviceWorker.ready;

    // Refresh SW config file content for next activation when using local server.
    try {
      await fetch("./firebase-web-config.js", { cache: "reload" });
    } catch {
      /* ignore */
    }

    messagingInstance = window.firebase.messaging();
    messagingInstance.onMessage((payload) => {
      const data = payload.data || {};
      const title =
        payload.notification?.title || data.title || "Queueless Vendor";
      const body =
        payload.notification?.body || data.body || data.message || "You have a new update.";
      const type = data.type || "info";
      const toast = showVendorToast({ title, body, type });
      toast.addEventListener("click", (event) => {
        if (event.target.closest(".push-toast-close")) return;
        navigateFromPushData(data);
      });
      if (document.visibilityState === "hidden" && Notification.permission === "granted") {
        try {
          new Notification(title, {
            body,
            icon: "./favicon.svg",
            tag: type,
            data,
          });
        } catch {
          /* ignore */
        }
      }
    });

    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "queueless-push-click") {
        navigateFromPushData(event.data?.data || {});
      }
    });

    void registration;
    return messagingInstance;
  })();
  try {
    return await initPromise;
  } catch (error) {
    console.warn("[push] init failed", error);
    initPromise = null;
    return null;
  }
}

async function postToken({ token, authToken = null, phone = null }) {
  const headers = { "Content-Type": "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const path = authToken ? "/api/vendor/push-tokens" : "/api/vendor/push-tokens/pending";
  const body = authToken
    ? {
        token,
        platform: "web",
        device_label: navigator.userAgent.slice(0, 120),
      }
    : {
        phone,
        token,
        platform: "web",
        device_label: navigator.userAgent.slice(0, 120),
      };
  const response = await fetch(`${apiOrigin()}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Could not register push token.");
  }
}

/**
 * Request permission (if needed), get FCM token, register with API.
 * @param {{ authToken?: string|null, phone?: string|null, interactive?: boolean }} options
 */
export async function registerVendorWebPush({
  authToken = null,
  phone = null,
  interactive = false,
} = {}) {
  try {
    if (!authToken && !phone) return { ok: false, reason: "no_session" };
    const messaging = await ensureMessaging();
    if (!messaging) return { ok: false, reason: "unavailable" };

    let permission = Notification.permission;
    if (permission === "default" && interactive) {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      return { ok: false, reason: "permission_denied" };
    }

    const config = window.QUEUELESS_FIREBASE_WEB;
    const token = await messaging.getToken({
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    });
    if (!token) return { ok: false, reason: "no_token" };
    if (token === lastToken) return { ok: true, reason: "unchanged", token };
    await postToken({ token, authToken, phone });
    lastToken = token;
    return { ok: true, token };
  } catch (error) {
    console.warn("[push] register failed", error);
    return { ok: false, reason: "error", error: error.message };
  }
}

export async function promptVendorWebPush(authToken) {
  const result = await registerVendorWebPush({ authToken, interactive: true });
  if (result.ok && result.reason !== "unchanged") {
    showVendorToast({
      title: "Notifications on",
      body: "You’ll get activation, trial, and queue alerts in this browser.",
      type: "vendor_push_ready",
    });
  }
  return result;
}
