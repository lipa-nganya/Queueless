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

// Keys must match GROUP_ICONS in the backend and the icon set in the customer app.
const GROUP_ICONS = {
  scissors: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8.2 7.8 20 18M8.2 16.2 20 6"/></svg>`,
  salon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 19.5c1.4-3.2 3.7-4.8 6.5-4.8s5.1 1.6 6.5 4.8"/></svg>`,
  clinic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>`,
  pharmacy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg>`,
  bank: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10h16M6 10v8M10 10v8M14 10v8M18 10v8M3 18h18M12 4l9 6H3l9-6Z"/></svg>`,
  government: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3.5 19 6v5.5c0 4-2.9 7.3-7 8.9-4.1-1.6-7-4.9-7-8.9V6l7-2.5Z"/></svg>`,
  restaurant: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3v6a2 2 0 0 0 4 0V3M8 11v10M17 3c-1.2 1.6-2 3.4-2 5.2 0 1.6.8 2.6 2 2.8v10"/></svg>`,
  shop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>`,
  car: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 15v-2.5L6 8h12l2 4.5V15H4Z"/><circle cx="7.5" cy="15.5" r="1.5"/><circle cx="16.5" cy="15.5" r="1.5"/></svg>`,
  education: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 5 9 4-9 4-9-4 9-4Z"/><path d="M7 11v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4"/></svg>`,
  fitness: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/></svg>`,
  more: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="6" r="1.5"/><circle cx="12" cy="6" r="1.5"/><circle cx="18" cy="6" r="1.5"/><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/><circle cx="6" cy="18" r="1.5"/><circle cx="12" cy="18" r="1.5"/><circle cx="18" cy="18" r="1.5"/></svg>`,
};

function groupIcon(key) {
  return GROUP_ICONS[key] || GROUP_ICONS.more;
}

const PIN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"/><circle cx="12" cy="11" r="2.2"/></svg>`;

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
      ${Object.keys(GROUP_ICONS)
        .map(
          (key) => `
            <label class="icon-option${key === selected ? " selected" : ""}" title="${key}">
              <input type="radio" name="${name}" value="${key}"${key === selected ? " checked" : ""} />
              ${GROUP_ICONS[key]}
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
          <p>Create categories like Barber Shop, Clinic, or Salon.</p>
        </div>
      </div>
      <section class="panel">
        <h3>Create business group</h3>
        <form id="group-form">
          <div class="form-row">
            <div class="field" style="margin-top:0">
              <label for="group-name">Name</label>
              <input id="group-name" name="name" placeholder="e.g. Barber Shop" required />
            </div>
            <button class="btn btn-primary" type="submit">Create</button>
          </div>
          <div class="field">
            <label>Icon</label>
            ${iconPickerHtml("icon", "scissors")}
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
        <form class="form-row two" id="business-form">
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
                <div class="field">
                  <label for="edit-location">Location</label>
                  <input id="edit-location" name="location" placeholder="e.g. Tom Mboya St, Nairobi" />
                </div>
                <div class="field">
                  <label for="edit-phone">Phone</label>
                  <input id="edit-phone" name="phone" placeholder="e.g. 0712 345 678" />
                </div>
                <div class="field field-wide">
                  <label for="edit-description">Description</label>
                  <textarea id="edit-description" name="description" rows="3" placeholder="Short description of the business…"></textarea>
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

  function openEditPanel(business) {
    editingId = business.id;
    editMessage.textContent = "";
    editMessage.classList.remove("success");
    editImageMessage.textContent = "";
    editImageMessage.classList.remove("success");

    editForm.elements["name"].value = business.name || "";
    editForm.elements["description"].value = business.description || "";
    editForm.elements["location"].value = business.location || "";
    editForm.elements["phone"].value = business.phone || "";

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
      const updated = await api(`/businesses/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: data.name,
          business_group_id: Number(data.business_group_id),
          description: data.description,
          location: data.location,
          phone: data.phone,
        }),
      });
      editMessage.textContent = "Saved.";
      editMessage.classList.add("success");
      await loadBusinesses();
      // update preview if name changed
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
                  <td class="muted cell-date">${formatDate(business.created_at)}</td>
                  <td class="row-actions">
                    <button class="btn btn-secondary btn-sm edit-btn"
                      data-id="${business.id}"
                      data-name="${escapeHtml(business.name)}"
                      data-group="${business.business_group_id}"
                      data-description="${escapeHtml(business.description || "")}"
                      data-location="${escapeHtml(business.location || "")}"
                      data-phone="${escapeHtml(business.phone || "")}"
                      data-image="${escapeHtml(business.image_url || "")}">
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
        openEditPanel({
          id: Number(btn.dataset.id),
          name: btn.dataset.name,
          business_group_id: Number(btn.dataset.group),
          description: btn.dataset.description,
          location: btn.dataset.location,
          phone: btn.dataset.phone,
          image_url: btn.dataset.image,
        });
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
      await api("/businesses", {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          business_group_id: Number(data.business_group_id),
        }),
      });
      form.reset();
      await loadGroupsIntoSelect();
      message.textContent = "Business created.";
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
