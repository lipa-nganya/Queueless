import { accessibilityIconSvg } from "./accessibility-icons.js";

const API_ORIGIN =
  window.QUEUELESS_API_ORIGIN ||
  (["localhost", "127.0.0.1"].includes(location.hostname)
    ? "http://localhost:4000"
    : location.origin);
const API_BASE = `${API_ORIGIN}/api`;
const TOKEN_KEY = "queueless_vendor_token";
const POLL_MS = 8000;
const POLL_MS_EMPTY = 20000;
const POLL_MS_BUSY = 12000;

const app = document.getElementById("app");

let pollTimer = null;
let selectedBusinessId = null;

function queuePollDelay(waitingTotal = 0) {
  const n = Number(waitingTotal) || 0;
  if (n <= 0) return POLL_MS_EMPTY;
  if (n <= 3) return POLL_MS;
  return POLL_MS_BUSY;
}

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function schedulePoll(fn, delayMs = POLL_MS) {
  stopPolling();
  if (document.hidden) return;
  pollTimer = setTimeout(fn, delayMs);
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const WEEK_DAYS = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" },
];

const ACCESSIBILITY_OPTIONS = [
  { id: "wheelchair", label: "Wheelchair Accessible", description: "Step-free entrance and spaces/routes usable by wheelchair users" },
  { id: "blind_low_vision", label: "Blind & Low-Vision Friendly", description: "Staff/environment can reasonably assist blind or low-vision customers" },
  { id: "deaf_hard_of_hearing", label: "Deaf & Hard-of-Hearing Friendly", description: "Communication accommodations are available beyond spoken communication" },
  { id: "sign_language", label: "Sign Language Available", description: "At least one staff member or service option can communicate in sign language" },
  { id: "autism_friendly", label: "Autism-Friendly", description: "Accommodations are available for autistic customers, such as reduced sensory stimulation or flexible service" },
  { id: "quiet_low_sensory", label: "Quiet / Low-Sensory Space Available", description: "A quieter waiting or service area is available" },
  { id: "accessible_seating", label: "Accessible Seating Available", description: "Seating accommodates customers with mobility needs" },
  { id: "accessible_restroom", label: "Accessible Restroom Available", description: "An accessible toilet/restroom is available on the premises" },
  { id: "assistance_animals", label: "Assistance Animals Welcome", description: "Customers using trained assistance/service animals are accommodated" },
  { id: "support_person", label: "Support Person Welcome", description: "A customer may be accompanied by a caregiver, interpreter, aide, or other support person" },
];

function accessibilityEditorHtml(selectedIds = []) {
  const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  return `
    <div class="a11y-options" role="group" aria-label="Accessibility options">
      ${ACCESSIBILITY_OPTIONS.map(
        (option) => `
          <label class="a11y-option">
            <input type="checkbox" name="accessibility_options" value="${option.id}" ${selected.has(option.id) ? "checked" : ""} />
            <span class="a11y-icon" aria-hidden="true">${accessibilityIconSvg(option.id)}</span>
            <span class="a11y-copy">
              <strong>${escapeHtml(option.label)}</strong>
              <small>${escapeHtml(option.description)}</small>
            </span>
          </label>
        `
      ).join("")}
    </div>
  `;
}

function readAccessibilityOptions(root) {
  if (!root) return [];
  return [...root.querySelectorAll('input[name="accessibility_options"]:checked')].map((el) => el.value);
}

