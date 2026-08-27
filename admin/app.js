import { GROUP_ICON_KEYS, GROUP_ICON_LABELS, groupIconSvg } from "./group-icons.js";

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

/**
 * Kenya place autocomplete backed by Photon (proxied through /places/search).
 * Returns a small controller so create/edit can read the picked coordinates.
 */
function bindPlaceAutocomplete(input, { listId }) {
  const state = { latitude: null, longitude: null, pickedLabel: "" };
  let timer = null;
  let requestId = 0;

  const wrap = input.closest(".place-field") || input.parentElement;
  let list = document.getElementById(listId);
  if (!list) {
    list = document.createElement("ul");
    list.id = listId;
    list.className = "place-suggestions hidden";
    list.setAttribute("role", "listbox");
    wrap.classList.add("place-field");
    wrap.appendChild(list);
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
          hide();
        });
      });
    } catch (error) {
      if (id !== requestId) return;
      list.innerHTML = `<li class="place-empty">${escapeHtml(error.message || "Search failed")}</li>`;
      list.classList.remove("hidden");
    }
  }

  input.addEventListener("input", () => {
    const query = input.value.trim();
    // Typing freely invalidates a previous pick so we never keep stale coords.
    if (query !== state.pickedLabel) clearCoords();
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
    },
    reset: () => {
      input.value = "";
      clearCoords();
      hide();
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

function renderLogin() {
  app.innerHTML = `
    <div class="login-shell">
      <form class="login-card" id="login-form">
        <h1>Queue<span>less</span> Admin</h1>
        <p>Sign in to manage business groups and businesses.</p>
        <div class="field">
          <label for="username">Username or email</label>
          <input id="username" name="username" autocomplete="username" value="admin" required />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" value="admin123" required />
        </div>
        <button class="btn btn-primary btn-block" type="submit">Sign in</button>
        <p class="message" id="login-message" role="status"></p>
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

function shell(active, content) {
  return `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">Queue<span>less</span></div>
        <nav class="nav">
          <button type="button" data-view="dashboard" class="${active === "dashboard" ? "active" : ""}">Dashboard</button>
          <button type="button" data-view="customers" class="${active === "customers" ? "active" : ""}">Customers</button>
          <button type="button" data-view="groups" class="${active === "groups" ? "active" : ""}">Business groups</button>
          <button type="button" data-view="businesses" class="${active === "businesses" ? "active" : ""}">Businesses</button>
          <button type="button" data-view="vendors" class="${active === "vendors" ? "active" : ""}">Vendors</button>
          <button type="button" data-view="admins" class="${active === "admins" ? "active" : ""}">Admins</button>
          <button type="button" data-view="settings" class="${active === "settings" ? "active" : ""}">Settings</button>
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

async function renderDashboard() {
  app.innerHTML = shell(
    "dashboard",
    `
      <div class="main-header">
        <div>
          <h2>Dashboard</h2>
          <p>Live counts across customers, groups, businesses, and queues.</p>
        </div>
      </div>
      <div class="stats" id="stats">
        <div class="stat"><div class="label">Ongoing queues</div><div class="value">…</div></div>
        <div class="stat"><div class="label">People waiting</div><div class="value">…</div></div>
        <div class="stat"><div class="label">Customers</div><div class="value">…</div></div>
        <div class="stat"><div class="label">Businesses</div><div class="value">…</div></div>
      </div>
      <section class="panel">
        <h3>Busiest queues</h3>
        <div id="top-queues"><p class="empty">Loading…</p></div>
      </section>
      <p class="message" id="page-message"></p>
    `
  );
  bindShellNav();

  const message = document.getElementById("page-message");

  try {
    const data = await api("/dashboard");
    document.getElementById("stats").innerHTML = `
      <div class="stat stat-accent">
        <div class="label">Ongoing queues</div>
        <div class="value">${data.ongoing_queues_count}</div>
      </div>
      <div class="stat">
        <div class="label">People waiting</div>
        <div class="value">${data.people_waiting_count}</div>
      </div>
      <div class="stat">
        <div class="label">Customers</div>
        <div class="value">${data.customers_count}</div>
      </div>
      <div class="stat">
        <div class="label">Businesses</div>
        <div class="value">${data.businesses_count}</div>
        <div class="stat-sub">${data.business_groups_count} groups</div>
      </div>
    `;
    document.getElementById("top-queues").innerHTML = topQueuesHtml(data.top_queues || []);
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
          <div class="field place-field">
            <label for="business-location">Location</label>
            <input id="business-location" name="location" placeholder="Start typing a Kenya place…" autocomplete="off" />
          </div>
          <button class="btn btn-primary" type="submit">Create</button>
        </form>
        <p class="message" id="page-message" role="status"></p>
      </section>
      <div class="table-wrap" id="businesses-table"></div>

      <!-- Edit panel (hidden by default) -->
      <div id="edit-overlay" class="edit-overlay hidden" role="dialog" aria-modal="true" aria-label="Edit business">
        <div class="edit-drawer edit-drawer-wide">
          <div class="edit-drawer-header">
            <h3>Edit business</h3>
            <button type="button" class="btn-icon" id="edit-close" aria-label="Close">✕</button>
          </div>

          <div class="edit-columns">
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
                <div class="field place-field">
                  <label for="edit-location">Location</label>
                  <input id="edit-location" name="location" placeholder="Start typing a Kenya place…" autocomplete="off" />
                </div>
                <div class="field">
                  <label for="edit-phone">Phone</label>
                  <input id="edit-phone" name="phone" placeholder="e.g. 0712 345 678" />
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
        </div>
      </div>
    `
  );
  bindShellNav();

  const message = document.getElementById("page-message");
  const table = document.getElementById("businesses-table");
  const select = document.getElementById("business-group");
  const editOverlay = document.getElementById("edit-overlay");
  const editForm = document.getElementById("edit-form");
  const editMessage = document.getElementById("edit-message");
  const editGroup = document.getElementById("edit-group");
  const editImageInput = document.getElementById("edit-image-input");
  const editImageMessage = document.getElementById("edit-image-message");
  const editImagePreview = document.getElementById("edit-image-preview");
  const editImagePlaceholder = document.getElementById("edit-image-placeholder");

  let editingId = null;
  let allGroups = [];
  let businessesById = new Map();
  const createPlace = bindPlaceAutocomplete(document.getElementById("business-location"), {
    listId: "create-place-suggestions",
  });
  const editPlace = bindPlaceAutocomplete(document.getElementById("edit-location"), {
    listId: "edit-place-suggestions",
  });

  function openEditPanel(business) {
    editingId = business.id;
    editMessage.textContent = "";
    editMessage.classList.remove("success");
    editImageMessage.textContent = "";
    editImageMessage.classList.remove("success");

    editForm.elements["name"].value = business.name || "";
    editForm.elements["description"].value = business.description || "";
    editForm.elements["phone"].value = business.phone || "";
    document.getElementById("edit-active").checked = Boolean(business.is_active);
    editPlace.setFromBusiness(business);

    editGroup.innerHTML =
      `<option value="">Select group</option>` +
      allGroups.map((g) => `<option value="${g.id}"${g.id === business.business_group_id ? " selected" : ""}>${escapeHtml(g.name)}</option>`).join("");

    if (business.image_url) {
      editImagePreview.src = resolveImageUrl(business.image_url);
      editImagePreview.alt = business.name;
      editImagePreview.classList.remove("hidden");
      editImagePlaceholder.classList.add("hidden");
    } else {
      editImagePreview.src = "";
      editImagePreview.classList.add("hidden");
      editImagePlaceholder.classList.remove("hidden");
    }

    editOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    editForm.elements["name"].focus();
  }

  function closeEditPanel() {
    editOverlay.classList.add("hidden");
    document.body.style.overflow = "";
    editingId = null;
    editImageInput.value = "";
  }

  document.getElementById("edit-close").addEventListener("click", closeEditPanel);
  editOverlay.addEventListener("click", (e) => { if (e.target === editOverlay) closeEditPanel(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeEditPanel(); });

  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!editingId) return;
    const data = Object.fromEntries(new FormData(editForm).entries());
    editMessage.textContent = "";
    editMessage.classList.remove("success");
    const btn = editForm.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const coords = editPlace.getCoords();
      const updated = await api(`/businesses/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: data.name,
          business_group_id: Number(data.business_group_id),
          description: data.description,
          location: data.location,
          phone: data.phone,
          latitude: coords.latitude,
          longitude: coords.longitude,
          is_active: document.getElementById("edit-active").checked,
        }),
      });
      editMessage.textContent = "Saved.";
      editMessage.classList.add("success");
      await loadBusinesses();
      // Keep the autocomplete state in sync with what the server stored.
      editPlace.setFromBusiness(updated);
      editForm.elements["name"].value = updated.name;
    } catch (err) {
      editMessage.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  editImageInput.addEventListener("change", async () => {
    const file = editImageInput.files?.[0];
    if (!file || !editingId) return;
    editImageMessage.textContent = "";
    editImageMessage.classList.remove("success");
    const formData = new FormData();
    formData.append("image", file);
    const token = getToken();
    try {
      const response = await fetch(`${API_BASE}/businesses/${editingId}/image`, {
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
      await loadBusinesses();
    } catch (err) {
      editImageMessage.textContent = err.message;
    } finally {
      editImageInput.value = "";
    }
  });

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
    businessesById = new Map(businesses.map((business) => [Number(business.id), business]));
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
            <th>Location</th>
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
                        <span class="cell-sub">${escapeHtml(business.phone || "No phone")}</span>
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
                    ${business.location
                      ? `<span class="cell-location">${PIN_ICON}${escapeHtml(business.location)}</span>`
                      : `<span class="muted">—</span>`}
                  </td>
                  <td>
                    <span class="status-pill ${business.is_active ? "status-active" : "status-inactive"}">
                      ${business.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td class="muted cell-date">${formatDate(business.created_at)}</td>
                  <td class="row-actions">
                    <button class="btn btn-secondary btn-sm edit-btn" data-id="${business.id}">
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
        const business = businessesById.get(Number(btn.dataset.id));
        if (business) openEditPanel(business);
      });
    });
  }

  document.getElementById("business-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const coords = createPlace.getCoords();
    message.textContent = "";
    message.classList.remove("success");

    try {
      await api("/businesses", {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          business_group_id: Number(data.business_group_id),
          location: data.location,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      });
      form.reset();
      createPlace.reset();
      await loadGroupsIntoSelect();
      message.textContent = "Business created as inactive. Activate it when ready for customers.";
      message.classList.add("success");
      await loadBusinesses();
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
          <p>Create vendor logins and assign the businesses they manage.</p>
        </div>
      </div>
      <section class="panel">
        <h3>Create vendor</h3>
        <form id="vendor-form">
          <div class="form-row two">
            <div class="field" style="margin-top:0">
              <label for="vendor-username">Username</label>
              <input id="vendor-username" name="username" placeholder="e.g. js_shaves" required minlength="3" />
            </div>
            <div class="field" style="margin-top:0">
              <label for="vendor-email">Email (optional)</label>
              <input id="vendor-email" name="email" type="email" placeholder="owner@business.com" />
            </div>
            <div class="field" style="margin-top:0">
              <label for="vendor-password">Password</label>
              <input id="vendor-password" name="password" type="password" required minlength="6" autocomplete="new-password" />
            </div>
          </div>
          <div class="field">
            <label>Businesses</label>
            <div class="check-grid" id="vendor-businesses"></div>
          </div>
          <button class="btn btn-primary" type="submit">Create vendor</button>
        </form>
        <p class="message" id="page-message" role="status"></p>
      </section>
      <div class="table-wrap" id="vendors-table"></div>

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
              <label for="vendor-edit-password">New password (optional)</label>
              <input id="vendor-edit-password" name="password" type="password" minlength="6" autocomplete="new-password" />
            </div>
            <div class="field">
              <label>Businesses</label>
              <div class="check-grid" id="vendor-edit-businesses"></div>
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

  function businessChecksHtml(containerId, selectedIds = []) {
    const selected = new Set(selectedIds.map(Number));
    if (!allBusinesses.length) {
      return `<p class="muted">Create a business first.</p>`;
    }
    return allBusinesses
      .map(
        (business) => `
          <label class="check-chip">
            <input type="checkbox" name="${containerId}" value="${business.id}" ${selected.has(Number(business.id)) ? "checked" : ""} />
            <span>${escapeHtml(business.name)}</span>
          </label>
        `
      )
      .join("");
  }

  function selectedBusinessIds(root) {
    return [...root.querySelectorAll("input[type=checkbox]:checked")].map((el) => Number(el.value));
  }

  function openEdit(vendor) {
    editingId = vendor.id;
    editMessage.textContent = "";
    editMessage.classList.remove("success");
    document.getElementById("vendor-edit-username").value = vendor.username || "";
    document.getElementById("vendor-edit-email").value = vendor.email || "";
    document.getElementById("vendor-edit-password").value = "";
    editChecks.innerHTML = businessChecksHtml(
      "edit-biz",
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

  async function loadVendors() {
    const vendors = await api("/admins/vendors");
    vendorsById = new Map(vendors.map((v) => [Number(v.id), v]));
    if (!vendors.length) {
      table.innerHTML = `<p class="empty">No vendors yet.</p>`;
      return;
    }

    table.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Businesses</th>
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
                      <span class="cell-sub">${escapeHtml(vendor.email || "No email")}</span>
                    </div>
                  </td>
                  <td>
                    ${
                      vendor.businesses?.length
                        ? vendor.businesses
                            .map((b) => `<span class="group-chip">${escapeHtml(b.name)}</span>`)
                            .join(" ")
                        : `<span class="muted">None assigned</span>`
                    }
                  </td>
                  <td class="muted cell-date">${formatDate(vendor.created_at)}</td>
                  <td class="row-actions">
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
  }

  document.getElementById("vendor-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    message.textContent = "";
    message.classList.remove("success");
    try {
      await api("/admins/vendors", {
        method: "POST",
        body: JSON.stringify({
          username: data.username,
          email: data.email,
          password: data.password,
          business_ids: selectedBusinessIds(createChecks),
        }),
      });
      form.reset();
      createChecks.innerHTML = businessChecksHtml("create-biz");
      message.textContent = "Vendor created.";
      message.classList.add("success");
      await loadVendors();
    } catch (error) {
      message.textContent = error.message;
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
        business_ids: selectedBusinessIds(editChecks),
      };
      if (data.password) payload.password = data.password;
      await api(`/admins/vendors/${editingId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      editMessage.textContent = "Saved.";
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
    allBusinesses = await api("/businesses");
    createChecks.innerHTML = businessChecksHtml("create-biz");
    await loadVendors();
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
        <h1>Queue<span>less</span> Admin</h1>
        <p id="accept-lead">Checking invite…</p>
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
          <button class="btn btn-primary btn-block" type="submit">Set password &amp; sign in</button>
        </div>
        <p class="message" id="accept-message" role="status"></p>
        <button class="btn btn-secondary btn-block hidden" type="button" id="to-login">Go to sign in</button>
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

  panel.innerHTML = `
    <h3>Notifications</h3>
    <div class="setting-row">
      <div class="setting-copy">
        <div class="setting-title">Send real SMS</div>
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

    <h3 style="margin-top:2rem">Customer support</h3>
    <p class="setting-desc" style="margin:0 0 1rem">
      These details appear on the customer Profile under Contact us, and the
      phone number is also used when a customer needs support during signup.
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

  // "pending" is neither success nor failure: Advanta has taken the message
  // but delivery is not confirmed yet, so it must not be shown as an error.
  const setMessage = (text, tone = "error") => {
    message.textContent = text;
    message.classList.toggle("success", tone === "success");
    message.classList.toggle("pending", tone === "pending");
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
