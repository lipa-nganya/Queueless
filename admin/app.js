import { GROUP_ICON_KEYS, GROUP_ICON_LABELS, groupIconSvg } from "./group-icons.js";
import { accessibilityIconSvg } from "./accessibility-icons.js";

// Empty origin keeps the same-origin "/api" used when the backend serves this UI.
const API_ORIGIN = window.QUEUELESS_API_ORIGIN || "";
const API_BASE = `${API_ORIGIN}/api`;
const TOKEN_KEY = "queueless_admin_token";

// Uploads are stored by the API, so relative paths must resolve against the
// backend rather than the origin serving this UI.
function resolveImageUrl(imageUrl) {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("http")) return imageUrl;
  return API_ORIGIN + imageUrl;
}

const app = document.getElementById("app");

function groupIcon(key) {
  return groupIconSvg(key);
}

const PIN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"/><circle cx="12" cy="11" r="2.2"/></svg>`;

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

function formatHoursDisplay(branchOrValue) {
  if (branchOrValue && typeof branchOrValue === "object" && !Array.isArray(branchOrValue)) {
    if (branchOrValue.operating_hours_display) return branchOrValue.operating_hours_display;
    if (Array.isArray(branchOrValue.operating_schedule)) {
      return parseHoursSchedule(branchOrValue.operating_schedule)
        .map((day) => {
          const short = WEEK_DAYS.find((d) => d.key === day.day)?.short || day.day;
          return day.open ? `${short} ${day.start}–${day.end}` : `${short} Closed`;
        })
        .join("\n");
    }
    if (!branchOrValue.operating_hours) return "";
    return formatHoursDisplay(branchOrValue.operating_hours);
  }
  const raw = String(branchOrValue || "").trim();
  if (!raw) return "";
  if (raw.startsWith("[")) {
    return parseHoursSchedule(raw)
      .map((day) => {
        const short = WEEK_DAYS.find((d) => d.key === day.day)?.short || day.day;
        return day.open ? `${short} ${day.start}–${day.end}` : `${short} Closed`;
      })
      .join("\n");
  }
  return raw;
}

function mountHoursEditor(root, schedule = defaultHoursSchedule()) {
  const days = parseHoursSchedule(schedule);
  root.innerHTML = days
    .map((day) => {
      const meta = WEEK_DAYS.find((d) => d.key === day.day);
      return `
        <div class="hours-day-row" data-day="${day.day}">
          <div class="hours-day-label">${meta?.label || day.day}</div>
          <label class="hours-day-toggle-wrap">
            <input type="checkbox" class="hours-day-toggle" ${day.open ? "checked" : ""} />
            <span class="hours-day-toggle-text">${day.open ? "Open" : "Closed"}</span>
          </label>
          <input class="hours-start" type="time" value="${day.start}" ${day.open ? "" : "disabled"} />
          <span class="hours-sep">to</span>
          <input class="hours-end" type="time" value="${day.end}" ${day.open ? "" : "disabled"} />
        </div>
      `;
    })
    .join("");

  root.querySelectorAll(".hours-day-row").forEach((row) => {
    const toggle = row.querySelector(".hours-day-toggle");
    const label = row.querySelector(".hours-day-toggle-text");
    const start = row.querySelector(".hours-start");
    const end = row.querySelector(".hours-end");
    const sync = () => {
      const open = toggle.checked;
      label.textContent = open ? "Open" : "Closed";
      start.disabled = !open;
      end.disabled = !open;
      row.classList.toggle("is-closed", !open);
    };
    toggle.addEventListener("change", sync);
    sync();
  });
}

function readHoursSchedule(root) {
  return WEEK_DAYS.map((day) => {
    const row = root.querySelector(`.hours-day-row[data-day="${day.key}"]`);
    return {
      day: day.key,
      open: Boolean(row?.querySelector(".hours-day-toggle")?.checked),
      start: row?.querySelector(".hours-start")?.value || "08:00",
      end: row?.querySelector(".hours-end")?.value || "18:00",
    };
  });
}

/**
 * Kenya place autocomplete backed by Photon (proxied through /places/search).
 * Returns a small controller so create/edit can read the picked coordinates.
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
          // mousedown fires before blur, so the pick sticks.
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
    // Typing freely invalidates a previous pick so we never keep stale coords.
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
    setFromBusiness: (business) => {
      input.value = business?.location || "";
      if (
        business?.latitude != null &&
        business?.longitude != null &&
        Number.isFinite(Number(business.latitude)) &&
        Number.isFinite(Number(business.longitude))
      ) {
        setCoords({
          label: business.location || "",
          latitude: Number(business.latitude),
          longitude: Number(business.longitude),
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

const CUSTOMER_STATUS_LABELS = {
  verified: "Verified",
  pending_otp: "Pending OTP",
  otp_expired: "OTP expired",
};

function customerStatusLabel(status) {
  return CUSTOMER_STATUS_LABELS[status] || String(status || "").replace(/_/g, " ");
}

function iconPickerHtml(name, selected) {
  return `
    <div class="icon-picker" role="radiogroup" aria-label="Group icon">
      ${GROUP_ICON_KEYS
        .map(
          (key) => `
            <label class="icon-option${key === selected ? " selected" : ""}" title="${GROUP_ICON_LABELS[key] || key}">
              <input type="radio" name="${name}" value="${key}"${key === selected ? " checked" : ""} />
              ${groupIconSvg(key)}
            </label>
          `
        )
        .join("")}
    </div>
  `;
}

// Keeps the highlighted swatch in step with the checked radio.
function bindIconPicker(root) {
  root.querySelectorAll(".icon-picker").forEach((picker) => {
    picker.addEventListener("change", () => {
      picker.querySelectorAll(".icon-option").forEach((option) => {
        option.classList.toggle("selected", option.querySelector("input").checked);
      });
    });
  });
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

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    clearToken();
    render();
    throw new Error(data.error || "Session expired. Please sign in again.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

/** Format ISO timestamp for <input type="datetime-local"> in Africa/Nairobi. */
function toDatetimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function formatTrialEndsAt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function appVersion() {
  return String(window.QUEUELESS_ADMIN_APP_VERSION || "1.2.0").trim() || "1.2.0";
}

function appVersionHtml({ onDark = false } = {}) {
  return `<p class="app-version${onDark ? " app-version-on-dark" : ""}">v${escapeHtml(appVersion())}</p>`;
}

