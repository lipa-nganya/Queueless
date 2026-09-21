import { accessibilityIconSvg } from "./accessibility-icons.js";
import { promptVendorWebPush, registerVendorWebPush } from "./push.js";

const API_ORIGIN =
  window.QUEUELESS_API_ORIGIN ||
  (["localhost", "127.0.0.1"].includes(location.hostname)
    ? "http://localhost:4000"
    : location.origin);
const API_BASE = `${API_ORIGIN}/api`;
const TOKEN_KEY = "queueless_vendor_token";
const POLL_MS = 12000;
const POLL_MS_EMPTY = 45000;
const POLL_MS_BUSY = 15000;

const app = document.getElementById("app");

let pollTimer = null;
let selectedBusinessId = null;
let pushRegisterAttempted = false;

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

async function ensureWebPushRegistered({ interactive = false } = {}) {
  const token = getToken();
  if (!token) return;
  if (!interactive && pushRegisterAttempted && Notification.permission !== "default") {
    return;
  }
  pushRegisterAttempted = true;
  if (interactive) {
    await promptVendorWebPush(token);
    return;
  }
  await registerVendorWebPush({ authToken: token, interactive: false });
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

const PIN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"/><circle cx="12" cy="11" r="2.2"/></svg>`;

/**
 * Kenya place autocomplete via /places/search (Photon). Returns coords for the
 * picked suggestion so branch saves keep accurate lat/lng.
 */
function bindPlaceAutocomplete(input, { listId }) {
  const state = { latitude: null, longitude: null, pickedLabel: "" };
  let timer = null;
  let requestId = 0;

  const wrap = input.closest(".place-field") || input.parentElement;
  wrap.classList.add("place-field");

  let inputWrap = input.closest(".place-input-wrap");
  if (!inputWrap) {
    inputWrap = document.createElement("div");
    inputWrap.className = "place-input-wrap";
    input.parentNode.insertBefore(inputWrap, input);
    inputWrap.appendChild(input);
  }

  let clearBtn = inputWrap.querySelector(".place-clear");
  if (!clearBtn) {
    clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "place-clear hidden";
    clearBtn.setAttribute("aria-label", "Clear location");
    clearBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    inputWrap.appendChild(clearBtn);
  }

  let list = document.getElementById(listId);
  if (!list) {
    list = document.createElement("ul");
    list.id = listId;
    list.className = "place-suggestions hidden";
    list.setAttribute("role", "listbox");
    wrap.appendChild(list);
  }

  function syncClearButton() {
    clearBtn.classList.toggle("hidden", !input.value.trim());
  }

  function hide() {
    list.classList.add("hidden");
    list.innerHTML = "";
  }

  function clearCoords() {
    state.latitude = null;
    state.longitude = null;
    state.pickedLabel = "";
  }

  function setCoords(place) {
    state.latitude = place.latitude;
    state.longitude = place.longitude;
    state.pickedLabel = place.label;
  }

  function clearAll() {
    input.value = "";
    clearCoords();
    hide();
    syncClearButton();
    input.focus();
  }

  async function search(query) {
    const id = ++requestId;
    try {
      const places = await api(`/places/search?q=${encodeURIComponent(query)}`);
      if (id !== requestId) return;
      if (!places.length) {
        list.innerHTML = `<li class="place-empty">No Kenya places found</li>`;
        list.classList.remove("hidden");
        return;
      }
      list.innerHTML = places
        .map(
          (place, index) => `
            <li role="option">
              <button type="button" class="place-option" data-index="${index}">
                ${PIN_ICON}
                <span>${escapeHtml(place.label)}</span>
              </button>
            </li>
          `
        )
        .join("");
      list.classList.remove("hidden");
      list.querySelectorAll(".place-option").forEach((btn) => {
        btn.addEventListener("mousedown", (event) => {
          event.preventDefault();
          const place = places[Number(btn.dataset.index)];
          if (!place) return;
          input.value = place.label;
          setCoords(place);
          syncClearButton();
          hide();
        });
      });
    } catch (error) {
      if (id !== requestId) return;
      list.innerHTML = `<li class="place-empty">${escapeHtml(error.message || "Search failed")}</li>`;
      list.classList.remove("hidden");
    }
  }

  clearBtn.addEventListener("mousedown", (event) => {
    event.preventDefault();
    clearAll();
  });

  input.addEventListener("input", () => {
    const query = input.value.trim();
    if (query !== state.pickedLabel) clearCoords();
    syncClearButton();
    clearTimeout(timer);
    if (query.length < 2) {
      hide();
      return;
    }
    timer = setTimeout(() => search(query), 300);
  });

  input.addEventListener("blur", () => {
    setTimeout(hide, 150);
  });

  syncClearButton();

  return {
    getCoords: () => ({
      latitude: state.latitude,
      longitude: state.longitude,
    }),
    setFromBranch: (branch) => {
      input.value = branch?.location || "";
      if (
        branch?.latitude != null &&
        branch?.longitude != null &&
        Number.isFinite(Number(branch.latitude)) &&
        Number.isFinite(Number(branch.longitude))
      ) {
        setCoords({
          label: branch.location || "",
          latitude: Number(branch.latitude),
          longitude: Number(branch.longitude),
        });
      } else {
        clearCoords();
      }
      syncClearButton();
    },
    setPlace: (place) => {
      if (!place) return;
      input.value = place.label || "";
      setCoords(place);
      syncClearButton();
      hide();
    },
    reset: () => {
      clearAll();
    },
  };
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

const etagCache = new Map();

async function api(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  if (method === "GET" && etagCache.has(path)) {
    headers["If-None-Match"] = etagCache.get(path).etag;
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 304 && etagCache.has(path)) {
    return etagCache.get(path).data;
  }

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

  if (method === "GET") {
    const etag = response.headers.get("ETag");
    if (etag) etagCache.set(path, { etag, data });
  } else {
    for (const key of [...etagCache.keys()]) {
      if (key.includes("/queue")) etagCache.delete(key);
    }
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
  return String(window.QUEUELESS_VENDOR_APP_VERSION || "1.1.0").trim() || "1.1.0";
}

function appVersionHtml({ onDark = false } = {}) {
  return `<p class="app-version${onDark ? " app-version-on-dark" : ""}">v${escapeHtml(appVersion())}</p>`;
}

function authBrandHtml({ title, lead }) {
  return `
    <div class="auth-brand">
      <p class="brand">Queue<span>less</span></p>
      <span class="auth-badge" aria-hidden="true">Vendor</span>
    </div>
    <h1 class="auth-title">${escapeHtml(title)}</h1>
    <p class="auth-lead">${lead}</p>
  `;
}

function renderPendingActivation(phone = "") {
  stopPolling();
  app.innerHTML = `
    <div class="login-shell">
      <main id="main-content" class="login-stack" tabindex="-1">
        <div class="login-card">
          ${authBrandHtml({
            title: "Waiting for activation",
            lead: `Your account for <strong>+${escapeHtml(phone)}</strong> is waiting for admin activation.`,
          })}
          <p class="auth-note">We'll notify you here and on the vendor app when it's ready. Then sign in with your phone and PIN.</p>
          <button class="btn btn-primary btn-block auth-submit" type="button" id="back-phone">Back to sign in</button>
        </div>
        ${appVersionHtml()}
      </main>
    </div>
  `;
  focusPage();
  if (phone) {
    void registerVendorWebPush({ phone, interactive: true });
  }
  document.getElementById("back-phone").onclick = () => {
    localStorage.removeItem(PENDING_VENDOR_PHONE_KEY);
    localStorage.removeItem(PENDING_VENDOR_PURPOSE_KEY);
    sessionStorage.removeItem("queueless_vendor_verified_otp");
    go("login");
  };
}

function renderLogin() {
  stopPolling();
  app.innerHTML = `
    <div class="login-shell">
      <main id="main-content" class="login-stack" tabindex="-1">
        <form class="login-card" id="phone-form">
          ${authBrandHtml({
            title: "Sign in",
            lead: "Use your phone number to sign in or create a vendor account.",
          })}
          <div class="field">
            <label for="phone">Phone number</label>
            <input id="phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="07XXXXXXXX" required />
          </div>
          <button class="btn btn-primary btn-block auth-submit" type="submit">Continue</button>
          <p class="message" id="login-message" role="status"></p>
        </form>
        ${appVersionHtml()}
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
      if (status.pending_activation && status.has_pin) {
        renderPendingActivation(status.phone);
        return;
      }
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
          ${authBrandHtml({
            title: "Enter PIN",
            lead: `Enter your 4-digit PIN for <strong>+${escapeHtml(phone)}</strong>.`,
          })}
          ${pinFieldHtml({ id: "pin", label: "PIN" })}
          <button class="btn btn-primary btn-block auth-submit" type="submit">Sign in</button>
          <button class="btn-link" type="button" id="forgot-pin">Forgot PIN?</button>
          <button class="btn-link" type="button" id="back-phone">Use a different number</button>
          <p class="message" id="login-message" role="status"></p>
        </form>
        ${appVersionHtml()}
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
      void ensureWebPushRegistered({ interactive: true });
      go("businesses");
    } catch (error) {
      if (error.data?.pending_activation) {
        renderPendingActivation(phone);
        return;
      }
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
          ${authBrandHtml({
            title: "Verify code",
            lead: `Enter the 4-digit code sent to <strong>+${escapeHtml(phone)}</strong>.`,
          })}
          ${pinFieldHtml({ id: "otp", label: "SMS code" })}
          <button class="btn btn-primary btn-block auth-submit" type="submit">Verify code</button>
          <button class="btn-link" type="button" id="resend-otp">Resend code</button>
          <button class="btn-link" type="button" id="back-phone">Use a different number</button>
          <p class="message" id="login-message" role="status"></p>
        </form>
        ${appVersionHtml()}
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
          ${authBrandHtml({
            title: "Create PIN",
            lead: `Choose a 4-digit PIN for <strong>+${escapeHtml(phone)}</strong>.`,
          })}
          ${pinFieldHtml({ id: "pin", label: "New PIN" })}
          ${pinFieldHtml({ id: "confirm_pin", label: "Confirm PIN" })}
          <button class="btn btn-primary btn-block auth-submit" type="submit">Save PIN</button>
          <button class="btn-link" type="button" id="back-otp">Back</button>
          <p class="message" id="login-message" role="status"></p>
        </form>
        ${appVersionHtml()}
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
      localStorage.removeItem(PENDING_VENDOR_PURPOSE_KEY);
      sessionStorage.removeItem("queueless_vendor_verified_otp");
      if (session.pending_activation || !session.token) {
        renderPendingActivation(session.phone || phone);
        return;
      }
      setToken(session.token);
      localStorage.removeItem(PENDING_VENDOR_PHONE_KEY);
      void ensureWebPushRegistered({ interactive: true });
      go("businesses");
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

function navIcon(name) {
  const icons = {
    businesses: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/></svg>`,
    queue: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16M4 12h12M4 17h8"/></svg>`,
    services: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M4.2 6.2l1.4 1.4M18.4 16.4l1.4 1.4M3 12h2M19 12h2M4.2 17.8l1.4-1.4M18.4 7.6l1.4-1.4"/></svg>`,
    branches: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 4v16M6 8h8a4 4 0 0 1 0 8H6"/><circle cx="18" cy="8" r="2"/><circle cx="18" cy="16" r="2"/></svg>`,
    hours: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>`,
  };
  return icons[name] || icons.businesses;
}

function frame({
  back = false,
  title = "",
  subtitle = "",
  servicesFor = null,
  branchesFor = null,
  profileFor = null,
  current = null,
  body = "",
} = {}) {
  const inDesk = Boolean(servicesFor || branchesFor || profileFor);
  const navItem = (id, label, icon, isCurrent) => `
    <button
      type="button"
      class="nav-item${isCurrent ? " active" : ""}"
      id="${id}"
      ${isCurrent ? 'aria-current="page"' : ""}
    >
      <span class="nav-icon">${navIcon(icon)}</span>
      <span>${label}</span>
    </button>
  `;

  return `
    <div class="shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="brand">Queue<span>less</span></div>
          ${appVersionHtml()}
        </div>
        <p class="nav-section">Main menu</p>
        <nav class="nav" aria-label="Vendor">
          ${
            inDesk
              ? `
                ${navItem("queue-home-btn", "Queue", "queue", current === "queue")}
                ${profileFor ? navItem("profile-btn", "Settings", "hours", current === "hours") : ""}
                ${branchesFor ? navItem("branches-btn", "Branches", "branches", current === "branches") : ""}
                ${servicesFor ? navItem("services-btn", "Services", "services", current === "services") : ""}
              `
              : navItem("biz-home-btn", "Businesses", "businesses", true)
          }
        </nav>
        <div class="sidebar-foot">
          <button class="btn btn-secondary btn-block" type="button" id="logout-btn">Sign out</button>
        </div>
      </aside>
      <div class="workspace">
        <header class="page-header">
          <div class="page-header-copy">
            ${
              back
                ? `<button type="button" class="back-btn" id="back-btn" aria-label="Back to previous screen">←</button>`
                : ""
            }
            <div>
              <h1 class="page-title">${escapeHtml(title || "Queueless Vendor")}</h1>
              ${subtitle ? `<p class="page-sub">${escapeHtml(subtitle)}</p>` : ""}
            </div>
          </div>
        </header>
        <main id="main-content" tabindex="-1">${body}</main>
      </div>
    </div>
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
  document.getElementById("queue-home-btn")?.addEventListener("click", () => {
    stopPolling();
    const id = servicesFor || branchesFor || profileFor || selectedBusinessId;
    if (id) go(`queue-${id}`);
  });
  document.getElementById("biz-home-btn")?.addEventListener("click", () => {
    stopPolling();
    go("businesses");
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
  app.innerHTML = frame({
    title: "Your businesses",
    subtitle: "Pick a business to manage its live queue.",
    body: `
      <p class="empty" id="biz-loading" role="status">Loading…</p>
      <div class="biz-list" id="biz-list" role="list"></div>
      <p class="message" id="page-message" role="status" aria-live="polite"></p>
    `,
  });
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
  app.innerHTML = frame({
    back: true,
    title: "Live queue",
    subtitle: "Serve guests, pause when needed, and keep walk-ins in sync.",
    servicesFor: businessId,
    branchesFor: businessId,
    profileFor: businessId,
    current: "queue",
    body: `
      <div id="queue-root"><p class="empty" role="status">Loading queue…</p></div>
      <p class="message" id="page-message" role="status" aria-live="polite"></p>
    `,
  });
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
    const fingerprint = JSON.stringify({
      waiting: business?.waiting_total,
      paused: business?.queue_paused,
      ids: entries.map((entry) => [entry.id, entry.position, entry.status]),
    });
    if (!initial && root.dataset.queueFp === fingerprint) {
      schedulePoll(
        () => refreshQueue(businessId),
        queuePollDelay(business?.waiting_total)
      );
      return;
    }
    root.dataset.queueFp = fingerprint;

    const headerTitle = document.querySelector(".workspace .page-title");
    const headerSub = document.querySelector(".workspace .page-sub");
    if (headerTitle) headerTitle.textContent = business.name || "Live queue";
    if (headerSub) {
      headerSub.textContent = `${business.business_group_name || ""}${
        business.location ? ` · ${business.location}` : ""
      }`.replace(/^ · /, "");
    }

    root.innerHTML = `
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
          <span class="metric-icon" aria-hidden="true">${navIcon("queue")}</span>
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

      <div class="queue-pause-card${business.queue_paused ? " is-paused" : ""}">
        <div class="queue-pause-copy">
          <strong>${business.queue_paused ? "Queue paused" : "Queue open"}</strong>
          <span>${
            business.queue_paused
              ? "Customers cannot join right now. You can still serve people already waiting."
              : "Customers can join this queue. Pause to take a short break."
          }</span>
        </div>
        <button
          class="btn ${business.queue_paused ? "btn-primary" : "btn-secondary"}"
          type="button"
          id="queue-pause-btn"
          data-focus-key="queue-pause"
        >${business.queue_paused ? "Resume queue" : "Pause / take a break"}</button>
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

    document.getElementById("queue-pause-btn")?.addEventListener("click", async (event) => {
      const btn = event.currentTarget;
      btn.disabled = true;
      try {
        await api(`/vendor/businesses/${businessId}/queue-pause`, {
          method: "PUT",
          body: JSON.stringify({ paused: !business.queue_paused }),
        });
        await refreshQueue(businessId);
      } catch (error) {
        if (message) message.textContent = error.message;
        btn.disabled = false;
      }
    });

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
  app.innerHTML = frame({
    back: true,
    title: "Branch services",
    subtitle: "Services for this location. Service time feeds customer wait estimates.",
    branchesFor: businessId,
    profileFor: businessId,
    servicesFor: businessId,
    current: "services",
    body: `
      <div class="profile-shell">
        <div class="branch-switcher" id="services-branch-switcher">
          <div class="branch-switcher-copy">
            <span class="branch-switcher-label">Current branch</span>
            <strong class="branch-switcher-name" id="services-branch-title">Loading…</strong>
            <span class="branch-switcher-meta" id="services-branch-meta"></span>
          </div>
          <label class="branch-switcher-control" for="services-branch-select">
            <span class="branch-switcher-control-label">Switch branch</span>
            <select id="services-branch-select" aria-label="Switch branch"></select>
          </label>
        </div>

        <div class="desk-split">
          <div id="services-list" class="biz-list" role="list"><p class="empty" role="status">Loading…</p></div>
          <form class="panel-form" id="service-form" aria-labelledby="service-form-title">
            <h2 id="service-form-title" class="panel-form-title">Add service</h2>
            <p class="panel-form-context" id="service-form-context"></p>
            <input type="hidden" id="service-edit-id" value="" />
            <div class="field" style="margin-top:0">
              <label for="service-name">Service name</label>
              <input id="service-name" name="name" required placeholder="e.g. Haircut" />
            </div>
            <div class="field">
              <label for="service-period">Service time (minutes)</label>
              <input id="service-period" name="duration_minutes" type="number" min="1" max="1440" value="15" required />
            </div>
            <div class="field">
              <label for="service-description">Description</label>
              <input id="service-description" name="description" placeholder="Optional" />
            </div>
            <label class="active-row" for="service-active">
              <span>
                <strong>Service active</strong>
                <span class="page-sub" style="display:block;margin:0">Inactive services stay hidden from customers.</span>
              </span>
              <span class="switch">
                <input type="checkbox" id="service-active" checked />
                <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
              </span>
            </label>
            <div class="form-actions">
              <button class="btn btn-secondary" type="button" id="service-cancel" hidden>Cancel</button>
              <button class="btn btn-primary" type="submit" id="service-submit">Add service</button>
            </div>
            <p class="message" id="service-message" role="status" aria-live="polite"></p>
          </form>
        </div>
      </div>
      <p class="message" id="page-message" role="status" aria-live="polite"></p>
    `,
  });
  bindChrome({
    backTo: `queue-${businessId}`,
    branchesFor: businessId,
    profileFor: businessId,
    servicesFor: businessId,
  });
  focusPage();

  const list = document.getElementById("services-list");
  const form = document.getElementById("service-form");
  const message = document.getElementById("service-message");
  const pageMessage = document.getElementById("page-message");
  const cancelBtn = document.getElementById("service-cancel");
  const submitBtn = document.getElementById("service-submit");
  const formTitle = document.getElementById("service-form-title");
  const formContext = document.getElementById("service-form-context");
  const branchTitle = document.getElementById("services-branch-title");
  const branchMeta = document.getElementById("services-branch-meta");
  const branchSelect = document.getElementById("services-branch-select");
  const pageTitle = document.querySelector(".page-title");
  const pageSub = document.querySelector(".page-sub");
  let currentServices = [];
  let currentBranchId = Number(businessId);
  let currentBranchName = "";

  function applyBranchHeader(business) {
    currentBranchId = Number(business.id);
    currentBranchName = business.name || "Untitled branch";
    branchTitle.textContent = currentBranchName;
    const metaParts = [business.business_name, business.location].filter(Boolean);
    branchMeta.textContent = metaParts.length ? metaParts.join(" · ") : "";
    formContext.textContent = `Adding or editing services for ${currentBranchName}.`;
    if (pageTitle) pageTitle.textContent = currentBranchName;
    if (pageSub) {
      pageSub.textContent = business.business_name
        ? `${business.business_name} — branch services`
        : "Services for this location. Service time feeds customer wait estimates.";
    }
  }

  function fillBranchSelect(branches, selectedId) {
    branchSelect.innerHTML = branches
      .map(
        (branch) => `
          <option value="${branch.id}" ${Number(branch.id) === Number(selectedId) ? "selected" : ""}>
            ${escapeHtml(branch.name || `Branch ${branch.id}`)}${branch.is_active ? "" : " (inactive)"}
          </option>
        `
      )
      .join("");
    branchSelect.disabled = branches.length <= 1;
    document
      .querySelector("#services-branch-switcher .branch-switcher-control")
      ?.classList.toggle("is-single", branches.length <= 1);
  }

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
      list.innerHTML = `
        <div class="empty-state" role="status">
          <h3>No services yet</h3>
          <p>Add the first service for <strong>${escapeHtml(currentBranchName || "this branch")}</strong>.</p>
        </div>
      `;
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
          await api(`/vendor/businesses/${currentBranchId}/services/${btn.dataset.id}`, {
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
    const services = await api(`/vendor/businesses/${currentBranchId}/services`);
    renderList(services);
  }

  branchSelect.addEventListener("change", () => {
    const nextId = Number(branchSelect.value);
    if (!nextId || nextId === currentBranchId) return;
    go(`services-${nextId}`);
  });

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
        await api(`/vendor/businesses/${currentBranchId}/services/${serviceId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        message.textContent = "Service updated.";
      } else {
        await api(`/vendor/businesses/${currentBranchId}/services`, {
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
    const [business, branchList] = await Promise.all([
      api(`/vendor/businesses/${businessId}`),
      api(`/vendor/businesses/${businessId}/branches`),
    ]);
    applyBranchHeader(business);
    fillBranchSelect(branchList.branches || [], business.id);
    await loadServices();
  } catch (error) {
    list.innerHTML = "";
    branchTitle.textContent = "Unavailable";
    pageMessage.textContent = error.message;
  }
}

async function renderBranches(businessId) {
  stopPolling();
  selectedBusinessId = businessId;
  app.innerHTML = frame({
    back: true,
    title: "Branches",
    subtitle: "Locations customers can visit for this business.",
    servicesFor: businessId,
    profileFor: businessId,
    branchesFor: businessId,
    current: "branches",
    body: `
      <div class="page-toolbar">
        <div class="page-toolbar-copy">
          <p class="page-sub" id="branches-sub">Add a location, then set services and hours for each branch.</p>
          <p class="branch-count" id="branch-count" hidden></p>
        </div>
        <button class="btn btn-primary" type="button" id="branch-add-btn">Add branch</button>
      </div>
      <div id="branches-list" class="branch-list" role="list"><p class="empty" role="status">Loading…</p></div>
      <p class="message" id="page-message" role="status" aria-live="polite"></p>

      <div id="branch-sheet" class="sheet-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="branch-form-title">
        <div class="sheet">
          <div class="sheet-header">
            <h2 id="branch-form-title">Add branch</h2>
            <button type="button" class="sheet-close" id="branch-sheet-close" aria-label="Close">✕</button>
          </div>
          <form id="branch-form" class="sheet-form">
            <input type="hidden" id="branch-edit-id" value="" />
            <div class="field" style="margin-top:0">
              <label for="branch-name">Branch name</label>
              <input id="branch-name" name="name" required placeholder="e.g. Westlands" />
            </div>
            <div class="field place-field">
              <label for="branch-location">Location</label>
              <input id="branch-location" name="location" placeholder="Start typing a Kenya place…" autocomplete="off" />
              <button class="btn btn-secondary" type="button" id="branch-use-location">
                Use my current location
              </button>
            </div>
            <div class="field">
              <label for="branch-landmark">Landmark <span class="optional-label">(optional)</span></label>
              <input id="branch-landmark" name="landmark" placeholder="e.g. Opposite Naivas, next to the blue gate" />
            </div>
            <div class="field">
              <label for="branch-phone">Phone <span class="optional-label">(optional)</span></label>
              <input id="branch-phone" name="phone" type="tel" placeholder="07XXXXXXXX" />
            </div>
            <label class="active-row" for="branch-active">
              <span>
                <strong>Branch active</strong>
                <span class="page-sub" style="display:block;margin:0">Inactive branches stay hidden from customers.</span>
              </span>
              <span class="switch">
                <input type="checkbox" id="branch-active" checked />
                <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
              </span>
            </label>
            <div class="sheet-actions">
              <button class="btn btn-secondary" type="button" id="branch-cancel">Cancel</button>
              <button class="btn btn-primary" type="submit" id="branch-submit">Add branch</button>
            </div>
            <p class="message" id="branch-message" role="status" aria-live="polite"></p>
          </form>
        </div>
      </div>
    `,
  });
  bindChrome({
    backTo: `queue-${businessId}`,
    servicesFor: businessId,
    profileFor: businessId,
    branchesFor: businessId,
  });
  focusPage();

  const list = document.getElementById("branches-list");
  const form = document.getElementById("branch-form");
  const sheet = document.getElementById("branch-sheet");
  const message = document.getElementById("branch-message");
  const pageMessage = document.getElementById("page-message");
  const cancelBtn = document.getElementById("branch-cancel");
  const submitBtn = document.getElementById("branch-submit");
  const addBtn = document.getElementById("branch-add-btn");
  const formTitle = document.getElementById("branch-form-title");
  const sub = document.getElementById("branches-sub");
  const countEl = document.getElementById("branch-count");
  const branchPlace = bindPlaceAutocomplete(document.getElementById("branch-location"), {
    listId: "branch-place-suggestions",
  });
  let currentBranches = [];

  function openSheet() {
    sheet.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onSheetKeydown);
    window.setTimeout(() => document.getElementById("branch-name")?.focus(), 30);
  }

  function closeSheet() {
    sheet.classList.add("hidden");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onSheetKeydown);
    resetForm({ silent: true });
  }

  function onSheetKeydown(event) {
    if (event.key === "Escape") closeSheet();
  }

  function resetForm({ silent = false } = {}) {
    form.reset();
    document.getElementById("branch-edit-id").value = "";
    document.getElementById("branch-active").checked = true;
    branchPlace.reset();
    formTitle.textContent = "Add branch";
    submitBtn.textContent = "Add branch";
    if (!silent) {
      message.textContent = "";
      message.classList.remove("success");
    }
  }

  function openCreate() {
    pageMessage.textContent = "";
    pageMessage.classList.remove("success");
    resetForm();
    openSheet();
  }

  function openEdit(branch) {
    pageMessage.textContent = "";
    pageMessage.classList.remove("success");
    resetForm();
    document.getElementById("branch-edit-id").value = String(branch.id);
    document.getElementById("branch-name").value = branch.name || "";
    branchPlace.setFromBranch(branch);
    document.getElementById("branch-landmark").value = branch.landmark || "";
    document.getElementById("branch-phone").value = branch.phone || "";
    document.getElementById("branch-active").checked = Boolean(branch.is_active);
    formTitle.textContent = "Edit branch details";
    submitBtn.textContent = "Save changes";
    openSheet();
  }

  function branchMetaLine(label, value, missing = "Not set") {
    const text = String(value || "").trim();
    return `
      <div class="branch-meta-row">
        <span class="branch-meta-label">${escapeHtml(label)}</span>
        <span class="branch-meta-value${text ? "" : " is-muted"}">${escapeHtml(text || missing)}</span>
      </div>
    `;
  }

  function renderList(branches) {
    currentBranches = branches;
    const total = branches.length;
    countEl.hidden = total === 0;
    countEl.textContent = total === 1 ? "1 branch" : `${total} branches`;

    if (!branches.length) {
      list.innerHTML = `
        <div class="empty-state" role="status">
          <h3>No branches yet</h3>
          <p>Add your first location so customers can find you and join the right queue.</p>
          <button class="btn btn-primary" type="button" id="branch-empty-add">Add branch</button>
        </div>
      `;
      document.getElementById("branch-empty-add")?.addEventListener("click", openCreate);
      return;
    }

    list.innerHTML = branches
      .map(
        (branch) => `
          <article class="branch-card" role="listitem">
            <div class="branch-card-head">
              <div class="branch-card-title">
                <h3>${escapeHtml(branch.name)}</h3>
                <span class="pill ${branch.is_active ? "pill-active" : "pill-inactive"}">
                  ${branch.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <div class="branch-meta">
              ${branchMetaLine("Location", branch.location, "No location set")}
              ${branchMetaLine("Landmark", branch.landmark, "No landmark")}
              ${branchMetaLine("Phone", branch.phone, "No phone")}
            </div>
            <div class="branch-actions">
              <button class="btn btn-secondary branch-edit-btn" type="button" data-id="${branch.id}">Edit details</button>
              <button class="btn btn-secondary branch-services-btn" type="button" data-id="${branch.id}">Services</button>
              <button class="btn btn-primary branch-settings-btn" type="button" data-id="${branch.id}">Settings</button>
            </div>
          </article>
        `
      )
      .join("");

    list.querySelectorAll(".branch-edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const branch = currentBranches.find((item) => Number(item.id) === Number(btn.dataset.id));
        if (branch) openEdit(branch);
      });
    });
    list.querySelectorAll(".branch-settings-btn").forEach((btn) => {
      btn.addEventListener("click", () => go(`profile-${btn.dataset.id}`));
    });
    list.querySelectorAll(".branch-services-btn").forEach((btn) => {
      btn.addEventListener("click", () => go(`services-${btn.dataset.id}`));
    });
  }

  async function loadBranches() {
    const data = await api(`/vendor/businesses/${businessId}/branches`);
    const brand = [data.business_name, data.business_group_name].filter(Boolean).join(" · ");
    if (brand) {
      sub.textContent = `${brand} — add locations, then manage services and hours per branch.`;
    }
    renderList(data.branches || []);
  }

  addBtn.addEventListener("click", openCreate);
  cancelBtn.addEventListener("click", closeSheet);
  document.getElementById("branch-sheet-close")?.addEventListener("click", closeSheet);
  sheet.addEventListener("click", (event) => {
    if (event.target === sheet) closeSheet();
  });

  document.getElementById("branch-use-location")?.addEventListener("click", async () => {
    message.textContent = "";
    message.classList.remove("success");
    if (!navigator.geolocation) {
      message.textContent = "This browser cannot share your location.";
      return;
    }
    const btn = document.getElementById("branch-use-location");
    btn.disabled = true;
    const previousLabel = btn.textContent;
    btn.textContent = "Finding location…";
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000,
        });
      });
      const { latitude, longitude } = position.coords;
      const place = await api(
        `/places/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`
      );
      branchPlace.setPlace(place);
      message.textContent = "Current location set. You can refine the place name if needed.";
      message.classList.add("success");
    } catch (error) {
      const geoCode = error?.code;
      if (geoCode === 1) {
        message.textContent = "Allow location access to use your current position.";
      } else if (geoCode === 2 || geoCode === 3) {
        message.textContent = "Could not read your current location. Try again outdoors or search instead.";
      } else {
        message.textContent = error.message || "Could not use current location.";
      }
    } finally {
      btn.disabled = false;
      btn.textContent = previousLabel;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const editId = document.getElementById("branch-edit-id").value;
    message.textContent = "";
    message.classList.remove("success");
    submitBtn.disabled = true;
    try {
      const coords = branchPlace.getCoords();
      const payload = {
        name: data.name,
        location: data.location,
        landmark: data.landmark,
        phone: data.phone,
        latitude: coords.latitude,
        longitude: coords.longitude,
        is_active: document.getElementById("branch-active").checked,
      };
      if (editId) {
        await api(`/vendor/businesses/${editId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        pageMessage.textContent = "Branch details saved.";
      } else {
        await api(`/vendor/businesses/${businessId}/branches`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        pageMessage.textContent = "Branch added.";
      }
      pageMessage.classList.add("success");
      closeSheet();
      await loadBranches();
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
  const savedTab = sessionStorage.getItem("vendor-settings-tab") || "details";
  const initialTab = ["details", "hours", "accessibility"].includes(savedTab)
    ? savedTab
    : "details";

  app.innerHTML = frame({
    back: true,
    title: "Branch settings",
    subtitle: "Details, hours, and accessibility for this location.",
    servicesFor: businessId,
    branchesFor: businessId,
    profileFor: businessId,
    current: "hours",
    body: `
      <p class="empty" id="profile-loading" role="status">Loading…</p>
      <div id="profile-shell" class="profile-shell hidden">
        <div class="branch-switcher" id="branch-switcher">
          <div class="branch-switcher-copy">
            <span class="branch-switcher-label">Current branch</span>
            <strong class="branch-switcher-name" id="profile-branch-title">—</strong>
            <span class="branch-switcher-meta" id="profile-branch-meta"></span>
          </div>
          <label class="branch-switcher-control" for="profile-branch-select">
            <span class="branch-switcher-control-label">Switch branch</span>
            <select id="profile-branch-select" aria-label="Switch branch"></select>
          </label>
        </div>

        <form id="profile-form" class="panel-form profile-form" aria-labelledby="profile-heading">
          <h2 id="profile-heading" class="sr-only">Branch settings form</h2>
          <div class="settings-tabs" role="tablist" aria-label="Branch settings sections">
            <button type="button" class="settings-tab${initialTab === "details" ? " is-active" : ""}" role="tab" id="tab-details" aria-controls="panel-details" aria-selected="${initialTab === "details" ? "true" : "false"}" data-tab="details" tabindex="${initialTab === "details" ? "0" : "-1"}">Details</button>
            <button type="button" class="settings-tab${initialTab === "hours" ? " is-active" : ""}" role="tab" id="tab-hours" aria-controls="panel-hours" aria-selected="${initialTab === "hours" ? "true" : "false"}" data-tab="hours" tabindex="${initialTab === "hours" ? "0" : "-1"}">Hours</button>
            <button type="button" class="settings-tab${initialTab === "accessibility" ? " is-active" : ""}" role="tab" id="tab-accessibility" aria-controls="panel-accessibility" aria-selected="${initialTab === "accessibility" ? "true" : "false"}" data-tab="accessibility" tabindex="${initialTab === "accessibility" ? "0" : "-1"}">Accessibility</button>
          </div>

          <div class="settings-panel${initialTab === "details" ? " is-active" : ""}" role="tabpanel" id="panel-details" aria-labelledby="tab-details" data-panel="details"${initialTab === "details" ? "" : " hidden"}>
            <div class="field" style="margin-top:0">
              <label for="profile-name">Branch name</label>
              <input id="profile-name" name="name" required />
            </div>
            <label class="active-row" for="profile-active">
              <span>
                <strong>Branch active</strong>
                <span class="page-sub" style="display:block;margin:0">Inactive branches stay hidden from customers.</span>
              </span>
              <span class="switch">
                <input type="checkbox" id="profile-active" />
                <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
              </span>
            </label>
          </div>

          <div class="settings-panel${initialTab === "hours" ? " is-active" : ""}" role="tabpanel" id="panel-hours" aria-labelledby="tab-hours" data-panel="hours"${initialTab === "hours" ? "" : " hidden"}>
            <div class="field" style="margin-top:0">
              <label id="weekly-hours-label">Weekly hours</label>
              <p class="page-sub" style="margin:0.25rem 0 0.55rem">Set open days and times for this branch.</p>
              <div id="profile-hours" class="hours-editor" aria-labelledby="weekly-hours-label"></div>
            </div>
          </div>

          <div class="settings-panel${initialTab === "accessibility" ? " is-active" : ""}" role="tabpanel" id="panel-accessibility" aria-labelledby="tab-accessibility" data-panel="accessibility"${initialTab === "accessibility" ? "" : " hidden"}>
            <div class="field" style="margin-top:0">
              <label id="accessibility-label">Accessibility</label>
              <p class="page-sub" style="margin:0.25rem 0 0.55rem">Select the options this branch can offer customers.</p>
              <div id="profile-accessibility" aria-labelledby="accessibility-label">${accessibilityEditorHtml()}</div>
            </div>
          </div>

          <div class="settings-footer">
            <button class="btn btn-primary" type="submit">Save changes</button>
            <p class="message" id="profile-message" role="status" aria-live="polite"></p>
          </div>
        </form>
      </div>
      <p class="message" id="page-message" role="status" aria-live="polite"></p>
    `,
  });
  bindChrome({ backTo: `queue-${businessId}`, servicesFor: businessId, branchesFor: businessId, profileFor: businessId });
  focusPage();

  const loading = document.getElementById("profile-loading");
  const shell = document.getElementById("profile-shell");
  const form = document.getElementById("profile-form");
  const pageMessage = document.getElementById("page-message");
  const message = document.getElementById("profile-message");
  const hoursRoot = document.getElementById("profile-hours");
  const accessibilityRoot = document.getElementById("profile-accessibility");
  const branchTitle = document.getElementById("profile-branch-title");
  const branchMeta = document.getElementById("profile-branch-meta");
  const branchSelect = document.getElementById("profile-branch-select");
  const pageTitle = document.querySelector(".page-title");
  const pageSub = document.querySelector(".page-sub");
  const tabs = [...form.querySelectorAll(".settings-tab")];
  const panels = [...form.querySelectorAll(".settings-panel")];
  let currentTab = initialTab;
  let currentBranchId = Number(businessId);
  let siblingBranches = [];

  function activateTab(tabId) {
    currentTab = tabId;
    sessionStorage.setItem("vendor-settings-tab", tabId);
    tabs.forEach((tab) => {
      const active = tab.dataset.tab === tabId;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => {
      const active = panel.dataset.panel === tabId;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
    message.textContent = "";
    message.classList.remove("success");
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      tabs[next].focus();
      activateTab(tabs[next].dataset.tab);
    });
  });

  function applyBranch(business) {
    currentBranchId = Number(business.id);
    const name = business.name || "Untitled branch";
    branchTitle.textContent = name;
    const metaParts = [business.business_name, business.location].filter(Boolean);
    branchMeta.textContent = metaParts.length ? metaParts.join(" · ") : "";
    if (pageTitle) pageTitle.textContent = name;
    if (pageSub) {
      pageSub.textContent = business.business_name
        ? `${business.business_name} — branch settings`
        : "Details, hours, and accessibility for this location.";
    }
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
    message.textContent = "";
    message.classList.remove("success");
  }

  function fillBranchSelect(branches, selectedId) {
    siblingBranches = branches;
    branchSelect.innerHTML = branches
      .map(
        (branch) => `
          <option value="${branch.id}" ${Number(branch.id) === Number(selectedId) ? "selected" : ""}>
            ${escapeHtml(branch.name || `Branch ${branch.id}`)}${branch.is_active ? "" : " (inactive)"}
          </option>
        `
      )
      .join("");
    branchSelect.disabled = branches.length <= 1;
    document.querySelector(".branch-switcher-control")?.classList.toggle("is-single", branches.length <= 1);
  }

  branchSelect.addEventListener("change", () => {
    const nextId = Number(branchSelect.value);
    if (!nextId || nextId === currentBranchId) return;
    sessionStorage.setItem("vendor-settings-tab", currentTab);
    go(`profile-${nextId}`);
  });

  try {
    const [business, branchList] = await Promise.all([
      api(`/vendor/businesses/${businessId}`),
      api(`/vendor/businesses/${businessId}/branches`),
    ]);
    loading.remove();
    shell.classList.remove("hidden");
    fillBranchSelect(branchList.branches || [], business.id);
    applyBranch(business);
    activateTab(currentTab);
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
      const updated = await api(`/vendor/businesses/${currentBranchId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: document.getElementById("profile-name").value.trim(),
          is_active: document.getElementById("profile-active").checked,
          operating_schedule: readHoursSchedule(hoursRoot),
          accessibility_options: readAccessibilityOptions(accessibilityRoot),
        }),
      });
      applyBranch(updated);
      fillBranchSelect(
        siblingBranches.map((branch) =>
          Number(branch.id) === Number(updated.id)
            ? { ...branch, name: updated.name, is_active: updated.is_active }
            : branch
        ),
        updated.id
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

  void ensureWebPushRegistered({ interactive: false });

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
