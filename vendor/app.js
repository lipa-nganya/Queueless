const API_ORIGIN =
  window.QUEUELESS_API_ORIGIN ||
  (["localhost", "127.0.0.1"].includes(location.hostname)
    ? "http://localhost:4000"
    : location.origin);
const API_BASE = `${API_ORIGIN}/api`;
const TOKEN_KEY = "queueless_vendor_token";
const POLL_MS = 8000;

const app = document.getElementById("app");

let pollTimer = null;
let selectedBusinessId = null;

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

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function schedulePoll(fn) {
  stopPolling();
  if (document.hidden) return;
  pollTimer = setTimeout(fn, POLL_MS);
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

  if (response.status === 401) {
    clearToken();
    go("login");
    throw new Error(data.error || "Session expired. Please sign in again.");
  }
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function topbar({ back = false, title = "" } = {}) {
  return `
    <div class="topbar">
      <div style="display:flex;align-items:center;gap:.6rem">
        ${back ? `<button type="button" class="back-btn" id="back-btn" aria-label="Back">←</button>` : ""}
        <div>
          <div class="brand">Queue<span>less</span> Vendor</div>
          ${title ? `<div class="page-sub">${escapeHtml(title)}</div>` : ""}
        </div>
      </div>
      <div class="topbar-actions">
        <button class="btn btn-secondary" type="button" id="logout-btn">Sign out</button>
      </div>
    </div>
  `;
}

function bindChrome({ backTo = "businesses" } = {}) {
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
}

function renderLogin() {
  stopPolling();
  app.innerHTML = `
    <div class="login-shell">
      <form class="login-card" id="login-form">
        <h1>Queue<span>less</span></h1>
        <p>Vendor sign in — manage your business queues.</p>
        <div class="field">
          <label for="username">Username or email</label>
          <input id="username" name="username" autocomplete="username" value="vendor" required />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" value="vendor123" required />
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:1.2rem" type="submit">Sign in</button>
        <p class="message" id="login-message" role="status"></p>
      </form>
    </div>
  `;

  document.getElementById("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const message = document.getElementById("login-message");
    const button = form.querySelector("button[type=submit]");
    message.textContent = "";
    button.disabled = true;
    try {
      const session = await api("/vendor/login", {
        method: "POST",
        body: JSON.stringify({
          username: data.username,
          password: data.password,
        }),
      });
      setToken(session.token);
      go("businesses");
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

async function renderBusinesses() {
  stopPolling();
  app.innerHTML = `
    <div class="shell">
      ${topbar()}
      <h1 class="page-title">Your businesses</h1>
      <p class="page-sub">Pick a business to manage its live queue.</p>
      <p class="empty" id="biz-loading">Loading…</p>
      <div class="biz-list" id="biz-list"></div>
      <p class="message" id="page-message" role="status"></p>
    </div>
  `;
  bindChrome();

  const list = document.getElementById("biz-list");
  const loading = document.getElementById("biz-loading");
  const message = document.getElementById("page-message");

  try {
    const businesses = await api("/vendor/businesses");
    loading.remove();
    if (!businesses.length) {
      list.innerHTML = `<p class="empty">No businesses assigned yet. Ask an admin to link you to a business.</p>`;
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
          <button type="button" class="biz-card" data-id="${business.id}">
            <div>
              <h3>${escapeHtml(business.name)}</h3>
              <div class="meta">
                ${escapeHtml(business.business_group_name || "")}
                ${business.location ? ` · ${escapeHtml(business.location)}` : ""}
              </div>
              <span class="pill ${business.is_active ? "pill-active" : "pill-inactive"}">
                ${business.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div class="biz-waiting">
              <strong>${business.waiting_total ?? 0}</strong>
              <span>waiting</span>
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
      ${topbar({ back: true, title: "Live queue" })}
      <div id="queue-root"><p class="empty">Loading queue…</p></div>
      <p class="message" id="page-message" role="status"></p>
    </div>
  `;
  bindChrome({ backTo: "businesses" });
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

  try {
    const data = await api(`/vendor/businesses/${businessId}/queue`);
    const business = data.business;
    const entries = data.entries || [];
    const now = entries[0] || null;

    root.innerHTML = `
      <h1 class="page-title">${escapeHtml(business.name)}</h1>
      <p class="page-sub">${escapeHtml(business.business_group_name || "")}${
        business.location ? ` · ${escapeHtml(business.location)}` : ""
      }</p>

      <div class="stats">
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
          <strong>Walk-in baseline</strong>
          <span>People physically in line who did not join via the app</span>
        </div>
        <div class="stepper">
          <button type="button" id="walkin-dec" aria-label="Decrease walk-ins">−</button>
          <strong id="walkin-count">${business.queue_size ?? 0}</strong>
          <button type="button" id="walkin-inc" aria-label="Increase walk-ins">+</button>
        </div>
      </div>

      ${
        !entries.length
          ? `<p class="empty">Queue is clear. Waiting for the next customer.</p>`
          : `<div class="queue-list">
              ${entries
                .map((entry, index) => {
                  const isNow = index === 0;
                  return `
                    <article class="queue-card${isNow ? " now" : ""}">
                      <div class="queue-card-head">
                        <div>
                          <div class="queue-pos">${isNow ? "Now serving" : `Position #${entry.position}`}</div>
                          <h3>${escapeHtml(entry.customer_first_name || "Customer")}</h3>
                          <div class="phone">+${escapeHtml(entry.customer_phone || "")}</div>
                        </div>
                        <div class="queue-wait">
                          <strong>${escapeHtml(formatWaitMinutes(entry.estimated_wait_minutes))}</strong>
                          est. wait
                        </div>
                      </div>
                      ${
                        isNow
                          ? `<div class="queue-actions">
                              <button class="btn btn-primary btn-lg serve-btn" type="button" data-id="${entry.id}">Serve</button>
                              <button class="btn btn-danger no-show-btn" type="button" data-id="${entry.id}">No-show</button>
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

    schedulePoll(() => refreshQueue(businessId));
  } catch (error) {
    if (initial) {
      root.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
    } else if (message) {
      message.textContent = error.message;
    }
    schedulePoll(() => refreshQueue(businessId));
  }
}

async function render() {
  const view = viewFromHash();

  if (!getToken()) {
    if (view !== "login") {
      location.hash = "login";
    }
    renderLogin();
    return;
  }

  if (view === "login") {
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