function renderLogin() {
  app.innerHTML = `
    <div class="login-shell">
      <form class="login-card" id="login-form">
        <div class="auth-brand">
          <p class="brand">Queue<span>less</span></p>
          <span class="auth-badge" aria-hidden="true">Admin</span>
        </div>
        <h1 class="auth-title">Sign in</h1>
        <p class="auth-lead">Manage business groups, vendors, and live queues.</p>
        <div class="field">
          <label for="username">Username or email</label>
          <input id="username" name="username" autocomplete="username" value="admin" required />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" value="admin123" required />
        </div>
        <button class="btn btn-primary btn-block auth-submit" type="submit">Sign in</button>
        <p class="message" id="login-message" role="status"></p>
        ${appVersionHtml()}
      </form>
    </div>
  `;

  const form = document.getElementById("login-form");
  const message = document.getElementById("login-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(form).entries());
    message.textContent = "";
    message.classList.remove("success");

    const button = form.querySelector("button");
    button.disabled = true;

    try {
      const session = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setToken(session.token);
      location.hash = "dashboard";
      render();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

function navIcon(name) {
  const icons = {
    dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>`,
    customers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M2.8 19c1.2-3 3.3-4.5 6.2-4.5S14 16 15.2 19"/><circle cx="17" cy="9" r="2.4"/><path d="M16.2 19c.5-1.6 1.6-2.7 3.5-3.2"/></svg>`,
    groups: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 8h16M4 12h16M4 16h10"/></svg>`,
    businesses: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/></svg>`,
    vendors: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 11h8M8 15h5"/><circle cx="12" cy="8" r="1.4"/></svg>`,
    admins: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3l8 4v5c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V7l8-4Z"/><path d="M9.5 12.2l1.8 1.8 3.4-3.6"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M4.9 6.5l1.6 1.6M17.5 15.9l1.6 1.6M3 12h2.2M18.8 12H21M4.9 17.5l1.6-1.6M17.5 8.1l1.6-1.6"/></svg>`,
    queues: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16M4 12h12M4 17h8"/></svg>`,
    waiting: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>`,
  };
  return icons[name] || icons.dashboard;
}

function shell(active, content) {
  const item = (view, label, icon) => `
    <button type="button" data-view="${view}" class="nav-item${active === view ? " active" : ""}"${
      active === view ? ' aria-current="page"' : ""
    }>
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
        <nav class="nav" aria-label="Admin">
          ${item("dashboard", "Dashboard", "dashboard")}
          ${item("customers", "Customers", "customers")}
          ${item("groups", "Business groups", "groups")}
          ${item("businesses", "Businesses", "businesses")}
          ${item("vendors", "Vendors", "vendors")}
          ${item("admins", "Admins", "admins")}
        </nav>
        <p class="nav-section">Tools</p>
        <nav class="nav nav-tools" aria-label="Tools">
          ${item("settings", "Settings", "settings")}
        </nav>
        <div class="sidebar-foot">
          <button class="btn btn-secondary btn-block" type="button" id="logout-btn">Sign out</button>
        </div>
      </aside>
      <main class="main" id="main">${content}</main>
    </div>
  `;
}

function bindShellNav() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.getAttribute("data-view");
      location.hash = view;
      render();
    });
  });

  document.getElementById("logout-btn")?.addEventListener("click", () => {
    clearToken();
    location.hash = "";
    render();
  });
}

function formatWaitMinutes(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}min`;
}

function topQueuesHtml(queues) {
  if (!queues.length) {
    return `<p class="empty">No one is queueing right now.</p>`;
  }

  // Bars are scaled against the busiest queue so the leader always fills the row.
  const longest = Math.max(...queues.map((queue) => queue.waiting_total));

  return `
    <ol class="queue-bars">
      ${queues
        .map(
          (queue, index) => `
            <li class="queue-bar-row">
              <span class="queue-rank">${index + 1}</span>
              <div class="queue-bar-main">
                <div class="queue-bar-head">
                  <span class="queue-bar-name">${escapeHtml(queue.name)}</span>
                  <span class="queue-bar-count">
                    <strong>${queue.waiting_total}</strong> waiting
                  </span>
                </div>
                <div class="queue-bar-track">
                  <div class="queue-bar-fill" style="width:${Math.round((queue.waiting_total / longest) * 100)}%"></div>
                </div>
                <div class="queue-bar-meta">
                  <span class="group-chip">
                    ${groupIcon(queue.business_group_icon)}
                    ${escapeHtml(queue.business_group_name)}
                  </span>
                  <span>~${escapeHtml(formatWaitMinutes(queue.clear_time_minutes))} to clear</span>
                </div>
              </div>
            </li>
          `
        )
        .join("")}
    </ol>
  `;
}

function topQueuesListHtml(queues) {
  if (!queues.length) {
    return `<p class="empty">No live queues right now.</p>`;
  }

  return `
    <ul class="activity-list">
      ${queues
        .map((queue) => {
          const initial = String(queue.name || "?").trim().charAt(0).toUpperCase() || "?";
          return `
            <li class="activity-item">
              <span class="activity-avatar" aria-hidden="true">${escapeHtml(initial)}</span>
              <div class="activity-copy">
                <strong>${escapeHtml(queue.name)}</strong>
                <span>${escapeHtml(queue.business_group_name || "Business")} · ${queue.waiting_total} waiting</span>
              </div>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

function metricCardHtml({ label, value, sub = "", icon, href }) {
  return `
    <article class="metric-card">
      <div class="metric-card-top">
        <span class="metric-icon" aria-hidden="true">${navIcon(icon)}</span>
      </div>
      <p class="metric-label">${escapeHtml(label)}</p>
      <p class="metric-value">${escapeHtml(String(value))}</p>
      ${sub ? `<p class="metric-sub">${escapeHtml(sub)}</p>` : ""}
      ${
        href
          ? `<button type="button" class="metric-link" data-view="${escapeHtml(href)}">See details →</button>`
          : ""
      }
    </article>
  `;
}

async function renderDashboard() {
  app.innerHTML = shell(
    "dashboard",
    `
      <div class="main-header">
        <div>
          <h2>Dashboard</h2>
          <p>Overview of customers, businesses, and live queues across Queueless.</p>
        </div>
      </div>
      <div class="stats" id="stats">
        ${metricCardHtml({ label: "Ongoing queues", value: "…", icon: "queues" })}
        ${metricCardHtml({ label: "People waiting", value: "…", icon: "waiting" })}
        ${metricCardHtml({ label: "Customers", value: "…", icon: "customers" })}
        ${metricCardHtml({ label: "Businesses", value: "…", icon: "businesses" })}
      </div>
      <div class="dashboard-grid">
        <section class="panel panel-overview">
          <div class="panel-head">
            <h3>Busiest queues</h3>
          </div>
          <div id="top-queues"><p class="empty">Loading…</p></div>
        </section>
        <section class="panel panel-side">
          <div class="panel-head">
            <h3>Live queue list</h3>
          </div>
          <div id="top-queues-list"><p class="empty">Loading…</p></div>
        </section>
      </div>
      <p class="message" id="page-message"></p>
    `
  );
  bindShellNav();

  const message = document.getElementById("page-message");

  try {
    const data = await api("/dashboard");
    document.getElementById("stats").innerHTML = [
      metricCardHtml({
        label: "Ongoing queues",
        value: data.ongoing_queues_count,
        icon: "queues",
        href: "businesses",
      }),
      metricCardHtml({
        label: "People waiting",
        value: data.people_waiting_count,
        icon: "waiting",
        href: "businesses",
      }),
      metricCardHtml({
        label: "Customers",
        value: data.customers_count,
        icon: "customers",
        href: "customers",
      }),
      metricCardHtml({
        label: "Businesses",
        value: data.businesses_count,
        sub: `${data.business_groups_count} groups`,
        icon: "businesses",
        href: "businesses",
      }),
    ].join("");
    const queues = data.top_queues || [];
    document.getElementById("top-queues").innerHTML = topQueuesHtml(queues);
    document.getElementById("top-queues-list").innerHTML = topQueuesListHtml(queues);
    document.querySelectorAll(".metric-link[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        location.hash = button.getAttribute("data-view");
        render();
      });
    });
  } catch (error) {
    message.textContent = error.message;
  }
}

async function renderCustomers() {
  app.innerHTML = shell(
    "customers",
    `
      <div class="main-header">
        <div>
          <h2>Customers</h2>
          <p>Signup OTPs are shown here in web-only mode until SMS is enabled.</p>
        </div>
      </div>
      <div class="table-wrap" id="customers-table"></div>
      <p class="message" id="page-message"></p>
    `
  );
  bindShellNav();

  const message = document.getElementById("page-message");
  const table = document.getElementById("customers-table");

  try {
    const customers = await api("/customers");
    if (!customers.length) {
      table.innerHTML = `<p class="empty">No customers yet.</p>`;
      return;
    }

    table.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Phone</th>
            <th>OTP</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          ${customers
            .map((customer) => {
              const name = customer.first_name || customer.full_name || "Unnamed";
              const otp =
                customer.otp_code && customer.status === "pending_otp"
                  ? `<code class="otp-code">${escapeHtml(customer.otp_code)}</code>`
                  : customer.otp_code && customer.status === "otp_expired"
                    ? `<code class="otp-code otp-expired">${escapeHtml(customer.otp_code)}</code>`
                    : `<span class="muted">—</span>`;
              return `
                <tr>
                  <td>
                    <div class="cell-media">
                      <span class="avatar">${escapeHtml(name.slice(0, 1).toUpperCase())}</span>
                      <span class="cell-title">${escapeHtml(name)}</span>
                    </div>
                  </td>
                  <td class="cell-phone">${escapeHtml(customer.phone || "—")}</td>
                  <td>${otp}</td>
                  <td>
                    <span class="status-pill status-${escapeHtml(customer.status)}">
                      ${escapeHtml(customerStatusLabel(customer.status))}
                    </span>
                  </td>
                  <td class="muted cell-date">${formatDate(customer.created_at)}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  } catch (error) {
    message.textContent = error.message;
  }
}

async function renderGroups() {
  app.innerHTML = shell(
    "groups",
    `
      <div class="main-header">
        <div>
          <h2>Business groups</h2>
          <p>Create the categories customers browse, using the brand group icons.</p>
        </div>
      </div>
      <section class="panel">
        <h3>Create business group</h3>
        <form id="group-form">
          <div class="form-row">
            <div class="field" style="margin-top:0">
              <label for="group-name">Name</label>
              <input id="group-name" name="name" placeholder="e.g. Beauty & Wellness" required />
            </div>
            <button class="btn btn-primary" type="submit">Create</button>
          </div>
          <div class="field">
            <label>Icon</label>
            ${iconPickerHtml("icon", "beauty")}
          </div>
        </form>
        <p class="message" id="page-message" role="status"></p>
      </section>
      <div class="table-wrap" id="groups-table"></div>
    `
  );
  bindShellNav();

  const message = document.getElementById("page-message");
  const table = document.getElementById("groups-table");

  async function loadGroups() {
    const groups = await api("/business-groups");
    if (!groups.length) {
      table.innerHTML = `<p class="empty">No business groups yet.</p>`;
      return;
    }

    table.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Group</th>
            <th>Businesses</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${groups
            .map(
              (group) => `
                <tr>
                  <td>
                    <div class="cell-media">
                      <span class="group-icon">${groupIcon(group.icon)}</span>
                      <span class="cell-title">${escapeHtml(group.name)}</span>
                    </div>
                  </td>
                  <td>
                    <span class="count-badge${group.businesses_count ? "" : " count-zero"}">
                      ${group.businesses_count}
                    </span>
                  </td>
                  <td class="muted cell-date">${formatDate(group.created_at)}</td>
                  <td class="row-actions">
                    <button class="btn btn-secondary btn-sm group-edit-btn"
                      data-id="${group.id}"
                      data-name="${escapeHtml(group.name)}"
                      data-icon="${escapeHtml(group.icon || "")}">
                      Edit
                    </button>
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;

    table.querySelectorAll(".group-edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => openGroupEditor(btn.dataset));
    });
  }

  function openGroupEditor({ id, name, icon }) {
    const existing = document.getElementById("group-edit-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "group-edit-overlay";
    overlay.className = "edit-overlay";
    overlay.innerHTML = `
      <div class="edit-drawer">
        <div class="edit-drawer-header">
          <h3>Edit business group</h3>
          <button type="button" class="btn-icon" id="group-edit-close" aria-label="Close">✕</button>
        </div>
        <form id="group-edit-form">
          <div class="field">
            <label for="group-edit-name">Name</label>
            <input id="group-edit-name" name="name" value="${escapeHtml(name)}" required />
          </div>
          <div class="field">
            <label>Icon</label>
            ${iconPickerHtml("icon", icon || "more")}
          </div>
          <div class="form-row">
            <button class="btn btn-primary" type="submit">Save</button>
            <button class="btn btn-secondary" type="button" id="group-edit-cancel">Cancel</button>
          </div>
          <p class="message" id="group-edit-message" role="status"></p>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
    bindIconPicker(overlay);

    const onKeydown = (event) => {
      if (event.key === "Escape") close();
    };
    const close = () => {
      document.removeEventListener("keydown", onKeydown);
      overlay.remove();
    };
    document.addEventListener("keydown", onKeydown);
    document.getElementById("group-edit-close").onclick = close;
    document.getElementById("group-edit-cancel").onclick = close;
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });

    document.getElementById("group-edit-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const editMessage = document.getElementById("group-edit-message");
      editMessage.textContent = "";
      try {
        await api(`/business-groups/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: data.get("name")?.toString().trim(),
            icon: data.get("icon"),
          }),
        });
        close();
        message.textContent = "Business group updated.";
        message.classList.add("success");
        await loadGroups();
      } catch (error) {
        editMessage.textContent = error.message;
      }
    });
  }

  bindIconPicker(document);

  document.getElementById("group-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = data.get("name")?.toString().trim();
    message.textContent = "";
    message.classList.remove("success");

    try {
      await api("/business-groups", {
        method: "POST",
        body: JSON.stringify({ name, icon: data.get("icon") }),
      });
      form.reset();
      bindIconPicker(document);
      form.querySelectorAll(".icon-option").forEach((option) => {
        option.classList.toggle("selected", option.querySelector("input").checked);
      });
      message.textContent = "Business group created.";
      message.classList.add("success");
      await loadGroups();
    } catch (error) {
      message.textContent = error.message;
    }
  });

  try {
    await loadGroups();
  } catch (error) {
    message.textContent = error.message;
  }
}

