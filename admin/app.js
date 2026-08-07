// Empty origin keeps the same-origin "/api" used when the backend serves this UI.
const API_BASE = `${window.QUEUELESS_API_ORIGIN || ""}/api`;
const TOKEN_KEY = "queueless_admin_token";

const app = document.getElementById("app");

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

async function renderDashboard() {
  app.innerHTML = shell(
    "dashboard",
    `
      <div class="main-header">
        <div>
          <h2>Dashboard</h2>
          <p>Live counts across customers, groups, and businesses.</p>
        </div>
      </div>
      <div class="stats" id="stats">
        <div class="stat"><div class="label">Customers</div><div class="value">…</div></div>
        <div class="stat"><div class="label">Business groups</div><div class="value">…</div></div>
        <div class="stat"><div class="label">Businesses</div><div class="value">…</div></div>
      </div>
      <p class="message" id="page-message"></p>
    `
  );
  bindShellNav();

  const message = document.getElementById("page-message");

  try {
    const data = await api("/dashboard");
    document.getElementById("stats").innerHTML = `
      <div class="stat">
        <div class="label">Customers</div>
        <div class="value">${data.customers_count}</div>
      </div>
      <div class="stat">
        <div class="label">Business groups</div>
        <div class="value">${data.business_groups_count}</div>
      </div>
      <div class="stat">
        <div class="label">Businesses</div>
        <div class="value">${data.businesses_count}</div>
      </div>
    `;
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
            <th>Name</th>
            <th>Phone</th>
            <th>OTP</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          ${customers
            .map((customer) => {
              const otp =
                customer.otp_code && customer.status === "pending_otp"
                  ? `<strong style="color:var(--lime-flow)">${escapeHtml(customer.otp_code)}</strong>`
                  : customer.otp_code && customer.status === "otp_expired"
                    ? `<span class="muted">${escapeHtml(customer.otp_code)} (expired)</span>`
                    : `<span class="muted">—</span>`;
              return `
                <tr>
                  <td>${escapeHtml(customer.first_name || customer.full_name || "—")}</td>
                  <td>${escapeHtml(customer.phone || "—")}</td>
                  <td>${otp}</td>
                  <td>${escapeHtml(customer.status)}</td>
                  <td class="muted">${formatDate(customer.created_at)}</td>
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
        <form class="form-row" id="group-form">
          <div class="field" style="margin-top:0">
            <label for="group-name">Name</label>
            <input id="group-name" name="name" placeholder="e.g. Barber Shop" required />
          </div>
          <button class="btn btn-primary" type="submit">Create</button>
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
            <th>Name</th>
            <th>Businesses</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          ${groups
            .map(
              (group) => `
                <tr>
                  <td>${escapeHtml(group.name)}</td>
                  <td>${group.businesses_count}</td>
                  <td class="muted">${formatDate(group.created_at)}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  document.getElementById("group-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = new FormData(form).get("name")?.toString().trim();
    message.textContent = "";
    message.classList.remove("success");

    try {
      await api("/business-groups", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      form.reset();
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
        <div class="edit-drawer">
          <div class="edit-drawer-header">
            <h3>Edit business</h3>
            <button type="button" class="btn-icon" id="edit-close" aria-label="Close">✕</button>
          </div>
          <form id="edit-form">
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
              <label for="edit-description">Description</label>
              <textarea id="edit-description" name="description" rows="3" placeholder="Short description of the business…"></textarea>
            </div>
            <div class="field">
              <label for="edit-location">Location</label>
              <input id="edit-location" name="location" placeholder="e.g. Tom Mboya St, Nairobi" />
            </div>
            <div class="field">
              <label for="edit-phone">Phone</label>
              <input id="edit-phone" name="phone" placeholder="e.g. 0712 345 678" />
            </div>
            <p class="message" id="edit-message" role="status"></p>
            <div class="edit-actions">
              <button class="btn btn-primary" type="submit">Save changes</button>
            </div>
          </form>

          <div class="edit-image-section">
            <h4>Business image</h4>
            <div class="image-preview-wrap">
              <img id="edit-image-preview" src="" alt="" class="hidden" />
              <span id="edit-image-placeholder" class="image-placeholder">No image</span>
            </div>
            <label class="btn btn-secondary image-upload-btn" for="edit-image-input">
              Choose image
              <input id="edit-image-input" type="file" accept="image/*" style="display:none" />
            </label>
            <p class="message" id="edit-image-message" role="status"></p>
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
      editImagePreview.src = business.image_url;
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
      editImagePreview.src = result.image_url + "?t=" + Date.now();
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
                    ${business.image_url
                      ? `<img src="${escapeHtml(business.image_url)}" alt="${escapeHtml(business.name)}" class="biz-thumb" />`
                      : ""}
                    ${escapeHtml(business.name)}
                  </td>
                  <td>${escapeHtml(business.business_group_name)}</td>
                  <td class="muted">${escapeHtml(business.location || "—")}</td>
                  <td class="muted">${formatDate(business.created_at)}</td>
                  <td>
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
  await renderDashboard();
}

window.addEventListener("hashchange", render);
render();