function setAccessibilityOptions(root, selectedIds = []) {
  if (!root) return;
  const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  root.querySelectorAll('input[name="accessibility_options"]').forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function defaultHoursSchedule() {
  return WEEK_DAYS.map((d) => ({
    day: d.key,
    open: d.key !== "sat" && d.key !== "sun",
    start: "08:00",
    end: "18:00",
  }));
}

function parseHoursSchedule(value) {
  if (Array.isArray(value) && value.length) {
    const byDay = new Map(defaultHoursSchedule().map((d) => [d.day, { ...d }]));
    for (const item of value) {
      const key = String(item?.day || "").toLowerCase();
      if (!byDay.has(key)) continue;
      byDay.set(key, {
        day: key,
        open: Boolean(item.open),
        start: item.start || "08:00",
        end: item.end || "18:00",
      });
    }
    return WEEK_DAYS.map((d) => byDay.get(d.key));
  }
  const raw = String(value || "").trim();
  if (raw.startsWith("[")) {
    try {
      return parseHoursSchedule(JSON.parse(raw));
    } catch {
      /* fall through */
    }
  }
  return defaultHoursSchedule();
}

function mountHoursEditor(root, schedule = defaultHoursSchedule()) {
  const days = parseHoursSchedule(schedule);
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Weekly business hours");
  root.innerHTML = days
    .map((day) => {
      const meta = WEEK_DAYS.find((d) => d.key === day.day);
      const dayLabel = meta?.label || day.day;
      return `
        <div class="hours-day-row${day.open ? "" : " is-closed"}" data-day="${day.day}">
          <div class="hours-day-label" id="hours-label-${day.day}">${dayLabel}</div>
          <button
            type="button"
            class="hours-day-toggle${day.open ? " is-open" : ""}"
            aria-pressed="${day.open ? "true" : "false"}"
            aria-label="${escapeHtml(dayLabel)}: ${day.open ? "Open" : "Closed"}. Toggle open or closed"
          >${day.open ? "Open" : "Closed"}</button>
          <input
            class="hours-start"
            type="time"
            value="${day.start}"
            ${day.open ? "" : "disabled"}
            aria-label="${escapeHtml(dayLabel)} start time"
          />
          <span class="hours-sep" aria-hidden="true">to</span>
          <input
            class="hours-end"
            type="time"
            value="${day.end}"
            ${day.open ? "" : "disabled"}
            aria-label="${escapeHtml(dayLabel)} end time"
          />
        </div>
      `;
    })
    .join("");

  root.querySelectorAll(".hours-day-row").forEach((row) => {
    const dayKey = row.dataset.day;
    const dayLabel = WEEK_DAYS.find((d) => d.key === dayKey)?.label || dayKey;
    const toggle = row.querySelector(".hours-day-toggle");
    const start = row.querySelector(".hours-start");
    const end = row.querySelector(".hours-end");
    const sync = (open) => {
      toggle.textContent = open ? "Open" : "Closed";
      toggle.classList.toggle("is-open", open);
      toggle.setAttribute("aria-pressed", open ? "true" : "false");
      toggle.setAttribute(
        "aria-label",
        `${dayLabel}: ${open ? "Open" : "Closed"}. Toggle open or closed`
      );
      start.disabled = !open;
      end.disabled = !open;
      row.classList.toggle("is-closed", !open);
    };
    toggle.addEventListener("click", () => {
      const next = toggle.getAttribute("aria-pressed") !== "true";
      sync(next);
    });
  });
}

function readHoursSchedule(root) {
  return WEEK_DAYS.map((day) => {
    const row = root.querySelector(`.hours-day-row[data-day="${day.key}"]`);
    return {
      day: day.key,
      open: row?.querySelector(".hours-day-toggle")?.getAttribute("aria-pressed") === "true",
      start: row?.querySelector(".hours-start")?.value || "08:00",
      end: row?.querySelector(".hours-end")?.value || "18:00",
    };
  });
}

function formatWaitMinutes(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}min`;
}

function viewFromHash() {
  return (location.hash || "#login").replace(/^#/, "") || "login";
}

function go(view) {
  location.hash = view;
  render();
}

function focusPage({ preferSelector = null } = {}) {
  requestAnimationFrame(() => {
    const preferred = preferSelector ? document.querySelector(preferSelector) : null;
    const target =
      preferred ||
      document.querySelector(
        "#main-content .page-title, .login-card h1, #phone, #pin, #otp, #main-content"
      );
    if (!target) return;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    try {
      target.focus({ preventScroll: true });
    } catch {
      target.focus();
    }
  });
}

function captureFocusKey() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  return el.getAttribute("data-focus-key") || el.id || null;
}

function restoreFocusKey(key) {
  if (!key) return false;
  const target =
    document.querySelector(`[data-focus-key="${CSS.escape(key)}"]`) ||
    document.getElementById(key);
  if (!target || typeof target.focus !== "function") return false;
  try {
    target.focus({ preventScroll: true });
  } catch {
    target.focus();
  }
  return true;
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && getToken() && !String(path).startsWith("/vendor/login")) {
    clearToken();
    go("login");
    throw new Error(data.error || "Session expired. Please sign in again.");
  }
  if (!response.ok) {
    const error = new Error(data.error || "Request failed.");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

const PENDING_VENDOR_PHONE_KEY = "queueless_vendor_pending_phone";
const PENDING_VENDOR_PURPOSE_KEY = "queueless_vendor_otp_purpose";

function normalizeLocalPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function pinFieldHtml({ id, label }) {
  return `
    <div class="field">
      <label for="${id}">${label}</label>
      <input id="${id}" name="${id}" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="one-time-code" required />
    </div>
  `;
}

function appVersion() {
  return String(window.QUEUELESS_VENDOR_APP_VERSION || "1.0.0").trim() || "1.0.0";
}

function appVersionHtml({ onDark = false } = {}) {
  return `<p class="app-version${onDark ? " app-version-on-dark" : ""}">v${escapeHtml(appVersion())}</p>`;
}

function renderLogin() {
  stopPolling();
  app.innerHTML = `
    <div class="login-shell">
      <main id="main-content" class="login-stack" tabindex="-1">
        <form class="login-card" id="phone-form">
          <h1>Queue<span>less</span></h1>
          <p>Vendor sign in — use your phone number.</p>
          <div class="field">
            <label for="phone">Phone number</label>
            <input id="phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="07XXXXXXXX" required />
          </div>
          <button class="btn btn-primary btn-block" style="margin-top:1.2rem" type="submit">Continue</button>
          <p class="message" id="login-message" role="status"></p>
        </form>
        ${appVersionHtml({ onDark: true })}
      </main>
    </div>
  `;
  focusPage({ preferSelector: "#phone" });

  document.getElementById("phone-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const phone = normalizeLocalPhone(document.getElementById("phone").value);
    const message = document.getElementById("login-message");
    const button = event.currentTarget.querySelector("button[type=submit]");
    message.textContent = "";
    button.disabled = true;
    try {
      const status = await api("/vendor/phone-status", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      localStorage.setItem(PENDING_VENDOR_PHONE_KEY, status.phone);
      if (status.has_pin) {
        go("pin");
        return;
      }
      localStorage.setItem(PENDING_VENDOR_PURPOSE_KEY, "setup");
      await api("/vendor/request-otp", {
        method: "POST",
        body: JSON.stringify({ phone: status.phone, purpose: "setup" }),
      });
      go("otp");
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

function renderPinLogin() {
  stopPolling();
  const phone = localStorage.getItem(PENDING_VENDOR_PHONE_KEY) || "";
  app.innerHTML = `
    <div class="login-shell">
      <main id="main-content" class="login-stack" tabindex="-1">
        <form class="login-card" id="pin-form">
          <h1>Queue<span>less</span></h1>
          <p>Enter your 4-digit PIN for <strong>+${escapeHtml(phone)}</strong>.</p>
          ${pinFieldHtml({ id: "pin", label: "PIN" })}
          <button class="btn btn-primary btn-block" style="margin-top:1.2rem" type="submit">Sign in</button>
          <button class="btn-link" type="button" id="forgot-pin" style="margin-top:0.85rem">Forgot PIN?</button>
          <button class="btn-link" type="button" id="back-phone">Use a different number</button>
          <p class="message" id="login-message" role="status"></p>
        </form>
        ${appVersionHtml({ onDark: true })}
      </main>
    </div>
  `;
  focusPage({ preferSelector: "#pin" });

  document.getElementById("back-phone").onclick = () => {
    localStorage.removeItem(PENDING_VENDOR_PHONE_KEY);
    go("login");
  };
  document.getElementById("forgot-pin").onclick = async () => {
    const message = document.getElementById("login-message");
    try {
      localStorage.setItem(PENDING_VENDOR_PURPOSE_KEY, "forgot");
      await api("/vendor/request-otp", {
        method: "POST",
        body: JSON.stringify({ phone, purpose: "forgot" }),
      });
      go("otp");
    } catch (error) {
      message.textContent = error.message;
    }
  };

  document.getElementById("pin-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const pin = document.getElementById("pin").value.trim();
    const message = document.getElementById("login-message");
    const button = event.currentTarget.querySelector("button[type=submit]");
    message.textContent = "";
    button.disabled = true;
    try {
      const session = await api("/vendor/login", {
        method: "POST",
        body: JSON.stringify({ phone, pin }),
      });
      setToken(session.token);
      localStorage.removeItem(PENDING_VENDOR_PHONE_KEY);
      localStorage.removeItem(PENDING_VENDOR_PURPOSE_KEY);
      go("businesses");
    } catch (error) {
      if (error.data?.needs_otp) {
        localStorage.setItem(PENDING_VENDOR_PURPOSE_KEY, "setup");
        try {
          await api("/vendor/request-otp", {
            method: "POST",
            body: JSON.stringify({ phone, purpose: "setup" }),
          });
          go("otp");
          return;
        } catch (otpError) {
          message.textContent = otpError.message;
          return;
        }
      }
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

function renderOtp() {
  stopPolling();
  const phone = localStorage.getItem(PENDING_VENDOR_PHONE_KEY) || "";
  const purpose = localStorage.getItem(PENDING_VENDOR_PURPOSE_KEY) || "setup";
  app.innerHTML = `
    <div class="login-shell">
      <main id="main-content" class="login-stack" tabindex="-1">
        <form class="login-card" id="otp-form">
          <h1>Queue<span>less</span></h1>
          <p>Enter the 4-digit code sent to <strong>+${escapeHtml(phone)}</strong>.</p>
          ${pinFieldHtml({ id: "otp", label: "SMS code" })}
          <button class="btn btn-primary btn-block" style="margin-top:1.2rem" type="submit">Verify code</button>
          <button class="btn-link" type="button" id="resend-otp">Resend code</button>
          <button class="btn-link" type="button" id="back-phone">Use a different number</button>
          <p class="message" id="login-message" role="status"></p>
        </form>
        ${appVersionHtml({ onDark: true })}
      </main>
    </div>
  `;
  focusPage({ preferSelector: "#otp" });

  document.getElementById("back-phone").onclick = () => {
    localStorage.removeItem(PENDING_VENDOR_PHONE_KEY);
    localStorage.removeItem(PENDING_VENDOR_PURPOSE_KEY);
    go("login");
  };
  document.getElementById("resend-otp").onclick = async () => {
    const message = document.getElementById("login-message");
    try {
      const result = await api("/vendor/resend-otp", {
        method: "POST",
        body: JSON.stringify({ phone, purpose }),
      });
      message.textContent = result.message || "Code sent.";
      message.classList.add("success");
    } catch (error) {
      message.textContent = error.message;
      message.classList.remove("success");
    }
  };

  document.getElementById("otp-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const otp = document.getElementById("otp").value.trim();
    const message = document.getElementById("login-message");
    const button = event.currentTarget.querySelector("button[type=submit]");
    message.textContent = "";
    button.disabled = true;
    try {
      await api("/vendor/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, otp }),
      });
      sessionStorage.setItem("queueless_vendor_verified_otp", otp);
      go("set-pin");
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

function renderSetPin() {
  stopPolling();
  const phone = localStorage.getItem(PENDING_VENDOR_PHONE_KEY) || "";
  app.innerHTML = `
    <div class="login-shell">
      <main id="main-content" class="login-stack" tabindex="-1">
        <form class="login-card" id="set-pin-form">
          <h1>Queue<span>less</span></h1>
          <p>Create a 4-digit PIN for <strong>+${escapeHtml(phone)}</strong>.</p>
          ${pinFieldHtml({ id: "pin", label: "New PIN" })}
          ${pinFieldHtml({ id: "confirm_pin", label: "Confirm PIN" })}
          <button class="btn btn-primary btn-block" style="margin-top:1.2rem" type="submit">Save PIN &amp; sign in</button>
          <button class="btn-link" type="button" id="back-otp">Back</button>
          <p class="message" id="login-message" role="status"></p>
        </form>
        ${appVersionHtml({ onDark: true })}
      </main>
    </div>
  `;
  focusPage({ preferSelector: "#pin" });

  document.getElementById("back-otp").onclick = () => go("otp");

  document.getElementById("set-pin-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const pin = document.getElementById("pin").value.trim();
    const confirmPin = document.getElementById("confirm_pin").value.trim();
    const message = document.getElementById("login-message");
    const button = event.currentTarget.querySelector("button[type=submit]");
    message.textContent = "";
    button.disabled = true;
    try {
      const session = await api("/vendor/set-pin", {
        method: "POST",
        body: JSON.stringify({
          phone,
          pin,
          confirm_pin: confirmPin,
          otp: sessionStorage.getItem("queueless_vendor_verified_otp") || undefined,
        }),
      });
      setToken(session.token);
      localStorage.removeItem(PENDING_VENDOR_PHONE_KEY);
      localStorage.removeItem(PENDING_VENDOR_PURPOSE_KEY);
      sessionStorage.removeItem("queueless_vendor_verified_otp");
      go("businesses");
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

function topbar({
  back = false,
  title = "",
  servicesFor = null,
  branchesFor = null,
  profileFor = null,
  current = null,
} = {}) {
  return `
    <header class="topbar">
      <div style="display:flex;align-items:center;gap:.6rem">
        ${back ? `<button type="button" class="back-btn" id="back-btn" aria-label="Back to previous screen">←</button>` : ""}
        <div>
          <p class="brand">Queue<span>less</span> Vendor</p>
          ${title ? `<div class="page-sub">${escapeHtml(title)}</div>` : ""}
          ${appVersionHtml()}
        </div>
      </div>
      <nav class="topbar-actions" aria-label="Vendor actions">
        ${
          profileFor
            ? `<button class="btn btn-secondary" type="button" id="profile-btn"${
                current === "hours" ? ' aria-current="page"' : ""
              }>Hours</button>`
            : ""
        }
        ${
          branchesFor
            ? `<button class="btn btn-secondary" type="button" id="branches-btn"${
                current === "branches" ? ' aria-current="page"' : ""
              }>Branches</button>`
            : ""
        }
        ${
          servicesFor
            ? `<button class="btn btn-secondary" type="button" id="services-btn"${
                current === "services" ? ' aria-current="page"' : ""
              }>Services</button>`
            : ""
        }
        <button class="btn btn-secondary" type="button" id="logout-btn">Sign out</button>
      </nav>
    </header>
  `;
}

function bindChrome({
  backTo = "businesses",
  servicesFor = null,
  branchesFor = null,
  profileFor = null,
} = {}) {
  document.getElementById("logout-btn")?.addEventListener("click", () => {
    stopPolling();
    clearToken();
    selectedBusinessId = null;
    go("login");
  });
  document.getElementById("back-btn")?.addEventListener("click", () => {
    stopPolling();
    go(backTo);
  });
  document.getElementById("services-btn")?.addEventListener("click", () => {
    stopPolling();
    const id = servicesFor || selectedBusinessId;
    if (id) go(`services-${id}`);
  });
  document.getElementById("branches-btn")?.addEventListener("click", () => {
    stopPolling();
    const id = branchesFor || selectedBusinessId;
    if (id) go(`branches-${id}`);
  });
  document.getElementById("profile-btn")?.addEventListener("click", () => {
    stopPolling();
    const id = profileFor || selectedBusinessId;
    if (id) go(`profile-${id}`);
  });
}

async function renderBusinesses() {
  stopPolling();
  app.innerHTML = `
    <div class="shell">
      ${topbar()}
      <main id="main-content" tabindex="-1">
        <h1 class="page-title">Your businesses</h1>
        <p class="page-sub">Pick a business to manage its live queue.</p>
        <p class="empty" id="biz-loading" role="status">Loading…</p>
        <div class="biz-list" id="biz-list" role="list"></div>
        <p class="message" id="page-message" role="status" aria-live="polite"></p>
      </main>
    </div>
  `;
  bindChrome();
  focusPage();

  const list = document.getElementById("biz-list");
  const loading = document.getElementById("biz-loading");
  const message = document.getElementById("page-message");

  try {
    const businesses = await api("/vendor/businesses");
    loading.remove();
    if (!businesses.length) {
      list.innerHTML = `<p class="empty" role="status">No businesses assigned yet. Ask an admin to link you to a business.</p>`;
      return;
    }

    // One business → jump straight into the queue desk.
    if (businesses.length === 1) {
      selectedBusinessId = businesses[0].id;
      go(`queue-${businesses[0].id}`);
      return;
    }

    list.innerHTML = businesses
      .map(
        (business) => `
          <button type="button" class="biz-card" role="listitem" data-id="${business.id}" aria-label="${escapeHtml(
            business.name
          )}, ${business.is_active ? "Active" : "Inactive"}, ${business.waiting_total ?? 0} waiting">
            <div>
              <h2>${escapeHtml(business.name)}</h2>
              <div class="meta">
                ${escapeHtml(business.business_group_name || "")}
                ${business.location ? ` · ${escapeHtml(business.location)}` : ""}
              </div>
              <span class="pill ${business.is_active ? "pill-active" : "pill-inactive"}">
                ${business.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div class="biz-waiting">
              <strong aria-hidden="true">${business.waiting_total ?? 0}</strong>
              <span aria-hidden="true">waiting</span>
            </div>
          </button>
        `
      )
      .join("");

    list.querySelectorAll(".biz-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedBusinessId = Number(btn.dataset.id);
        go(`queue-${btn.dataset.id}`);
      });
    });
  } catch (error) {
    loading.textContent = "";
    message.textContent = error.message;
  }
}

async function renderQueue(businessId) {
  selectedBusinessId = businessId;
  app.innerHTML = `
    <div class="shell">
      ${topbar({ back: true, title: "Live queue", servicesFor: businessId, branchesFor: businessId, profileFor: businessId, current: "queue" })}
      <main id="main-content" tabindex="-1">
        <div id="queue-root"><p class="empty" role="status">Loading queue…</p></div>
        <p class="message" id="page-message" role="status" aria-live="polite"></p>
      </main>
    </div>
  `;
  bindChrome({ backTo: "businesses", servicesFor: businessId, branchesFor: businessId, profileFor: businessId });
  await refreshQueue(businessId, { initial: true });
}

async function refreshQueue(businessId, { initial = false } = {}) {
  if (viewFromHash() !== `queue-${businessId}`) {
    stopPolling();
    return;
  }

  const root = document.getElementById("queue-root");
  const message = document.getElementById("page-message");
  if (!root) return;

  const focusKey = initial ? null : captureFocusKey();

  try {
    const data = await api(`/vendor/businesses/${businessId}/queue`);
    const business = data.business;
    const entries = data.entries || [];

    root.innerHTML = `
      <h1 class="page-title">${escapeHtml(business.name)}</h1>
      <p class="page-sub">${escapeHtml(business.business_group_name || "")}${
        business.location ? ` · ${escapeHtml(business.location)}` : ""
      }</p>
      <p class="sr-only" id="queue-live" aria-live="polite">
        ${
          entries.length
            ? `Now serving ${escapeHtml(entries[0].customer_first_name || "customer")}. ${
                business.waiting_total ?? 0
              } people waiting.`
            : "Queue is clear."
        }
      </p>

      <div class="stats" aria-label="Queue statistics">
        <div class="stat">
          <strong>${business.waiting_total ?? 0}</strong>
          <span>Total waiting</span>
        </div>
        <div class="stat">
          <strong>${business.app_waiting ?? entries.length}</strong>
          <span>In app</span>
        </div>
        <div class="stat">
          <strong>${business.queue_size ?? 0}</strong>
          <span>Walk-ins</span>
        </div>
      </div>

      <div class="walkins">
        <div class="walkins-copy">
          <strong id="walkin-label">Walk-in baseline</strong>
          <span>People physically in line who did not join via the app</span>
        </div>
        <div class="stepper" role="group" aria-labelledby="walkin-label">
          <button type="button" id="walkin-dec" data-focus-key="walkin-dec" aria-label="Decrease walk-ins">−</button>
          <strong id="walkin-count" aria-live="polite" aria-atomic="true">${business.queue_size ?? 0}</strong>
          <button type="button" id="walkin-inc" data-focus-key="walkin-inc" aria-label="Increase walk-ins">+</button>
        </div>
      </div>

      ${
        !entries.length
          ? `<p class="empty" role="status">Queue is clear. Waiting for the next customer.</p>`
          : `<div class="queue-list" role="list" aria-label="Customers in queue">
              ${entries
                .map((entry, index) => {
                  const isNow = index === 0;
                  const name = entry.customer_first_name || "Customer";
                  const partyLabel =
                    entry.party_size > 1 ? `, party of ${entry.party_size}` : "";
                  return `
                    <article class="queue-card${isNow ? " now" : ""}" role="listitem" aria-label="${escapeHtml(
                      name
                    )}${partyLabel}, ${isNow ? "now serving" : `position ${entry.position}`}, estimated wait ${escapeHtml(
                      formatWaitMinutes(entry.estimated_wait_minutes)
                    )}">
                      <div class="queue-card-head">
                        <div>
                          <div class="queue-pos">${isNow ? "Now serving" : `Position #${entry.position}`}</div>
                          <h2>${escapeHtml(name)}${
                            entry.party_size > 1
                              ? ` <span class="party-badge" aria-label="plus ${
                                  entry.party_size - 1
                                } more">+${entry.party_size - 1}</span>`
                              : ""
                          }</h2>
                          <div class="phone">+${escapeHtml(entry.customer_phone || "")}</div>
                          ${
                            entry.party_size > 1
                              ? `<div class="party-meta">Party of ${entry.party_size}${
                                  Array.isArray(entry.party_names) && entry.party_names.length
                                    ? ` · ${escapeHtml(entry.party_names.join(", "))}`
                                    : ""
                                }</div>`
                              : Array.isArray(entry.party_names) && entry.party_names.length > 1
                                ? `<div class="party-meta">${escapeHtml(entry.party_names.join(", "))}</div>`
                                : ""
                          }
                        </div>
                        <div class="queue-wait">
                          <strong>${escapeHtml(formatWaitMinutes(entry.estimated_wait_minutes))}</strong>
                          est. wait
                        </div>
                      </div>
                      ${
                        isNow
                          ? `<div class="queue-actions">
                              <button class="btn btn-primary btn-lg serve-btn" type="button" data-id="${entry.id}" data-focus-key="serve-${entry.id}" aria-label="Serve ${escapeHtml(name)}">Serve</button>
                              <button class="btn btn-danger no-show-btn" type="button" data-id="${entry.id}" data-focus-key="noshow-${entry.id}" aria-label="Mark ${escapeHtml(name)} as no-show">No-show</button>
                            </div>`
                          : ""
                      }
                    </article>
                  `;
                })
                .join("")}
            </div>`
      }
    `;

    if (message && initial) message.textContent = "";
    if (initial) focusPage();
    else restoreFocusKey(focusKey);

    const setWalkIns = async (next) => {
      const value = Math.max(0, Math.min(500, next));
      try {
        await api(`/vendor/businesses/${businessId}/walk-ins`, {
          method: "PUT",
          body: JSON.stringify({ queue_size: value }),
        });
        await refreshQueue(businessId);
      } catch (error) {
        if (message) message.textContent = error.message;
      }
    };

    document.getElementById("walkin-dec")?.addEventListener("click", () =>
      setWalkIns((business.queue_size || 0) - 1)
    );
    document.getElementById("walkin-inc")?.addEventListener("click", () =>
      setWalkIns((business.queue_size || 0) + 1)
    );

    root.querySelectorAll(".serve-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await api(`/vendor/queue/${btn.dataset.id}/serve`, { method: "POST" });
          await refreshQueue(businessId);
        } catch (error) {
          if (message) message.textContent = error.message;
          btn.disabled = false;
        }
      });
    });

    root.querySelectorAll(".no-show-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await api(`/vendor/queue/${btn.dataset.id}/no-show`, { method: "POST" });
          await refreshQueue(businessId);
        } catch (error) {
          if (message) message.textContent = error.message;
          btn.disabled = false;
        }
      });
    });

    schedulePoll(
      () => refreshQueue(businessId),
      queuePollDelay(business.waiting_total ?? entries.length)
    );
  } catch (error) {
    if (initial) {
      root.innerHTML = `<p class="empty" role="status">${escapeHtml(error.message)}</p>`;
    } else if (message) {
      message.textContent = error.message;
    }
    schedulePoll(() => refreshQueue(businessId), POLL_MS_BUSY);
  }
}

async function renderServices(businessId) {
  stopPolling();
  selectedBusinessId = businessId;
  app.innerHTML = `
    <div class="shell">
      ${topbar({ back: true, title: "Services", branchesFor: businessId, profileFor: businessId, current: "services" })}
      <main id="main-content" tabindex="-1">
        <h1 class="page-title">Business services</h1>
        <p class="page-sub">Shared across branches. Service period is in minutes.</p>
        <div id="services-list" class="biz-list" role="list"><p class="empty" role="status">Loading…</p></div>
        <form class="login-card" id="service-form" style="margin-top:1.25rem;width:100%;max-width:none" aria-labelledby="service-form-title">
          <h2 id="service-form-title" style="font-size:1.1rem;margin-bottom:.75rem">Add service</h2>
          <input type="hidden" id="service-edit-id" value="" />
          <div class="field">
            <label for="service-name">Service name</label>
            <input id="service-name" name="name" required placeholder="e.g. Account opening" />
          </div>
          <div class="field">
            <label for="service-period">Service period (minutes)</label>
            <input id="service-period" name="duration_minutes" type="number" min="1" max="1440" value="15" required />
          </div>
          <div class="field">
            <label for="service-description">Description</label>
            <input id="service-description" name="description" placeholder="Optional" />
          </div>
          <label class="field" style="display:flex;align-items:center;gap:.5rem;margin-top:.75rem">
            <input type="checkbox" id="service-active" checked />
            <span>Service active</span>
          </label>
          <div style="display:flex;gap:.6rem;margin-top:1rem;flex-wrap:wrap">
            <button class="btn btn-secondary" type="button" id="service-cancel" hidden>Cancel</button>
            <button class="btn btn-primary" type="submit" id="service-submit">Add service</button>
          </div>
          <p class="message" id="service-message" role="status" aria-live="polite"></p>
        </form>
        <p class="message" id="page-message" role="status" aria-live="polite"></p>
      </main>
    </div>
  `;
  bindChrome({ backTo: `queue-${businessId}`, branchesFor: businessId, profileFor: businessId });
  focusPage();

  const list = document.getElementById("services-list");
  const form = document.getElementById("service-form");
  const message = document.getElementById("service-message");
  const pageMessage = document.getElementById("page-message");
  const cancelBtn = document.getElementById("service-cancel");
  const submitBtn = document.getElementById("service-submit");
  const formTitle = document.getElementById("service-form-title");
  let currentServices = [];

  function resetForm() {
    form.reset();
    document.getElementById("service-edit-id").value = "";
    document.getElementById("service-period").value = "15";
    document.getElementById("service-active").checked = true;
    formTitle.textContent = "Add service";
    submitBtn.textContent = "Add service";
    cancelBtn.hidden = true;
    message.textContent = "";
    message.classList.remove("success");
  }

  function renderList(services) {
    currentServices = services;
    if (!services.length) {
      list.innerHTML = `<p class="empty">No services yet.</p>`;
      return;
    }
    list.innerHTML = services
      .map(
        (service) => `
          <article class="biz-card" style="cursor:default">
            <div>
              <h3>${escapeHtml(service.name)}</h3>
              <div class="meta">
                <strong>${Number(service.duration_minutes) || 0} min</strong>
                ${service.description ? ` · ${escapeHtml(service.description)}` : ""}
              </div>
              <span class="pill ${service.is_active ? "pill-active" : "pill-inactive"}">
                ${service.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div style="display:flex;flex-direction:column;gap:.4rem">
              <button class="btn btn-secondary btn-sm service-edit-btn" type="button" data-id="${service.id}">Edit</button>
              <button class="btn btn-danger btn-sm service-delete-btn" type="button" data-id="${service.id}">Delete</button>
            </div>
          </article>
        `
      )
      .join("");

    list.querySelectorAll(".service-edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const service = currentServices.find((item) => Number(item.id) === Number(btn.dataset.id));
        if (!service) return;
        document.getElementById("service-edit-id").value = String(service.id);
        document.getElementById("service-name").value = service.name || "";
        document.getElementById("service-period").value = String(service.duration_minutes || 15);
        document.getElementById("service-description").value = service.description || "";
        document.getElementById("service-active").checked = Boolean(service.is_active);
        formTitle.textContent = "Edit service";
        submitBtn.textContent = "Save service";
        cancelBtn.hidden = false;
        message.textContent = "";
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    list.querySelectorAll(".service-delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this service?")) return;
        try {
          await api(`/vendor/businesses/${businessId}/services/${btn.dataset.id}`, {
            method: "DELETE",
          });
          await loadServices();
          resetForm();
        } catch (error) {
          message.textContent = error.message;
        }
      });
    });
  }

  async function loadServices() {
    const services = await api(`/vendor/businesses/${businessId}/services`);
    renderList(services);
  }

  cancelBtn.addEventListener("click", resetForm);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const serviceId = document.getElementById("service-edit-id").value;
    message.textContent = "";
    message.classList.remove("success");
    submitBtn.disabled = true;
    try {
      const payload = {
        name: data.name,
        duration_minutes: Number(data.duration_minutes),
        description: data.description,
        is_active: document.getElementById("service-active").checked,
      };
      if (serviceId) {
        await api(`/vendor/businesses/${businessId}/services/${serviceId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        message.textContent = "Service updated.";
      } else {
        await api(`/vendor/businesses/${businessId}/services`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        message.textContent = "Service added.";
      }
      message.classList.add("success");
      await loadServices();
      resetForm();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submitBtn.disabled = false;
    }
  });

  try {
    await loadServices();
  } catch (error) {
    list.innerHTML = "";
    pageMessage.textContent = error.message;
  }
}