async function renderBusinesses() {
  app.innerHTML = shell(
    "businesses",
    `
      <div class="main-header">
        <div>
          <h2>Businesses</h2>
          <p>Create businesses under a group, e.g. J's Shaves under Barber Shop.</p>
        </div>
      </div>
      <section class="panel">
        <h3>Create business</h3>
        <form id="business-form">
          <div class="form-row two">
            <div class="field" style="margin-top:0">
              <label for="business-name">Name</label>
              <input id="business-name" name="name" placeholder="e.g. J's Shaves" required />
            </div>
            <div class="field" style="margin-top:0">
              <label for="business-group">Business group</label>
              <select id="business-group" name="business_group_id" required>
                <option value="">Select group</option>
              </select>
            </div>
          </div>
          <button class="btn btn-primary" type="submit">Create</button>
        </form>
        <p class="message" id="page-message" role="status"></p>
      </section>
      <div class="table-wrap" id="businesses-table"></div>
    `
  );
  bindShellNav();

  const message = document.getElementById("page-message");
  const table = document.getElementById("businesses-table");
  const select = document.getElementById("business-group");
  let allGroups = [];

  async function loadGroupsIntoSelect() {
    allGroups = await api("/business-groups");
    select.innerHTML =
      `<option value="">Select group</option>` +
      allGroups
        .map((group) => `<option value="${group.id}">${escapeHtml(group.name)}</option>`)
        .join("");
    return allGroups;
  }

  async function loadBusinesses() {
    const businesses = await api("/businesses");
    if (!businesses.length) {
      table.innerHTML = `<p class="empty">No businesses yet.</p>`;
      return;
    }

    const iconByGroupId = new Map(allGroups.map((group) => [group.id, group.icon]));

    table.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Business</th>
            <th>Group</th>
            <th>Branches</th>
            <th>Status</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${businesses
            .map(
              (business) => `
                <tr>
                  <td>
                    <div class="cell-media">
                      ${business.image_url
                        ? `<img src="${escapeHtml(resolveImageUrl(business.image_url))}" alt="" class="biz-thumb" />`
                        : `<span class="biz-thumb thumb-empty">${escapeHtml(business.name.slice(0, 1).toUpperCase())}</span>`}
                      <div class="cell-text">
                        <span class="cell-title">${escapeHtml(business.name)}</span>
                        <span class="cell-sub">${escapeHtml(
                          (business.branches || []).length
                            ? `${(business.branches || []).length} branch${
                                (business.branches || []).length === 1 ? "" : "es"
                              }`
                            : "No branches"
                        )}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="group-chip">
                      ${groupIcon(iconByGroupId.get(business.business_group_id))}
                      ${escapeHtml(business.business_group_name)}
                    </span>
                  </td>
                  <td>
                    ${
                      (business.branches || []).length
                        ? `<span class="cell-sub">${(business.branches || [])
                            .map((branch) => escapeHtml(branch.name))
                            .join(", ")}</span>`
                        : `<span class="muted">—</span>`
                    }
                  </td>
                  <td>
                    <span class="status-pill ${business.is_active ? "status-active" : "status-inactive"}">
                      ${business.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td class="muted cell-date">${formatDate(business.created_at)}</td>
                  <td class="row-actions">
                    <button class="btn btn-secondary btn-sm edit-btn" data-id="${business.id}" type="button">
                      Edit
                    </button>
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;

    table.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        location.hash = `businesses/${btn.dataset.id}`;
      });
    });
  }

  document.getElementById("business-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    message.textContent = "";
    message.classList.remove("success");

    try {
      const created = await api("/businesses", {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          business_group_id: Number(data.business_group_id),
        }),
      });
      form.reset();
      await loadGroupsIntoSelect();
      message.textContent = "Business created as inactive. Add a branch location, then activate when ready.";
      message.classList.add("success");
      await loadBusinesses();
      if (created?.id) {
        location.hash = `businesses/${created.id}`;
      }
    } catch (error) {
      message.textContent = error.message;
    }
  });

  try {
    const groups = await loadGroupsIntoSelect();
    if (!groups.length) {
      message.textContent = "Create a business group first.";
    }
    await loadBusinesses();
  } catch (error) {
    message.textContent = error.message;
  }
}

async function renderEditBusiness(businessId) {
  app.innerHTML = shell(
    "businesses",
    `
      <div class="main-header">
        <div>
          <button type="button" class="btn btn-secondary btn-sm" id="back-to-businesses">← Back to businesses</button>
          <h2 style="margin-top:0.85rem">Edit business</h2>
          <p id="edit-business-subtitle">Update brand details and manage branches.</p>
        </div>
      </div>

      <p class="message" id="page-message" role="status"></p>

      <section class="panel">
        <h3>Business details</h3>
        <div class="edit-page-grid">
          <div class="edit-image-section">
            <h4>Business image</h4>
            <div class="image-preview-wrap">
              <img id="edit-image-preview" src="" alt="" class="hidden" />
              <span id="edit-image-placeholder" class="image-placeholder">No image</span>
            </div>
            <label class="btn image-upload-btn" for="edit-image-input">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
                <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
              </svg>
              Upload image
              <input id="edit-image-input" type="file" accept="image/*" style="display:none" />
            </label>
            <p class="message" id="edit-image-message" role="status"></p>
          </div>

          <form id="edit-form">
            <div class="field-grid">
              <div class="field">
                <label for="edit-name">Name</label>
                <input id="edit-name" name="name" required />
              </div>
              <div class="field">
                <label for="edit-group">Business group</label>
                <select id="edit-group" name="business_group_id" required>
                  <option value="">Select group</option>
                </select>
              </div>
              <div class="field field-wide">
                <label for="edit-description">Description</label>
                <textarea id="edit-description" name="description" rows="3" placeholder="Short description of the business…"></textarea>
              </div>
              <div class="field field-wide">
                <div class="setting-row" style="padding:0.85rem 0;border:none">
                  <div class="setting-copy">
                    <div class="setting-title">Active on customer site</div>
                    <p class="setting-desc">Inactive businesses stay hidden from customers until you activate them.</p>
                  </div>
                  <label class="switch">
                    <input type="checkbox" id="edit-active" name="is_active" />
                    <span class="switch-track"><span class="switch-thumb"></span></span>
                  </label>
                </div>
              </div>
            </div>
            <div class="edit-actions">
              <p class="message" id="edit-message" role="status"></p>
              <button class="btn btn-primary" type="submit">Save changes</button>
            </div>
          </form>
        </div>
      </section>

      <section class="panel">
        <h3>Branches</h3>
        <p class="muted" style="margin-top:-0.35rem">Add locations for this business. Vendors see every branch.</p>
        <div id="branches-list" class="branches-list" style="margin-top:1rem"></div>
      </section>

      <section class="panel">
        <h3 id="branch-form-title">Add branch</h3>
        <form id="branch-form">
          <input type="hidden" id="branch-edit-id" value="" />
          <div class="field-grid">
            <div class="field">
              <label for="branch-name">Branch name</label>
              <input id="branch-name" name="name" placeholder="e.g. Westlands" required />
            </div>
            <div class="field">
              <label for="branch-phone">Phone</label>
              <input id="branch-phone" name="phone" placeholder="e.g. 0712 345 678" />
            </div>
            <div class="field place-field field-wide">
              <label for="branch-location">Location</label>
              <input id="branch-location" name="location" placeholder="Start typing a Kenya place…" autocomplete="off" />
            </div>
            <div class="field field-wide">
              <label for="branch-landmark">Landmark <span class="muted">(optional)</span></label>
              <input id="branch-landmark" name="landmark" placeholder="e.g. Opposite Naivas, next to the blue gate" />
            </div>
            <div class="field field-wide">
              <label>Business hours</label>
              <p class="muted" style="margin:0 0 0.55rem">Toggle each day on or off, then pick start and end times.</p>
              <div id="branch-hours" class="hours-editor"></div>
            </div>
            <div class="field field-wide">
              <label>Accessibility</label>
              <p class="muted" style="margin:0 0 0.55rem">Select the options this branch can offer customers.</p>
              <div id="branch-accessibility">${accessibilityEditorHtml()}</div>
            </div>
            <div class="field field-wide">
              <div class="setting-row" style="padding:0.5rem 0;border:none">
                <div class="setting-copy">
                  <div class="setting-title">Branch active</div>
                </div>
                <label class="switch">
                  <input type="checkbox" id="branch-active" name="is_active" checked />
                  <span class="switch-track"><span class="switch-thumb"></span></span>
                </label>
              </div>
            </div>
          </div>
          <div class="edit-actions" style="margin-top:0.75rem">
            <p class="message" id="branch-message" role="status"></p>
            <button class="btn btn-secondary" type="button" id="branch-cancel" hidden>Cancel</button>
            <button class="btn btn-primary" type="submit" id="branch-submit">Add branch</button>
          </div>
        </form>
      </section>

      <section class="panel">
        <h3>Services</h3>
        <p class="muted" style="margin-top:-0.35rem">Services are per branch. Set a service time (minutes) for each one — used for customer wait estimates.</p>
        <div class="field" style="margin-top:0.85rem;max-width:20rem">
          <label for="service-branch">Branch</label>
          <select id="service-branch" name="branch_id"></select>
        </div>
        <div id="services-list" class="services-list" style="margin-top:1rem"></div>
      </section>

      <section class="panel">
        <h3 id="service-form-title">Add service</h3>
        <form id="service-form">
          <input type="hidden" id="service-edit-id" value="" />
          <div class="field-grid">
            <div class="field">
              <label for="service-name">Service name</label>
              <input id="service-name" name="name" placeholder="e.g. Account opening" required />
            </div>
            <div class="field">
              <label for="service-period">Service time (minutes)</label>
              <input id="service-period" name="duration_minutes" type="number" min="1" max="1440" value="15" required />
            </div>
            <div class="field field-wide">
              <label for="service-description">Description</label>
              <textarea id="service-description" name="description" rows="2" placeholder="Optional short description"></textarea>
            </div>
            <div class="field field-wide">
              <div class="setting-row" style="padding:0.5rem 0;border:none">
                <div class="setting-copy">
                  <div class="setting-title">Service active</div>
                </div>
                <label class="switch">
                  <input type="checkbox" id="service-active" name="is_active" checked />
                  <span class="switch-track"><span class="switch-thumb"></span></span>
                </label>
              </div>
            </div>
          </div>
          <div class="edit-actions" style="margin-top:0.75rem">
            <p class="message" id="service-message" role="status"></p>
            <button class="btn btn-secondary" type="button" id="service-cancel" hidden>Cancel</button>
            <button class="btn btn-primary" type="submit" id="service-submit">Add service</button>
          </div>
        </form>
      </section>
    `
  );
  bindShellNav();

  const pageMessage = document.getElementById("page-message");
  const editForm = document.getElementById("edit-form");
  const editMessage = document.getElementById("edit-message");
  const editGroup = document.getElementById("edit-group");
  const editImageInput = document.getElementById("edit-image-input");
  const editImageMessage = document.getElementById("edit-image-message");
  const editImagePreview = document.getElementById("edit-image-preview");
  const editImagePlaceholder = document.getElementById("edit-image-placeholder");
  const branchForm = document.getElementById("branch-form");
  const branchMessage = document.getElementById("branch-message");
  const branchesList = document.getElementById("branches-list");
  const branchCancel = document.getElementById("branch-cancel");
  const branchSubmit = document.getElementById("branch-submit");
  const branchFormTitle = document.getElementById("branch-form-title");
  const branchHours = document.getElementById("branch-hours");
  const branchAccessibility = document.getElementById("branch-accessibility");
  const branchPlace = bindPlaceAutocomplete(document.getElementById("branch-location"), {
    listId: "branch-place-suggestions",
  });
  mountHoursEditor(branchHours, defaultHoursSchedule());
  setAccessibilityOptions(branchAccessibility, []);
  const serviceForm = document.getElementById("service-form");
  const serviceMessage = document.getElementById("service-message");
  const servicesList = document.getElementById("services-list");
  const serviceBranch = document.getElementById("service-branch");
  const serviceCancel = document.getElementById("service-cancel");
  const serviceSubmit = document.getElementById("service-submit");
  const serviceFormTitle = document.getElementById("service-form-title");

  let business = null;
  let currentBranches = [];
  let currentServices = [];
  let allServices = [];
  let allGroups = [];

  document.getElementById("back-to-businesses").addEventListener("click", () => {
    location.hash = "businesses";
  });

  function resetBranchForm() {
    branchForm.reset();
    document.getElementById("branch-edit-id").value = "";
    document.getElementById("branch-active").checked = true;
    branchPlace.reset();
    mountHoursEditor(branchHours, defaultHoursSchedule());
    setAccessibilityOptions(branchAccessibility, []);
    branchFormTitle.textContent = "Add branch";
    branchSubmit.textContent = "Add branch";
    branchCancel.hidden = true;
    branchMessage.textContent = "";
    branchMessage.classList.remove("success");
  }

  function selectedServiceBranchId() {
    const value = Number(serviceBranch?.value);
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  function syncServiceBranchOptions(branches = [], preferredId = null) {
    if (!serviceBranch) return;
    const previous = preferredId || selectedServiceBranchId();
    serviceBranch.innerHTML = (branches || [])
      .map(
        (branch) =>
          `<option value="${branch.id}">${escapeHtml(branch.name || "Branch")}</option>`
      )
      .join("");
    if (!branches.length) {
      serviceBranch.innerHTML = `<option value="">Add a branch first</option>`;
      serviceBranch.disabled = true;
      return;
    }
    serviceBranch.disabled = false;
    const match = branches.find((branch) => Number(branch.id) === Number(previous));
    serviceBranch.value = String(match?.id || branches[0].id);
  }

  function resetServiceForm() {
    serviceForm.reset();
    document.getElementById("service-edit-id").value = "";
    document.getElementById("service-period").value = "15";
    document.getElementById("service-active").checked = true;
    if (selectedServiceBranchId()) {
      serviceBranch.value = String(selectedServiceBranchId());
    }
    serviceFormTitle.textContent = "Add service";
    serviceSubmit.textContent = "Add service";
    serviceCancel.hidden = true;
    serviceMessage.textContent = "";
    serviceMessage.classList.remove("success");
  }

  function fillBusinessForm(data) {
    business = data;
    document.getElementById("edit-business-subtitle").textContent =
      data.name ? `Updating ${data.name}` : "Update brand details and manage branches.";
    editForm.elements["name"].value = data.name || "";
    editForm.elements["description"].value = data.description || "";
    document.getElementById("edit-active").checked = Boolean(data.is_active);
    editGroup.innerHTML =
      `<option value="">Select group</option>` +
      allGroups
        .map(
          (g) =>
            `<option value="${g.id}"${g.id === data.business_group_id ? " selected" : ""}>${escapeHtml(g.name)}</option>`
        )
        .join("");

    if (data.image_url) {
      editImagePreview.src = resolveImageUrl(data.image_url);
      editImagePreview.alt = data.name;
      editImagePreview.classList.remove("hidden");
      editImagePlaceholder.classList.add("hidden");
    } else {
      editImagePreview.src = "";
      editImagePreview.classList.add("hidden");
      editImagePlaceholder.classList.remove("hidden");
    }
  }

  function renderBranchesList(branches = []) {
    currentBranches = branches;
    if (!branches.length) {
      branchesList.innerHTML = `<p class="empty">No branches yet.</p>`;
      return;
    }
    branchesList.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Branch</th>
              <th>Location</th>
              <th>Services</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${branches
              .map((branch) => {
                const branchServices = (allServices || []).filter(
                  (service) => Number(service.branch_id) === Number(branch.id)
                );
                const servicesSummary = branchServices.length
                  ? branchServices
                      .map(
                        (service) =>
                          `${escapeHtml(service.name)} (${Number(service.duration_minutes) || 0} min)`
                      )
                      .join("<br />")
                  : `<span class="muted">No services yet</span>`;
                return `
                  <tr>
                    <td>
                      <div class="cell-text">
                        <span class="cell-title">${escapeHtml(branch.name)}</span>
                        <span class="cell-sub">${escapeHtml(branch.phone || "No phone")}</span>
                      </div>
                    </td>
                    <td>
                      ${
                        branch.location
                          ? `<span class="cell-location">${PIN_ICON}${escapeHtml(branch.location)}${
                              branch.landmark
                                ? `<span class="cell-sub" style="display:block;margin-top:0.2rem">${escapeHtml(branch.landmark)}</span>`
                                : ""
                            }</span>`
                          : `<span class="muted">—</span>`
                      }
                    </td>
                    <td>
                      <div class="cell-sub">${servicesSummary}</div>
                      <button
                        class="btn btn-secondary btn-sm branch-services-btn"
                        data-id="${branch.id}"
                        type="button"
                        style="margin-top:0.45rem"
                      >Add / edit services</button>
                    </td>
                    <td>
                      <span class="status-pill ${branch.is_active ? "status-active" : "status-inactive"}">
                        ${branch.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td class="row-actions">
                      <button class="btn btn-secondary btn-sm branch-edit-btn" data-id="${branch.id}" type="button">Edit</button>
                      <button class="btn btn-secondary btn-sm branch-delete-btn" data-id="${branch.id}" type="button">Delete</button>
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    branchesList.querySelectorAll(".branch-services-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        syncServiceBranchOptions(currentBranches, Number(btn.dataset.id));
        try {
          await reloadBusiness();
        } catch (error) {
          serviceMessage.textContent = error.message;
        }
        resetServiceForm();
        serviceForm.scrollIntoView({ behavior: "smooth", block: "start" });
        document.getElementById("service-name")?.focus();
      });
    });

    branchesList.querySelectorAll(".branch-edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const branch = currentBranches.find((item) => Number(item.id) === Number(btn.dataset.id));
        if (!branch) return;
        document.getElementById("branch-edit-id").value = String(branch.id);
        document.getElementById("branch-name").value = branch.name || "";
        document.getElementById("branch-phone").value = branch.phone || "";
        document.getElementById("branch-landmark").value = branch.landmark || "";
        mountHoursEditor(
          branchHours,
          branch.operating_schedule || branch.operating_hours || defaultHoursSchedule()
        );
        setAccessibilityOptions(
          branchAccessibility,
          branch.accessibility_options || branch.accessibility?.map((item) => item.id) || []
        );
        document.getElementById("branch-active").checked = Boolean(branch.is_active);
        branchPlace.setFromBusiness(branch);
        branchFormTitle.textContent = "Edit branch";
        branchSubmit.textContent = "Save branch";
        branchCancel.hidden = false;
        branchMessage.textContent = "";
        branchForm.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    branchesList.querySelectorAll(".branch-delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this branch?")) return;
        try {
          await api(`/businesses/${businessId}/branches/${btn.dataset.id}`, { method: "DELETE" });
          await reloadBusiness();
          resetBranchForm();
        } catch (error) {
          branchMessage.textContent = error.message;
        }
      });
    });
  }

  async function reloadBusiness() {
    const preferredBranchId = selectedServiceBranchId();
    const [businessData, branches, services] = await Promise.all([
      api(`/businesses/${businessId}`),
      api(`/businesses/${businessId}/branches`),
      api(`/businesses/${businessId}/services`),
    ]);
    const found = {
      ...businessData,
      branches,
      services,
    };
    fillBusinessForm(found);
    currentBranches = found.branches || [];
    allServices = Array.isArray(services) ? services : [];
    syncServiceBranchOptions(currentBranches, preferredBranchId);
    const branchId = selectedServiceBranchId();
    currentServices = branchId
      ? allServices.filter((service) => Number(service.branch_id) === branchId)
      : allServices;
    renderBranchesList(found.branches || []);
    renderServicesList(currentServices);
    return found;
  }

  function renderServicesList(services = []) {
    currentServices = services;
    if (!services.length) {
      servicesList.innerHTML = `<p class="empty">No services yet.</p>`;
      return;
    }
    servicesList.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Service period</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${services
              .map(
                (service) => `
                  <tr>
                    <td>
                      <div class="cell-text">
                        <span class="cell-title">${escapeHtml(service.name)}</span>
                        ${
                          service.description
                            ? `<span class="cell-sub">${escapeHtml(service.description)}</span>`
                            : ""
                        }
                      </div>
                    </td>
                    <td><strong>${Number(service.duration_minutes) || 0}</strong> min</td>
                    <td>
                      <span class="status-pill ${service.is_active ? "status-active" : "status-inactive"}">
                        ${service.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td class="row-actions">
                      <button class="btn btn-secondary btn-sm service-edit-btn" data-id="${service.id}" type="button">Edit</button>
                      <button class="btn btn-secondary btn-sm service-delete-btn" data-id="${service.id}" type="button">Delete</button>
                    </td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    servicesList.querySelectorAll(".service-edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const service = currentServices.find((item) => Number(item.id) === Number(btn.dataset.id));
        if (!service) return;
        document.getElementById("service-edit-id").value = String(service.id);
        document.getElementById("service-name").value = service.name || "";
        document.getElementById("service-period").value = String(service.duration_minutes || 15);
        document.getElementById("service-description").value = service.description || "";
        document.getElementById("service-active").checked = Boolean(service.is_active);
        if (service.branch_id) {
          syncServiceBranchOptions(currentBranches, service.branch_id);
        }
        serviceFormTitle.textContent = "Edit service";
        serviceSubmit.textContent = "Save service";
        serviceCancel.hidden = false;
        serviceMessage.textContent = "";
        serviceForm.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    servicesList.querySelectorAll(".service-delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this service?")) return;
        try {
          await api(`/businesses/${businessId}/services/${btn.dataset.id}`, { method: "DELETE" });
          await reloadBusiness();
          resetServiceForm();
        } catch (error) {
          serviceMessage.textContent = error.message;
        }
      });
    });
  }

  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(editForm).entries());
    editMessage.textContent = "";
    editMessage.classList.remove("success");
    const btn = editForm.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const updated = await api(`/businesses/${businessId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: data.name,
          business_group_id: Number(data.business_group_id),
          description: data.description,
          is_active: document.getElementById("edit-active").checked,
        }),
      });
      editMessage.textContent = "Saved.";
      editMessage.classList.add("success");
      await reloadBusiness();
      editForm.elements["name"].value = updated.name;
    } catch (err) {
      editMessage.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  branchCancel.addEventListener("click", resetBranchForm);

  branchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(branchForm).entries());
    const coords = branchPlace.getCoords();
    const branchId = document.getElementById("branch-edit-id").value;
    branchMessage.textContent = "";
    branchMessage.classList.remove("success");
    branchSubmit.disabled = true;
    try {
      const payload = {
        name: data.name,
        phone: data.phone,
        location: data.location,
        landmark: data.landmark,
        operating_schedule: readHoursSchedule(branchHours),
        accessibility_options: readAccessibilityOptions(branchAccessibility),
        latitude: coords.latitude,
        longitude: coords.longitude,
        is_active: document.getElementById("branch-active").checked,
      };
      if (branchId) {
        await api(`/businesses/${businessId}/branches/${branchId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        branchMessage.textContent = "Branch updated.";
      } else {
        await api(`/businesses/${businessId}/branches`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        branchMessage.textContent = "Branch added.";
      }
      branchMessage.classList.add("success");
      await reloadBusiness();
      resetBranchForm();
    } catch (error) {
      branchMessage.textContent = error.message;
    } finally {
      branchSubmit.disabled = false;
    }
  });

  serviceCancel.addEventListener("click", resetServiceForm);

  serviceBranch?.addEventListener("change", async () => {
    resetServiceForm();
    try {
      await reloadBusiness();
    } catch (error) {
      serviceMessage.textContent = error.message;
    }
  });

  serviceForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(serviceForm).entries());
    const serviceId = document.getElementById("service-edit-id").value;
    const branchId = selectedServiceBranchId();
    serviceMessage.textContent = "";
    serviceMessage.classList.remove("success");
    if (!branchId) {
      serviceMessage.textContent = "Add a branch before creating services.";
      return;
    }
    serviceSubmit.disabled = true;
    try {
      const payload = {
        name: data.name,
        duration_minutes: Number(data.duration_minutes),
        description: data.description,
        is_active: document.getElementById("service-active").checked,
        branch_id: branchId,
      };
      if (serviceId) {
        await api(`/businesses/${businessId}/services/${serviceId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        serviceMessage.textContent = "Service updated.";
      } else {
        await api(`/businesses/${businessId}/services`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        serviceMessage.textContent = "Service added.";
      }
      serviceMessage.classList.add("success");
      await reloadBusiness();
      resetServiceForm();
    } catch (error) {
      serviceMessage.textContent = error.message;
    } finally {
      serviceSubmit.disabled = false;
    }
  });

  editImageInput.addEventListener("change", async () => {
    const file = editImageInput.files?.[0];
    if (!file) return;
    editImageMessage.textContent = "";
    editImageMessage.classList.remove("success");
    const formData = new FormData();
    formData.append("image", file);
    const token = getToken();
    try {
      const response = await fetch(`${API_BASE}/businesses/${businessId}/image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      editImagePreview.src = resolveImageUrl(result.image_url) + "?t=" + Date.now();
      editImagePreview.classList.remove("hidden");
      editImagePlaceholder.classList.add("hidden");
      editImageMessage.textContent = "Image updated.";
      editImageMessage.classList.add("success");
      await reloadBusiness();
    } catch (err) {
      editImageMessage.textContent = err.message;
    } finally {
      editImageInput.value = "";
    }
  });

  try {
    allGroups = await api("/business-groups");
    const loaded = await reloadBusiness();
    if (!loaded) return;
    resetBranchForm();
    resetServiceForm();
    editForm.elements["name"].focus();
  } catch (error) {
    pageMessage.textContent = error.message;
  }
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function publicApi(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

async function renderVendors() {
  app.innerHTML = shell(
    "vendors",
    `
      <div class="main-header">
        <div>
          <h2>Vendors</h2>
          <p>Pre-register a phone, assign businesses, then activate when they are ready to manage queues.</p>
        </div>
      </div>
      <section class="panel">
        <div class="panel-head">
          <h3>Pre-register vendor</h3>
        </div>
        <form id="vendor-form">
          <div class="field-grid vendor-form-grid">
            <div class="field" style="margin-top:0">
              <label for="vendor-phone">WhatsApp phone</label>
              <input id="vendor-phone" name="phone" placeholder="07XXXXXXXX" inputmode="tel" required />
            </div>
            <div class="field" style="margin-top:0">
              <label for="vendor-username">Username <span class="label-optional">optional</span></label>
              <input id="vendor-username" name="username" placeholder="Defaults from phone" minlength="3" />
            </div>
            <div class="field" style="margin-top:0">
              <label for="vendor-email">Email <span class="label-optional">optional</span></label>
              <input id="vendor-email" name="email" type="email" placeholder="owner@business.com" />
            </div>
            <div class="field" style="margin-top:0">
              <label for="vendor-trial-ends">Trial ends (EAT) <span class="label-optional">optional</span></label>
              <input id="vendor-trial-ends" name="trial_ends_at" type="datetime-local" />
            </div>
          </div>
          <div class="field">
            <label id="vendor-businesses-label">Assign businesses</label>
            <div class="biz-picker" id="vendor-businesses" aria-labelledby="vendor-businesses-label"></div>
            <p class="field-help">Optional. Search and add businesses this vendor should manage.</p>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" type="submit">Pre-register vendor</button>
            <p class="message" id="page-message" role="status"></p>
          </div>
        </form>
      </section>
      <section class="panel panel-stack">
        <div class="panel-head panel-head-split">
          <h3>All vendors</h3>
          <label class="table-filter" for="vendor-search">
            <span class="sr-only">Search vendors</span>
            <input id="vendor-search" type="search" placeholder="Search vendors…" />
          </label>
        </div>
        <div class="table-wrap table-wrap-flush" id="vendors-table"></div>
      </section>

      <div id="vendor-edit-overlay" class="edit-overlay hidden" role="dialog" aria-modal="true" aria-label="Edit vendor">
        <div class="edit-drawer">
          <div class="edit-drawer-header">
            <h3>Edit vendor</h3>
            <button type="button" class="btn-icon" id="vendor-edit-close" aria-label="Close">✕</button>
          </div>
          <form id="vendor-edit-form">
            <div class="field">
              <label>Username</label>
              <input id="vendor-edit-username" disabled />
            </div>
            <div class="field">
              <label for="vendor-edit-email">Email</label>
              <input id="vendor-edit-email" name="email" type="email" />
            </div>
            <div class="field">
              <label for="vendor-edit-phone">WhatsApp phone</label>
              <input id="vendor-edit-phone" name="phone" placeholder="07XXXXXXXX" inputmode="tel" required />
            </div>
            <div class="field">
              <label for="vendor-edit-trial-ends">Trial ends (EAT)</label>
              <input id="vendor-edit-trial-ends" name="trial_ends_at" type="datetime-local" />
              <p class="field-help">Changing the trial end date notifies the vendor.</p>
            </div>
            <div class="field">
              <label id="vendor-edit-businesses-label">Assign businesses</label>
              <div class="biz-picker" id="vendor-edit-businesses" aria-labelledby="vendor-edit-businesses-label"></div>
              <p class="field-help">Search and add businesses this vendor can manage.</p>
            </div>
            <div class="edit-actions">
              <p class="message" id="vendor-edit-message" role="status"></p>
              <button class="btn btn-primary" type="submit">Save changes</button>
            </div>
          </form>
        </div>
      </div>
    `
  );
  bindShellNav();

  const message = document.getElementById("page-message");
  const table = document.getElementById("vendors-table");
  const createChecks = document.getElementById("vendor-businesses");
  const editOverlay = document.getElementById("vendor-edit-overlay");
  const editForm = document.getElementById("vendor-edit-form");
  const editMessage = document.getElementById("vendor-edit-message");
  const editChecks = document.getElementById("vendor-edit-businesses");
  let allBusinesses = [];
  let editingId = null;
  let vendorsById = new Map();
  let inviteContact = { phone: "+254712674333", email: "" };
  let vendorWebUrl = "https://vendor.queueless.thewolfgang.tech";
  let vendorAppUrl = "";
  function normalizeInvitePhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return null;
    if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
    if (digits.length === 9 && digits.startsWith("7")) return `254${digits}`;
    return digits;
  }

  function vendorBusinessNames(vendor) {
    return (vendor?.businesses || [])
      .map((business) => business.name)
      .filter(Boolean);
  }

  function buildVendorWhatsAppMessage({ vendor, password = "" }) {
    const businesses = vendorBusinessNames(vendor);
    const businessLabel = businesses.length ? businesses.join(", ") : "your business";
    const lines = [
      "Queueless Vendor",
      "",
      `You're set up to manage ${businessLabel} on Queueless.`,
      "",
      "Create your account (or sign in) with your phone number in the Queueless Vendor app.",
      "We'll text a code so you can create a 4-digit PIN.",
      "An admin will activate your account before you can manage queues.",
      "",
    ];
    if (vendor?.trial_ends_at) {
      lines.push(`Your trial ends on ${formatTrialEndsAt(vendor.trial_ends_at)} EAT.`);
      lines.push("");
    }
    if (vendorAppUrl) {
      lines.push(`Install the Queueless Vendor app: ${vendorAppUrl}`);
      lines.push(`Or visit the vendor web app: ${vendorWebUrl}`);
    } else {
      lines.push(`Open the Queueless Vendor web app: ${vendorWebUrl}`);
      lines.push("Or install the Queueless Vendor app when available.");
    }
    lines.push("");
    if (inviteContact.phone) lines.push(`Wolfgang phone: ${inviteContact.phone}`);
    if (inviteContact.email) lines.push(`Wolfgang email: ${inviteContact.email}`);
    return lines.join("\n").trim();
  }

  function vendorStatusLabel(status) {
    if (status === "active") return "Active";
    if (status === "pending_activation") return "Pending activation";
    if (status === "awaiting_pin") return "Awaiting PIN";
    return status || "Unknown";
  }

  function openVendorWhatsAppInvite({ vendor, password = "" }) {
    const phone = normalizeInvitePhone(vendor?.phone);
    if (!phone) {
      throw new Error("Add a WhatsApp phone number before opening WhatsApp.");
    }
    const text = buildVendorWhatsAppMessage({ vendor, password });
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    return text;
  }

  function selectedBusinessIds(root) {
    return Array.isArray(root?._selectedIds) ? root._selectedIds.map(Number) : [];
  }

  function mountBusinessPicker(root, selectedIds = []) {
    if (!root) return;
    const selected = new Set(selectedIds.map(Number).filter(Number.isFinite));
    let query = "";
    let menuOpen = false;

    const sync = () => {
      root._selectedIds = [...selected];
    };

    const closeMenu = () => {
      menuOpen = false;
      const menu = root.querySelector(".biz-picker-menu");
      if (menu) menu.classList.add("hidden");
    };

    const openMenu = () => {
      if (!allBusinesses.length) return;
      menuOpen = true;
      paintMenu();
    };

    const paintMenu = () => {
      const menu = root.querySelector(".biz-picker-menu");
      const search = root.querySelector(".biz-picker-search");
      if (!menu || !search) return;
      const q = query.trim().toLowerCase();
      const options = allBusinesses.filter((business) => {
        if (selected.has(Number(business.id))) return false;
        if (!q) return true;
        const haystack = `${business.name || ""} ${business.business_group_name || ""}`.toLowerCase();
        return haystack.includes(q);
      });

      if (!menuOpen) {
        menu.classList.add("hidden");
        menu.innerHTML = "";
        return;
      }

      if (!options.length) {
        menu.classList.remove("hidden");
        menu.innerHTML = `<div class="biz-picker-empty-row">${
          allBusinesses.length
            ? selected.size === allBusinesses.length
              ? "All businesses already assigned"
              : "No matching businesses"
            : "Create a business first"
        }</div>`;
        return;
      }

      menu.classList.remove("hidden");
      menu.innerHTML = options
        .slice(0, 40)
        .map(
          (business) => `
            <button type="button" class="biz-picker-option" data-id="${business.id}" role="option">
              <span class="biz-picker-option-title">${escapeHtml(business.name)}</span>
              <span class="biz-picker-option-sub">${escapeHtml(business.business_group_name || "Business")}</span>
            </button>
          `
        )
        .join("");
    };

    const paint = () => {
      sync();
      const selectedBusinesses = allBusinesses.filter((business) => selected.has(Number(business.id)));
      const canAdd = allBusinesses.some((business) => !selected.has(Number(business.id)));

      root.innerHTML = `
        <div class="biz-picker-shell">
          <div class="biz-picker-selected" role="list" aria-label="Assigned businesses">
            ${
              selectedBusinesses.length
                ? selectedBusinesses
                    .map(
                      (business) => `
                        <span class="biz-tag" role="listitem">
                          <span class="biz-tag-copy">
                            <span class="biz-tag-title">${escapeHtml(business.name)}</span>
                            ${
                              business.business_group_name
                                ? `<span class="biz-tag-sub">${escapeHtml(business.business_group_name)}</span>`
                                : ""
                            }
                          </span>
                          <button type="button" class="biz-tag-remove" data-id="${business.id}" aria-label="Remove ${escapeHtml(business.name)}">×</button>
                        </span>
                      `
                    )
                    .join("")
                : `<span class="biz-picker-placeholder">No businesses assigned yet</span>`
            }
          </div>
          <div class="biz-picker-add">
            <input
              type="search"
              class="biz-picker-search"
              placeholder="${allBusinesses.length ? "Search businesses to add…" : "No businesses available"}"
              ${allBusinesses.length && canAdd ? "" : "disabled"}
              aria-autocomplete="list"
              aria-expanded="false"
              autocomplete="off"
            />
            <div class="biz-picker-menu hidden" role="listbox"></div>
          </div>
        </div>
      `;

      const search = root.querySelector(".biz-picker-search");
      search.value = query;

      search.addEventListener("focus", () => {
        menuOpen = true;
        search.setAttribute("aria-expanded", "true");
        paintMenu();
      });

      search.addEventListener("input", () => {
        query = search.value;
        menuOpen = true;
        search.setAttribute("aria-expanded", "true");
        paintMenu();
      });

      search.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeMenu();
          search.blur();
        }
      });

      root.querySelectorAll(".biz-tag-remove").forEach((btn) => {
        btn.addEventListener("click", () => {
          selected.delete(Number(btn.dataset.id));
          paint();
        });
      });

      root.querySelector(".biz-picker-menu")?.addEventListener("click", (event) => {
        const option = event.target.closest(".biz-picker-option");
        if (!option) return;
        selected.add(Number(option.dataset.id));
        query = "";
        paint();
        root.querySelector(".biz-picker-search")?.focus();
      });

      if (menuOpen) paintMenu();
    };

    if (!root._pickerOutsideBound) {
      root._pickerOutsideBound = true;
      document.addEventListener("click", (event) => {
        if (!root.contains(event.target)) closeMenu();
      });
    }

    paint();
  }

  function openEdit(vendor) {
    editingId = vendor.id;
    editMessage.textContent = "";
    editMessage.classList.remove("success");
    document.getElementById("vendor-edit-username").value = vendor.username || "";
    document.getElementById("vendor-edit-email").value = vendor.email || "";
    document.getElementById("vendor-edit-phone").value = vendor.phone || "";
    document.getElementById("vendor-edit-trial-ends").value = toDatetimeLocalValue(
      vendor.trial_ends_at
    );
    mountBusinessPicker(
      editChecks,
      (vendor.businesses || []).map((b) => b.id)
    );
    editOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeEdit() {
    editOverlay.classList.add("hidden");
    document.body.style.overflow = "";
    editingId = null;
  }

  document.getElementById("vendor-edit-close").addEventListener("click", closeEdit);
  editOverlay.addEventListener("click", (e) => {
    if (e.target === editOverlay) closeEdit();
  });

  let cachedVendors = [];

  async function loadVendors() {
    const vendors = await api("/admins/vendors");
    vendorsById = new Map(vendors.map((v) => [Number(v.id), v]));
    cachedVendors = vendors;
    renderVendorRows(document.getElementById("vendor-search")?.value || "");
  }

  function vendorMatchesQuery(vendor, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    const businesses = (vendor.businesses || []).map((b) => b.name).join(" ");
    const haystack = [
      vendor.username,
      vendor.phone,
      vendor.email,
      vendor.status,
      businesses,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  }

  function renderVendorRows(query = "") {
    const vendors = cachedVendors.filter((vendor) => vendorMatchesQuery(vendor, query));
    if (!cachedVendors.length) {
      table.innerHTML = `<p class="empty">No vendors yet.</p>`;
      return;
    }
    if (!vendors.length) {
      table.innerHTML = `<p class="empty">No vendors match “${escapeHtml(String(query).trim())}”.</p>`;
      return;
    }

    table.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Businesses</th>
            <th>Status</th>
            <th>PIN / OTP</th>
            <th>Trial ends</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${vendors
            .map(
              (vendor) => `
                <tr>
                  <td>
                    <div class="cell-text">
                      <span class="cell-title">${escapeHtml(vendor.username)}</span>
                      <span class="cell-sub">${escapeHtml(vendor.phone || vendor.email || "No phone")}</span>
                    </div>
                  </td>
                  <td>
                    <div class="biz-chip-row">
                      ${
                        vendor.businesses?.length
                          ? vendor.businesses
                              .map((b) => `<span class="group-chip">${escapeHtml(b.name)}</span>`)
                              .join("")
                          : `<span class="muted">None assigned</span>`
                      }
                    </div>
                  </td>
                  <td>
                    <span class="status-pill status-${escapeHtml(vendor.status || "awaiting_pin")}">${escapeHtml(
                      vendorStatusLabel(vendor.status)
                    )}</span>
                  </td>
                  <td>
                    ${
                      vendor.otp_code
                        ? `<span class="otp-code">${escapeHtml(vendor.otp_code)}</span>`
                        : vendor.has_pin
                          ? `<span class="status-pill status-active">PIN set</span>`
                          : `<span class="muted">No PIN yet</span>`
                    }
                  </td>
                  <td class="muted cell-date">
                    ${
                      vendor.trial_ends_at
                        ? escapeHtml(formatTrialEndsAt(vendor.trial_ends_at))
                        : `<span class="muted">—</span>`
                    }
                  </td>
                  <td class="muted cell-date">${formatDate(vendor.created_at)}</td>
                  <td class="row-actions">
                    ${
                      vendor.status !== "active"
                        ? `<button class="btn btn-primary btn-sm vendor-activate-btn" data-id="${vendor.id}" ${
                            vendor.phone ? "" : "disabled"
                          } title="${
                            vendor.phone
                              ? "Activate account and notify"
                              : "Add a phone number first"
                          }">Activate</button>`
                        : ""
                    }
                    <button class="btn btn-secondary btn-sm vendor-whatsapp-btn" data-id="${vendor.id}" ${vendor.phone ? "" : "disabled"} title="${vendor.phone ? "Open WhatsApp" : "Add a phone number first"}">WhatsApp</button>
                    <button class="btn btn-secondary btn-sm vendor-edit-btn" data-id="${vendor.id}">Edit</button>
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;

    table.querySelectorAll(".vendor-edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const vendor = vendorsById.get(Number(btn.dataset.id));
        if (vendor) openEdit(vendor);
      });
    });

    table.querySelectorAll(".vendor-activate-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const vendor = vendorsById.get(Number(btn.dataset.id));
        if (!vendor?.phone) {
          message.textContent = "Add a WhatsApp phone number before activating.";
          return;
        }
        if (
          !confirm(
            `Activate ${vendor.username || vendor.phone} and notify ${vendor.phone}?`
          )
        ) {
          return;
        }
        btn.disabled = true;
        message.textContent = "";
        message.classList.remove("success");
        try {
          const result = await api(`/admins/vendors/${vendor.id}/activate`, { method: "POST" });
          if (result.contact_phone || result.contact_email) {
            inviteContact = {
              phone: result.contact_phone || inviteContact.phone,
              email: result.contact_email || inviteContact.email,
            };
          }
          message.textContent = result.message || "Vendor activated.";
          message.classList.add("success");
          await loadVendors();
        } catch (error) {
          message.textContent = error.message;
        } finally {
          btn.disabled = false;
        }
      });
    });

    table.querySelectorAll(".vendor-whatsapp-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const vendor = vendorsById.get(Number(btn.dataset.id));
        if (!vendor?.phone) {
          message.textContent = "Add a WhatsApp phone number before opening WhatsApp.";
          return;
        }
        try {
          openVendorWhatsAppInvite({ vendor });
          message.textContent = "WhatsApp opened. Review and send.";
          message.classList.add("success");
        } catch (error) {
          message.textContent = error.message;
          message.classList.remove("success");
        }
      });
    });
  }

  document.getElementById("vendor-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    message.textContent = "";
    message.classList.remove("success");
    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    try {
      const result = await api("/admins/vendors", {
        method: "POST",
        body: JSON.stringify({
          username: data.username,
          email: data.email,
          phone: data.phone,
          trial_ends_at: data.trial_ends_at || null,
          business_ids: selectedBusinessIds(createChecks),
        }),
      });
      if (result.contact_phone || result.contact_email) {
        inviteContact = {
          phone: result.contact_phone || inviteContact.phone,
          email: result.contact_email || inviteContact.email,
        };
      }
      if (result.vendor_web_url) vendorWebUrl = result.vendor_web_url;
      if (typeof result.vendor_app_url === "string") vendorAppUrl = result.vendor_app_url;

      form.reset();
      mountBusinessPicker(createChecks);
      message.textContent = result.message || "Vendor pre-registered.";
      message.classList.add("success");
      await loadVendors();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submitBtn.disabled = false;
    }
  });

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!editingId) return;
    const data = Object.fromEntries(new FormData(editForm).entries());
    editMessage.textContent = "";
    editMessage.classList.remove("success");
    const btn = editForm.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const payload = {
        email: data.email,
        phone: data.phone,
        trial_ends_at: data.trial_ends_at || null,
        business_ids: selectedBusinessIds(editChecks),
      };
      const result = await api(`/admins/vendors/${editingId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      editMessage.textContent = result.message || "Saved.";
      editMessage.classList.add("success");
      await loadVendors();
      closeEdit();
    } catch (error) {
      editMessage.textContent = error.message;
    } finally {
      btn.disabled = false;
    }
  });

  try {
    const [businesses, settings] = await Promise.all([api("/businesses"), api("/settings")]);
    allBusinesses = businesses;
    inviteContact = {
      phone: settings.contact_phone || "+254712674333",
      email: settings.contact_email || "",
    };
    if (["localhost", "127.0.0.1"].includes(location.hostname)) {
      vendorWebUrl = "http://localhost:3500/";
    } else {
      vendorWebUrl = settings.vendor_web_url || vendorWebUrl;
    }
    vendorAppUrl = settings.vendor_app_url || "";
    mountBusinessPicker(createChecks);
    await loadVendors();
    document.getElementById("vendor-search")?.addEventListener("input", (event) => {
      renderVendorRows(event.target.value);
    });
  } catch (error) {
    message.textContent = error.message;
  }
}

async function renderAdmins() {
  app.innerHTML = shell(
    "admins",
    `
      <div class="main-header">
        <div>
          <h2>Admins</h2>
          <p>Invite teammates by email. They set a password via a secure link.</p>
        </div>
      </div>
      <section class="panel">
        <h3>Invite admin</h3>
        <form class="form-row two" id="invite-form">
          <div class="field" style="margin-top:0">
            <label for="invite-email">Email</label>
            <input id="invite-email" name="email" type="email" placeholder="name@company.com" required />
          </div>
          <div class="field" style="margin-top:0">
            <label for="invite-username">Username (optional)</label>
            <input id="invite-username" name="username" placeholder="Defaults from email" />
          </div>
          <button class="btn btn-primary" type="submit">Send invite</button>
        </form>
        <p class="message" id="page-message" role="status"></p>
        <div id="invite-link-box" class="invite-link-box hidden"></div>
      </section>
      <div class="table-wrap" id="admins-table"></div>
    `
  );
  bindShellNav();

  const message = document.getElementById("page-message");
  const table = document.getElementById("admins-table");
  const linkBox = document.getElementById("invite-link-box");

  function showInviteLink(url, note) {
    if (!url) {
      linkBox.classList.add("hidden");
      linkBox.innerHTML = "";
      return;
    }
    linkBox.classList.remove("hidden");
    linkBox.innerHTML = `
      <p class="muted">${escapeHtml(note || "Copy this invite link:")}</p>
      <code class="invite-link">${escapeHtml(url)}</code>
      <button type="button" class="btn btn-secondary btn-sm" id="copy-invite-link">Copy link</button>
    `;
    document.getElementById("copy-invite-link")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(url);
        message.textContent = "Invite link copied.";
        message.classList.add("success");
      } catch {
        message.textContent = "Could not copy — select the link manually.";
        message.classList.remove("success");
      }
    });
  }

  async function loadAdmins() {
    const admins = await api("/admins");
    if (!admins.length) {
      table.innerHTML = `<p class="empty">No admins yet.</p>`;
      return;
    }

    table.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Status</th>
            <th>Invited by</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${admins
            .map((admin) => {
              const canResend =
                admin.status === "invited" || admin.status === "invite_expired";
              return `
                <tr>
                  <td>${escapeHtml(admin.username)}</td>
                  <td>${escapeHtml(admin.email || "—")}</td>
                  <td><span class="status-pill status-${escapeHtml(admin.status)}">${escapeHtml(admin.status)}</span></td>
                  <td class="muted">${escapeHtml(admin.invited_by_username || "—")}</td>
                  <td>
                    ${
                      canResend
                        ? `<button class="btn btn-secondary btn-sm resend-btn" data-id="${admin.id}">Resend</button>`
                        : ""
                    }
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;

    table.querySelectorAll(".resend-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        message.textContent = "";
        message.classList.remove("success");
        btn.disabled = true;
        try {
          const result = await api(`/admins/${btn.dataset.id}/resend-invite`, {
            method: "POST",
            body: "{}",
          });
          message.textContent = result.message;
          message.classList.add("success");
          showInviteLink(result.invite_url, "Email not configured — share this link:");
          await loadAdmins();
        } catch (error) {
          message.textContent = error.message;
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  document.getElementById("invite-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    message.textContent = "";
    message.classList.remove("success");
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const result = await api("/admins/invite", {
        method: "POST",
        body: JSON.stringify({
          email: data.email,
          username: data.username || undefined,
        }),
      });
      form.reset();
      message.textContent = result.message;
      message.classList.add("success");
      showInviteLink(result.invite_url, "Email not configured — share this link:");
      await loadAdmins();
    } catch (error) {
      message.textContent = error.message;
      showInviteLink(null);
    } finally {
      button.disabled = false;
    }
  });

  try {
    await loadAdmins();
  } catch (error) {
    message.textContent = error.message;
  }
}