async function renderBranches(businessId) {
  stopPolling();
  selectedBusinessId = businessId;
  app.innerHTML = `
    <div class="shell">
      ${topbar({
        back: true,
        title: "Branches",
        servicesFor: businessId,
        profileFor: businessId,
        current: "branches",
      })}
      <main id="main-content" tabindex="-1">
        <h1 class="page-title">Branches</h1>
        <p class="page-sub" id="branches-sub">Add and manage locations for this business.</p>
        <div id="branches-list" class="biz-list" role="list"><p class="empty" role="status">Loading…</p></div>
        <form class="login-card" id="branch-form" style="margin-top:1.25rem;width:100%;max-width:none" aria-labelledby="branch-form-title">
          <h2 id="branch-form-title" style="font-size:1.1rem;margin-bottom:.75rem">Add branch</h2>
          <input type="hidden" id="branch-edit-id" value="" />
          <div class="field">
            <label for="branch-name">Branch name</label>
            <input id="branch-name" name="name" required placeholder="e.g. Westlands" />
          </div>
          <div class="field">
            <label for="branch-location">Location</label>
            <input id="branch-location" name="location" placeholder="Address or area" />
          </div>
          <div class="field">
            <label for="branch-phone">Phone</label>
            <input id="branch-phone" name="phone" type="tel" placeholder="Optional" />
          </div>
          <label class="field" style="display:flex;align-items:center;gap:.5rem;margin-top:.75rem">
            <input type="checkbox" id="branch-active" checked />
            <span>Branch active</span>
          </label>
          <div style="display:flex;gap:.6rem;margin-top:1rem;flex-wrap:wrap">
            <button class="btn btn-secondary" type="button" id="branch-cancel" hidden>Cancel</button>
            <button class="btn btn-primary" type="submit" id="branch-submit">Add branch</button>
          </div>
          <p class="message" id="branch-message" role="status" aria-live="polite"></p>
        </form>
        <p class="message" id="page-message" role="status" aria-live="polite"></p>
      </main>
    </div>
  `;
  bindChrome({
    backTo: `queue-${businessId}`,
    servicesFor: businessId,
    profileFor: businessId,
  });
  focusPage();

  const list = document.getElementById("branches-list");
  const form = document.getElementById("branch-form");
  const message = document.getElementById("branch-message");
  const pageMessage = document.getElementById("page-message");
  const cancelBtn = document.getElementById("branch-cancel");
  const submitBtn = document.getElementById("branch-submit");
  const formTitle = document.getElementById("branch-form-title");
  const sub = document.getElementById("branches-sub");
  let currentBranches = [];

  function resetForm() {
    form.reset();
    document.getElementById("branch-edit-id").value = "";
    document.getElementById("branch-active").checked = true;
    formTitle.textContent = "Add branch";
    submitBtn.textContent = "Add branch";
    cancelBtn.hidden = true;
    message.textContent = "";
    message.classList.remove("success");
  }

  function renderList(branches) {
    currentBranches = branches;
    if (!branches.length) {
      list.innerHTML = `<p class="empty">No branches yet.</p>`;
      return;
    }
    list.innerHTML = branches
      .map(
        (branch) => `
          <article class="biz-card" style="cursor:default">
            <div>
              <h3>${escapeHtml(branch.name)}</h3>
              <div class="meta">
                ${branch.location ? escapeHtml(branch.location) : "No location set"}
                ${branch.phone ? ` · ${escapeHtml(branch.phone)}` : ""}
              </div>
              <span class="pill ${branch.is_active ? "pill-active" : "pill-inactive"}">
                ${branch.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div style="display:flex;flex-direction:column;gap:.4rem">
              <button class="btn btn-secondary btn-sm branch-edit-btn" type="button" data-id="${branch.id}">Edit</button>
              <button class="btn btn-secondary btn-sm branch-hours-btn" type="button" data-id="${branch.id}">Hours</button>
            </div>
          </article>
        `
      )
      .join("");

    list.querySelectorAll(".branch-edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const branch = currentBranches.find((item) => Number(item.id) === Number(btn.dataset.id));
        if (!branch) return;
        document.getElementById("branch-edit-id").value = String(branch.id);
        document.getElementById("branch-name").value = branch.name || "";
        document.getElementById("branch-location").value = branch.location || "";
        document.getElementById("branch-phone").value = branch.phone || "";
        document.getElementById("branch-active").checked = Boolean(branch.is_active);
        formTitle.textContent = "Edit branch";
        submitBtn.textContent = "Save branch";
        cancelBtn.hidden = false;
        message.textContent = "";
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    list.querySelectorAll(".branch-hours-btn").forEach((btn) => {
      btn.addEventListener("click", () => go(`profile-${btn.dataset.id}`));
    });
  }

  async function loadBranches() {
    const data = await api(`/vendor/businesses/${businessId}/branches`);
    const brand = [data.business_name, data.business_group_name].filter(Boolean).join(" · ");
    if (brand) {
      sub.textContent = `Locations for ${brand}. Hours and accessibility are edited per branch.`;
    }
    renderList(data.branches || []);
  }

  cancelBtn.addEventListener("click", resetForm);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const editId = document.getElementById("branch-edit-id").value;
    message.textContent = "";
    message.classList.remove("success");
    submitBtn.disabled = true;
    try {
      const payload = {
        name: data.name,
        location: data.location,
        phone: data.phone,
        is_active: document.getElementById("branch-active").checked,
      };
      if (editId) {
        await api(`/vendor/businesses/${editId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        message.textContent = "Branch updated.";
      } else {
        await api(`/vendor/businesses/${businessId}/branches`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        message.textContent = "Branch added.";
      }
      message.classList.add("success");
      await loadBranches();
      resetForm();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submitBtn.disabled = false;
    }
  });

  try {
    await loadBranches();
  } catch (error) {
    list.innerHTML = "";
    pageMessage.textContent = error.message;
  }
}

async function renderProfile(businessId) {
  stopPolling();
  selectedBusinessId = businessId;
  app.innerHTML = `
    <div class="shell">
      ${topbar({ back: true, title: "Branch settings", servicesFor: businessId, branchesFor: businessId, current: "hours" })}
      <main id="main-content" tabindex="-1">
        <h1 class="page-title">Branch settings</h1>
        <p class="page-sub">Update hours and accessibility options for this location.</p>
        <p class="empty" id="profile-loading" role="status">Loading…</p>
        <form id="profile-form" class="profile-form hidden" aria-labelledby="profile-heading">
          <div class="field">
            <label for="profile-name">Branch name</label>
            <input id="profile-name" name="name" required />
          </div>
          <label class="active-row" for="profile-active">
            <span>
              <strong>Branch active</strong>
              <span class="page-sub" style="display:block;margin:0">Inactive branches stay hidden from customers.</span>
            </span>
            <input type="checkbox" id="profile-active" />
          </label>
          <div class="field" style="margin-top:1.1rem">
            <label id="weekly-hours-label">Weekly hours</label>
            <div id="profile-hours" class="hours-editor" aria-labelledby="weekly-hours-label"></div>
          </div>
          <div class="field" style="margin-top:1.1rem">
            <label id="accessibility-label">Accessibility</label>
            <p class="page-sub" style="margin:0.25rem 0 0.55rem">Select the options this branch can offer customers.</p>
            <div id="profile-accessibility" aria-labelledby="accessibility-label">${accessibilityEditorHtml()}</div>
          </div>
          <button class="btn btn-primary btn-block" style="margin-top:1.25rem" type="submit">Save changes</button>
          <p class="message" id="profile-message" role="status" aria-live="polite"></p>
        </form>
        <p class="message" id="page-message" role="status" aria-live="polite"></p>
      </main>
    </div>
  `;
  bindChrome({ backTo: `queue-${businessId}`, servicesFor: businessId, branchesFor: businessId });
  focusPage();

  const loading = document.getElementById("profile-loading");
  const form = document.getElementById("profile-form");
  const pageMessage = document.getElementById("page-message");
  const message = document.getElementById("profile-message");
  const hoursRoot = document.getElementById("profile-hours");
  const accessibilityRoot = document.getElementById("profile-accessibility");

  try {
    const business = await api(`/vendor/businesses/${businessId}`);
    loading.remove();
    form.classList.remove("hidden");
    document.getElementById("profile-name").value = business.name || "";
    document.getElementById("profile-active").checked = Boolean(business.is_active);
    mountHoursEditor(
      hoursRoot,
      business.operating_schedule || business.operating_hours || defaultHoursSchedule()
    );
    setAccessibilityOptions(
      accessibilityRoot,
      business.accessibility_options || business.accessibility?.map((item) => item.id) || []
    );
  } catch (error) {
    loading.textContent = "";
    pageMessage.textContent = error.message;
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    message.textContent = "";
    message.classList.remove("success");
    button.disabled = true;
    try {
      const updated = await api(`/vendor/businesses/${businessId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: document.getElementById("profile-name").value.trim(),
          is_active: document.getElementById("profile-active").checked,
          operating_schedule: readHoursSchedule(hoursRoot),
          accessibility_options: readAccessibilityOptions(accessibilityRoot),
        }),
      });
      mountHoursEditor(
        hoursRoot,
        updated.operating_schedule || updated.operating_hours || defaultHoursSchedule()
      );
      setAccessibilityOptions(
        accessibilityRoot,
        updated.accessibility_options || updated.accessibility?.map((item) => item.id) || []
      );
      message.textContent = "Settings saved.";
      message.classList.add("success");
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

async function render() {
  const view = viewFromHash();
  const authViews = new Set(["login", "pin", "otp", "set-pin"]);

  if (!getToken()) {
    if (view === "pin") {
      renderPinLogin();
      return;
    }
    if (view === "otp") {
      renderOtp();
      return;
    }
    if (view === "set-pin") {
      renderSetPin();
      return;
    }
    if (!authViews.has(view)) {
      location.hash = "login";
    }
    renderLogin();
    return;
  }

  if (authViews.has(view)) {
    go("businesses");
    return;
  }

  if (view.startsWith("queue-")) {
    const id = Number(view.replace("queue-", ""));
    if (id) {
      await renderQueue(id);
      return;
    }
  }

  if (view.startsWith("services-")) {
    const id = Number(view.replace("services-", ""));
    if (id) {
      await renderServices(id);
      return;
    }
  }

  if (view.startsWith("branches-")) {
    const id = Number(view.replace("branches-", ""));
    if (id) {
      await renderBranches(id);
      return;
    }
  }

  if (view.startsWith("profile-")) {
    const id = Number(view.replace("profile-", ""));
    if (id) {
      await renderProfile(id);
      return;
    }
  }

  await renderBusinesses();
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopPolling();
    return;
  }
  const view = viewFromHash();
  if (view.startsWith("queue-") && getToken()) {
    const id = Number(view.replace("queue-", ""));
    if (id) refreshQueue(id);
  }
});

window.addEventListener("hashchange", render);
render();