function inviteTokenFromHash(view) {
  const match = String(view || "").match(/^accept-invite\/([a-f0-9]+)$/i);
  return match?.[1] || "";
}

async function renderAcceptInvite(view) {
  const token = inviteTokenFromHash(view);
  app.innerHTML = `
    <div class="login-shell">
      <form class="login-card" id="accept-form">
        <div class="auth-brand">
          <p class="brand">Queue<span>less</span></p>
          <span class="auth-badge" aria-hidden="true">Admin</span>
        </div>
        <h1 class="auth-title">Accept invite</h1>
        <p class="auth-lead" id="accept-lead">Checking invite…</p>
        <div id="accept-fields" class="hidden">
          <div class="field">
            <label for="accept-email">Email</label>
            <input id="accept-email" name="email" type="email" readonly />
          </div>
          <div class="field">
            <label for="accept-username">Username</label>
            <input id="accept-username" name="username" autocomplete="username" required />
          </div>
          <div class="field">
            <label for="accept-password">Password</label>
            <input id="accept-password" name="password" type="password" autocomplete="new-password" minlength="8" required />
          </div>
          <div class="field">
            <label for="accept-confirm">Confirm password</label>
            <input id="accept-confirm" name="confirm_password" type="password" autocomplete="new-password" minlength="8" required />
          </div>
          <button class="btn btn-primary btn-block auth-submit" type="submit">Set password &amp; sign in</button>
        </div>
        <p class="message" id="accept-message" role="status"></p>
        <button class="btn btn-secondary btn-block auth-secondary hidden" type="button" id="to-login">Go to sign in</button>
        ${appVersionHtml()}
      </form>
    </div>
  `;

  const lead = document.getElementById("accept-lead");
  const fields = document.getElementById("accept-fields");
  const message = document.getElementById("accept-message");
  const toLogin = document.getElementById("to-login");
  toLogin.addEventListener("click", () => {
    location.hash = "";
    render();
  });

  if (!token) {
    lead.textContent = "This invite link is incomplete.";
    message.textContent = "Ask an admin to send a new invite.";
    toLogin.classList.remove("hidden");
    return;
  }

  try {
    const invite = await publicApi(`/admins/invite/${token}`);
    lead.textContent = "Create your password to activate your admin account.";
    document.getElementById("accept-email").value = invite.email || "";
    document.getElementById("accept-username").value = invite.username || "";
    fields.classList.remove("hidden");
  } catch (error) {
    lead.textContent = "Invite unavailable";
    message.textContent = error.message;
    toLogin.classList.remove("hidden");
    return;
  }

  document.getElementById("accept-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    message.textContent = "";
    message.classList.remove("success");
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const session = await publicApi("/admins/accept-invite", {
        method: "POST",
        body: JSON.stringify({
          token,
          username: data.username,
          password: data.password,
          confirm_password: data.confirm_password,
        }),
      });
      setToken(session.token);
      message.textContent = session.message || "Account activated.";
      message.classList.add("success");
      location.hash = "dashboard";
      render();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

async function renderSettings() {
  app.innerHTML = shell(
    "settings",
    `
      <div class="main-header">
        <div>
          <h2>Settings</h2>
          <p>Configuration that takes effect immediately, without a redeploy.</p>
        </div>
      </div>
      <section class="panel" id="settings-panel">
        <p class="empty">Loading…</p>
      </section>
    `
  );
  bindShellNav();

  const panel = document.getElementById("settings-panel");

  let settings;
  try {
    settings = await api("/settings");
  } catch (error) {
    panel.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
    return;
  }

  const configured = settings.sms_configured;
  const waConfigured = settings.whatsapp_configured;
  const alertChannel = settings.queue_alert_channel === "sms" ? "sms" : "whatsapp";
  const alertsOn = Boolean(settings.whatsapp_enabled);

  panel.innerHTML = `
    <h3>Notifications</h3>
    <div class="setting-row">
      <div class="setting-copy">
        <div class="setting-title">Send real SMS (OTP)</div>
        <p class="setting-desc">
          When off, verification codes are not sent anywhere and are read from
          Admin → Customers. When on, they are delivered to customers by
          ${escapeHtml(settings.sms_provider)} from sender ID
          <code>${escapeHtml(settings.sms_shortcode)}</code>.
        </p>
        ${configured
          ? ""
          : `<p class="setting-warn">Advanta is not configured on the server. Set <code>ADVANTA_API_KEY</code> and <code>ADVANTA_PARTNER_ID</code> to enable this.</p>`}
      </div>
      <label class="switch" title="${configured ? "" : "Advanta is not configured"}">
        <input type="checkbox" id="sms-toggle" ${settings.sms_enabled ? "checked" : ""} ${configured ? "" : "disabled"} />
        <span class="switch-track"><span class="switch-thumb"></span></span>
      </label>
    </div>

    <div class="setting-test ${settings.sms_enabled && configured ? "" : "hidden"}" id="sms-test">
      <div class="field" style="margin-top:0">
        <label for="test-phone">Send a test SMS</label>
        <div class="form-row two">
          <input id="test-phone" placeholder="07XXXXXXXX" inputmode="tel" />
          <button class="btn btn-secondary" type="button" id="test-sms-btn">Send test</button>
        </div>
      </div>
    </div>

    <div class="setting-row" style="margin-top:1.5rem">
      <div class="setting-copy">
        <div class="setting-title">Queue alerts</div>
        <p class="setting-desc">
          Assigned vendors get queue join/leave alerts as Android push
          notifications. This switch still controls WhatsApp/SMS for HQ and
          branch contact phones.
        </p>
      </div>
      <label class="switch" title="Enable queue alerts">
        <input type="checkbox" id="wa-toggle" ${alertsOn ? "checked" : ""} />
        <span class="switch-track"><span class="switch-thumb"></span></span>
      </label>
    </div>

    <div class="channel-switch-wrap" id="alert-channel-wrap">
      <div class="setting-title" style="margin-bottom:0.45rem">Alert channel</div>
      <div class="channel-switch" role="group" aria-label="Queue alert channel">
        <button
          type="button"
          class="channel-option${alertChannel === "whatsapp" ? " active" : ""}"
          data-channel="whatsapp"
          ${waConfigured ? "" : "disabled"}
          title="${waConfigured ? "Send queue alerts on WhatsApp" : "WhatsApp is not configured"}"
        >WhatsApp</button>
        <button
          type="button"
          class="channel-option${alertChannel === "sms" ? " active" : ""}"
          data-channel="sms"
          ${configured ? "" : "disabled"}
          title="${configured ? "Send queue alerts by SMS (Advanta)" : "Advanta is not configured"}"
        >SMS (Advanta)</button>
      </div>
      ${
        alertChannel === "whatsapp" && !waConfigured
          ? `<p class="setting-warn">WhatsApp is not configured. Set <code>WHATSAPP_TOKEN</code> and <code>WHATSAPP_PHONE_NUMBER_ID</code> in the backend env.</p>`
          : ""
      }
      ${
        alertChannel === "sms" && !configured
          ? `<p class="setting-warn">Advanta is not configured. Set <code>ADVANTA_API_KEY</code>, <code>ADVANTA_PARTNER_ID</code> and <code>ADVANTA_SHORTCODE</code>.</p>`
          : ""
      }
      ${
        alertChannel === "whatsapp" && waConfigured
          ? `<p class="setting-desc" style="margin-top:0.65rem">
              Via ${escapeHtml(settings.whatsapp_provider)}.
              ${settings.whatsapp_template
                ? `Using template <code>${escapeHtml(settings.whatsapp_template)}</code>.`
                : "Sending as plain text (Meta may require an approved template for production)."}
            </p>`
          : ""
      }
      ${
        alertChannel === "sms" && configured
          ? `<p class="setting-desc" style="margin-top:0.65rem">
              Via ${escapeHtml(settings.sms_provider)} from sender ID
              <code>${escapeHtml(settings.sms_shortcode)}</code>.
            </p>`
          : ""
      }
    </div>

    <div class="setting-test ${alertsOn && alertChannel === "whatsapp" && waConfigured ? "" : "hidden"}" id="wa-test">
      <div class="field" style="margin-top:0">
        <label for="test-wa-phone">Send a test WhatsApp</label>
        <div class="form-row two">
          <input id="test-wa-phone" placeholder="07XXXXXXXX" inputmode="tel" />
          <button class="btn btn-secondary" type="button" id="test-wa-btn">Send test</button>
        </div>
        <p class="setting-desc" style="margin-top:0.5rem">
          Use an allowlisted number (Meta → Step 1 → To), e.g. <code>0727893741</code>.
          Tests send Meta's <code>hello_world</code> template from the +1 555 test line.
        </p>
      </div>
    </div>

    <div class="setting-test ${alertsOn && alertChannel === "sms" && configured ? "" : "hidden"}" id="alert-sms-test">
      <div class="field" style="margin-top:0">
        <label for="test-alert-sms-phone">Send a test queue-alert SMS</label>
        <div class="form-row two">
          <input id="test-alert-sms-phone" placeholder="07XXXXXXXX" inputmode="tel" />
          <button class="btn btn-secondary" type="button" id="test-alert-sms-btn">Send test</button>
        </div>
      </div>
    </div>

    <h3 style="margin-top:2rem">Customer support</h3>
    <p class="setting-desc" style="margin:0 0 1rem">
      These details appear on the customer Profile under Contact us. The phone
      number is also used as the admin recipient for queue alerts.
    </p>
    <form id="contact-form" class="form-row two">
      <div class="field" style="margin-top:0">
        <label for="contact-phone">Contact phone</label>
        <input id="contact-phone" name="contact_phone" value="${escapeHtml(settings.contact_phone || "")}" placeholder="+254712674333" inputmode="tel" />
      </div>
      <div class="field" style="margin-top:0">
        <label for="contact-email">Contact email</label>
        <input id="contact-email" name="contact_email" type="email" value="${escapeHtml(settings.contact_email || "")}" placeholder="support@queueless.co.ke" />
      </div>
      <button class="btn btn-primary" type="submit">Save contact</button>
    </form>

    <p class="message" id="page-message" role="status"></p>
  `;

  const message = document.getElementById("page-message");
  const toggle = document.getElementById("sms-toggle");
  const testBox = document.getElementById("sms-test");
  const waToggle = document.getElementById("wa-toggle");
  const waTestBox = document.getElementById("wa-test");
  const alertSmsTestBox = document.getElementById("alert-sms-test");
  let currentChannel = alertChannel;

  // "pending" is neither success nor failure: Advanta has taken the message
  // but delivery is not confirmed yet, so it must not be shown as an error.
  const setMessage = (text, tone = "error") => {
    message.textContent = text;
    message.classList.toggle("success", tone === "success");
    message.classList.toggle("pending", tone === "pending");
  };

  const syncAlertTests = (channel, enabled) => {
    waTestBox.classList.toggle("hidden", !(enabled && channel === "whatsapp" && waConfigured));
    alertSmsTestBox.classList.toggle("hidden", !(enabled && channel === "sms" && configured));
  };

  const markChannelActive = (channel) => {
    currentChannel = channel;
    document.querySelectorAll(".channel-option").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.channel === channel);
    });
  };

  toggle?.addEventListener("change", async () => {
    const wanted = toggle.checked;
    toggle.disabled = true;
    setMessage("");
    try {
      const saved = await api("/settings", {
        method: "PUT",
        body: JSON.stringify({ sms_enabled: wanted }),
      });
      toggle.checked = saved.sms_enabled;
      testBox.classList.toggle("hidden", !saved.sms_enabled);
      setMessage(
        saved.sms_enabled
          ? "Real SMS is on. Verification codes now go to customers' phones."
          : "Real SMS is off. Codes are shown in Admin → Customers.",
        "success"
      );
    } catch (error) {
      // Put the switch back where it was so it never misreports the server.
      toggle.checked = !wanted;
      setMessage(error.message);
    } finally {
      toggle.disabled = false;
    }
  });

  waToggle?.addEventListener("change", async () => {
    const wanted = waToggle.checked;
    waToggle.disabled = true;
    setMessage("");
    try {
      const saved = await api("/settings", {
        method: "PUT",
        body: JSON.stringify({
          whatsapp_enabled: wanted,
          queue_alert_channel: currentChannel,
        }),
      });
      waToggle.checked = saved.whatsapp_enabled;
      markChannelActive(saved.queue_alert_channel === "sms" ? "sms" : "whatsapp");
      syncAlertTests(currentChannel, saved.whatsapp_enabled);
      setMessage(
        saved.whatsapp_enabled
          ? `Queue alerts are on via ${currentChannel === "sms" ? "SMS (Advanta)" : "WhatsApp"}.`
          : "Queue alerts are off.",
        "success"
      );
    } catch (error) {
      waToggle.checked = !wanted;
      setMessage(error.message);
    } finally {
      waToggle.disabled = false;
    }
  });

  document.querySelectorAll(".channel-option").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const channel = btn.dataset.channel;
      if (!channel || channel === currentChannel || btn.disabled) return;
      btn.disabled = true;
      setMessage("");
      try {
        const saved = await api("/settings", {
          method: "PUT",
          body: JSON.stringify({ queue_alert_channel: channel }),
        });
        markChannelActive(saved.queue_alert_channel === "sms" ? "sms" : "whatsapp");
        syncAlertTests(currentChannel, waToggle.checked);
        setMessage(
          currentChannel === "sms"
            ? "Queue alerts will send via SMS (Advanta)."
            : "Queue alerts will send via WhatsApp.",
          "success"
        );
      } catch (error) {
        setMessage(error.message);
      } finally {
        document.querySelectorAll(".channel-option").forEach((option) => {
          if (option.dataset.channel === "whatsapp") option.disabled = !waConfigured;
          if (option.dataset.channel === "sms") option.disabled = !configured;
        });
      }
    });
  });

  document.getElementById("contact-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    setMessage("");
    try {
      const saved = await api("/settings", {
        method: "PUT",
        body: JSON.stringify({
          contact_phone: data.contact_phone,
          contact_email: data.contact_email,
        }),
      });
      form.elements.contact_phone.value = saved.contact_phone || "";
      form.elements.contact_email.value = saved.contact_email || "";
      setMessage("Contact details saved. Customers will see them on Profile.", "success");
    } catch (error) {
      setMessage(error.message);
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("test-sms-btn")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const phone = document.getElementById("test-phone").value.trim();
    if (!phone) return setMessage("Enter a phone number to test.");
    button.disabled = true;
    setMessage("Sending…", "pending");
    try {
      const result = await api("/settings/test-sms", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      // Green only on confirmed delivery; amber while it is still queued.
      setMessage(result.message, result.delivered ? "success" : "pending");
    } catch (error) {
      setMessage(error.message);
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("test-alert-sms-btn")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const phone = document.getElementById("test-alert-sms-phone").value.trim();
    if (!phone) return setMessage("Enter a phone number to test.");
    button.disabled = true;
    setMessage("Sending queue-alert SMS…", "pending");
    try {
      const result = await api("/settings/test-sms", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setMessage(result.message, result.delivered ? "success" : "pending");
    } catch (error) {
      setMessage(error.message);
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("test-wa-btn")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const phone = document.getElementById("test-wa-phone").value.trim();
    if (!phone) return setMessage("Enter a phone number to test.");
    button.disabled = true;
    setMessage("Sending WhatsApp…", "pending");
    try {
      const result = await api("/settings/test-whatsapp", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setMessage(result.message, "success");
    } catch (error) {
      setMessage(error.message);
    } finally {
      button.disabled = false;
    }
  });
}

async function render() {
  const view = (location.hash || "#dashboard").replace(/^#/, "") || "dashboard";

  if (view.startsWith("accept-invite")) {
    await renderAcceptInvite(view);
    return;
  }

  if (!getToken()) {
    renderLogin();
    return;
  }

  if (view === "customers") {
    await renderCustomers();
    return;
  }
  if (view === "groups") {
    await renderGroups();
    return;
  }
  if (view === "businesses") {
    await renderBusinesses();
    return;
  }
  const businessEditMatch = view.match(/^businesses\/(\d+)$/);
  if (businessEditMatch) {
    await renderEditBusiness(Number(businessEditMatch[1]));
    return;
  }
  if (view === "vendors") {
    await renderVendors();
    return;
  }
  if (view === "admins") {
    await renderAdmins();
    return;
  }
  if (view === "settings") {
    await renderSettings();
    return;
  }
  await renderDashboard();
}

window.addEventListener("hashchange", render);
render();
