// Deployed builds read the backend origin from config.js; locally the API runs on :4000.
const API_ORIGIN =
  window.QUEUELESS_API_ORIGIN ||
  (["localhost", "127.0.0.1"].includes(location.hostname)
    ? "http://localhost:4000"
    : location.origin);
const API_BASE = `${API_ORIGIN}/api`;
const UPLOADS_BASE = API_ORIGIN;
const TOKEN_KEY = "queueless_customer_token";
const PENDING_PHONE_KEY = "queueless_pending_phone";

const COUNTRY_CODES = [
  { code: "254", label: "KE +254" },
  { code: "255", label: "TZ +255" },
  { code: "256", label: "UG +256" },
];

const CATEGORY_ICONS = {
  barbershop: "scissors",
  barber: "scissors",
  salon: "salon",
  clinic: "clinic",
  bank: "bank",
  more: "more",
};

const DEMO_QUEUE = [3, 7, 12, 2, 5, 9, 1, 6];
const DEMO_WAIT = [15, 25, 35, 20, 18, 30, 10, 22];
const DEMO_RATING = [4.8, 4.7, 4.6, 4.5, 4.4, 4.9, 4.3, 4.8];
const DEMO_REVIEWS = [126, 98, 74, 63, 41, 112, 55, 88];
const DEMO_PLACES = [
  "Westlands, Nairobi",
  "Kilimani",
  "Lavington",
  "CBD",
  "Karen",
  "Parklands",
  "Ngong Road",
  "South B",
];
const DEMO_IMAGES = [
  "https://images.unsplash.com/photo-1585747863301-d0cb0cf594bb?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1503951914873-5be48ee5f888?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1599350712515-84975f7c2fe0?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1600948836101-f9ffda59d250?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1560066984-138daaa4e993?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=70",
];

const app = document.getElementById("app");
let discoverState = {
  groups: [],
  businesses: [],
  activeGroupId: null,
  search: "",
  me: null,
};

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function countryCodeOptions(selected = "254") {
  return COUNTRY_CODES.map(
    (item) =>
      `<option value="${item.code}" ${item.code === selected ? "selected" : ""}>${item.label}</option>`
  ).join("");
}

function phoneFieldHtml({
  selectedCode = "254",
  localValue = "",
  required = true,
} = {}) {
  return `
    <div class="field">
      <label for="phone_number">Phone number</label>
      <div class="phone-row">
        <select id="country_code" name="country_code" aria-label="Country code" required>
          ${countryCodeOptions(selectedCode)}
        </select>
        <input
          id="phone_number"
          name="phone_number"
          inputmode="tel"
          placeholder="7XXXXXXXX"
          value="${localValue}"
          ${required ? "required" : ""}
        />
      </div>
    </div>
  `;
}

function buildPhone(countryCode, phoneNumber) {
  const code = String(countryCode || "").replace(/\D/g, "");
  let local = String(phoneNumber || "").replace(/\D/g, "");
  if (local.startsWith("0")) local = local.slice(1);
  if (local.startsWith(code)) return local;
  return `${code}${local}`;
}

function formPhonePayload(formData) {
  const data = Object.fromEntries(formData.entries());
  const phone = buildPhone(data.country_code, data.phone_number);
  delete data.country_code;
  delete data.phone_number;
  return { ...data, phone };
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || "Request failed.");
    error.payload = data;
    error.status = response.status;
    throw error;
  }
  return data;
}

function viewFromHash() {
  return (location.hash || "#signup").replace("#", "") || "signup";
}

function go(view) {
  location.hash = view;
  render();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function icon(name) {
  const icons = {
    scissors: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8.2 7.8 20 18M8.2 16.2 20 6"/></svg>`,
    salon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 19.5c1.4-3.2 3.7-4.8 6.5-4.8s5.1 1.6 6.5 4.8"/></svg>`,
    clinic: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>`,
    bank: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10h16M6 10v8M10 10v8M14 10v8M18 10v8M3 18h18M12 4l9 6H3l9-6Z"/></svg>`,
    more: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="6" cy="6" r="1.5"/><circle cx="12" cy="6" r="1.5"/><circle cx="18" cy="6" r="1.5"/><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/><circle cx="6" cy="18" r="1.5"/><circle cx="12" cy="18" r="1.5"/><circle cx="18" cy="18" r="1.5"/></svg>`,
    search: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>`,
    filter: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M7 12h10M10 18h4"/></svg>`,
    pin: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"/><circle cx="12" cy="11" r="2.2"/></svg>`,
    chevron: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m7 10 5 5 5-5"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 17h12l-1.2-2.1V10a4.8 4.8 0 1 0-9.6 0v4.9L6 17Z"/><path d="M10 17a2 2 0 0 0 4 0"/></svg>`,
    star: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="m12 3.5 2.5 5.1 5.6.8-4 3.9.9 5.6L12 16.8 6.9 19l.9-5.6-4-3.9 5.6-.8L12 3.5Z"/></svg>`,
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m4 11 8-7 8 7v9a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9Z"/></svg>`,
    bookings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>`,
    queue: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="7" cy="8" r="2.2"/><circle cx="12" cy="8" r="2.2"/><circle cx="17" cy="8" r="2.2"/><path d="M3.8 18c.7-2.3 2.3-3.5 3.2-3.5s2.5 1.2 3.2 3.5M8.8 18c.7-2.3 2.3-3.5 3.2-3.5s2.5 1.2 3.2 3.5M13.8 18c.7-2.3 2.3-3.5 3.2-3.5s2.5 1.2 3.2 3.5"/></svg>`,
    profile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 19.5c1.4-3.2 3.7-4.8 6.5-4.8s5.1 1.6 6.5 4.8"/></svg>`,
  };
  return icons[name] || icons.more;
}

function categoryKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function tabbar(active) {
  return `
    <nav class="tabbar">
      <button class="tab ${active === "home" ? "active" : ""}" data-tab="home" type="button">${icon("home")}Home</button>
      <button class="tab ${active === "bookings" ? "active" : ""}" data-tab="bookings" type="button">${icon("bookings")}Bookings</button>
      <button class="tab ${active === "queue" ? "active" : ""}" data-tab="queue" type="button">${icon("queue")}Queue</button>
      <button class="tab ${active === "profile" ? "active" : ""}" data-tab="profile" type="button">${icon("profile")}Profile</button>
    </nav>
  `;
}

function bindTabs() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => go(button.getAttribute("data-tab")));
  });
}

function renderSignup() {
  app.innerHTML = `
    <div class="auth-shell">
      <form class="card" id="signup-form">
        <div class="brand">Queue<span>less</span></div>
        <h2>Create account</h2>
        <p class="lead">Sign up with your phone number and a 4-digit PIN.</p>
        <div class="field">
          <label for="first_name">First name</label>
          <input id="first_name" name="first_name" autocomplete="given-name" required />
        </div>
        ${phoneFieldHtml()}
        <div class="field">
          <label for="pin">Create PIN</label>
          <input id="pin" name="pin" type="password" inputmode="numeric" maxlength="4" pattern="\\d{4}" placeholder="4 digits" required />
        </div>
        <div class="field">
          <label for="confirm_pin">Confirm PIN</label>
          <input id="confirm_pin" name="confirm_pin" type="password" inputmode="numeric" maxlength="4" pattern="\\d{4}" required />
        </div>
        <button class="btn" type="submit">Continue</button>
        <button class="btn-link" type="button" id="to-login">Already have an account? Log in</button>
        <p class="message" id="message" role="status"></p>
      </form>
    </div>
  `;

  document.getElementById("to-login").onclick = () => go("login");
  document.getElementById("signup-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = formPhonePayload(new FormData(form));
    const message = document.getElementById("message");
    const button = form.querySelector(".btn");
    message.textContent = "";
    message.classList.remove("success");
    button.disabled = true;
    try {
      const result = await api("/customer/signup", {
        method: "POST",
        body: JSON.stringify(body),
      });
      localStorage.setItem(PENDING_PHONE_KEY, result.phone);
      message.textContent = result.message;
      message.classList.add("success");
      go("verify");
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

function splitStoredPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  for (const item of COUNTRY_CODES) {
    if (digits.startsWith(item.code)) {
      return { code: item.code, local: digits.slice(item.code.length) };
    }
  }
  return { code: "254", local: digits };
}

function renderVerify() {
  const phone = localStorage.getItem(PENDING_PHONE_KEY) || "";
  const parts = splitStoredPhone(phone);
  app.innerHTML = `
    <div class="auth-shell">
      <form class="card" id="verify-form">
        <div class="brand">Queue<span>less</span></div>
        <h2>Enter OTP</h2>
        <p class="lead">
          Web-only mode: open Admin → Customers to see the OTP for
          <strong>${phone || "your phone"}</strong>, then enter it here.
        </p>
        ${phoneFieldHtml({ selectedCode: parts.code, localValue: parts.local })}
        <div class="field">
          <label for="otp">OTP</label>
          <input id="otp" name="otp" inputmode="numeric" maxlength="4" pattern="\\d{4}" placeholder="4 digits" required />
        </div>
        <button class="btn" type="submit">Verify &amp; sign in</button>
        <button class="btn-link" type="button" id="to-signup">Back to sign up</button>
        <p class="message" id="message" role="status"></p>
      </form>
    </div>
  `;

  document.getElementById("to-signup").onclick = () => go("signup");
  document.getElementById("verify-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = formPhonePayload(new FormData(form));
    const message = document.getElementById("message");
    const button = form.querySelector(".btn");
    message.textContent = "";
    button.disabled = true;
    try {
      const result = await api("/customer/verify-otp", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setToken(result.token);
      localStorage.removeItem(PENDING_PHONE_KEY);
      go("home");
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

function renderLogin() {
  app.innerHTML = `
    <div class="auth-shell">
      <form class="card" id="login-form">
        <div class="brand">Queue<span>less</span></div>
        <h2>Log in</h2>
        <p class="lead">Use your phone number and 4-digit PIN.</p>
        ${phoneFieldHtml()}
        <div class="field">
          <label for="pin">PIN</label>
          <input id="pin" name="pin" type="password" inputmode="numeric" maxlength="4" pattern="\\d{4}" required />
        </div>
        <button class="btn" type="submit">Log in</button>
        <button class="btn-link" type="button" id="to-signup">Create an account</button>
        <p class="message" id="message" role="status"></p>
      </form>
    </div>
  `;

  document.getElementById("to-signup").onclick = () => go("signup");
  document.getElementById("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = formPhonePayload(new FormData(form));
    const message = document.getElementById("message");
    const button = form.querySelector(".btn");
    message.textContent = "";
    button.disabled = true;
    try {
      const result = await api("/customer/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setToken(result.token);
      go("home");
    } catch (error) {
      if (error.payload?.needs_otp) {
        localStorage.setItem(PENDING_PHONE_KEY, error.payload.phone);
        message.textContent = error.message;
        setTimeout(() => go("verify"), 700);
      } else {
        message.textContent = error.message;
      }
    } finally {
      button.disabled = false;
    }
  });
}

function resolveImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http")) return imageUrl;
  return UPLOADS_BASE + imageUrl;
}

function enrichBusiness(business, index) {
  const i = index % DEMO_IMAGES.length;
  const queueSize = business.queue_size ?? DEMO_QUEUE[i];
  const avgWait = business.avg_wait_minutes ?? DEMO_WAIT[i];
  return {
    ...business,
    place: business.location || DEMO_PLACES[i % DEMO_PLACES.length],
    rating: business.rating || DEMO_RATING[i],
    reviews: business.review_count || DEMO_REVIEWS[i],
    queueSize,
    avgWait,
    myEstimate: Math.round((queueSize + 1) * avgWait),
    thumb: resolveImageUrl(business.image_url) || DEMO_IMAGES[i],
  };
}

function renderBusinessCards(list) {
  if (!list.length) {
    return `<p class="empty-state">No businesses in this category yet. Ask admin to add some.</p>`;
  }

  return `
    <div class="biz-list">
      ${list
        .map((business, index) => {
          const item = enrichBusiness(business, index);
          return `
            <article class="biz-card" role="button" tabindex="0" data-biz-id="${item.id}">
              <img class="biz-thumb" src="${escapeHtml(item.thumb)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2270%22 height=%2270%22 fill=%22%23eef0f3%22%3E%3Crect width=%2270%22 height=%2270%22/%3E%3C/svg%3E'" />
              <div class="biz-meta">
                <h3>${escapeHtml(item.name)}</h3>
                <div class="place">${icon("pin")} ${escapeHtml(item.place)}</div>
                <div class="rating">${icon("star")} ${item.rating} <span class="reviews">(${item.reviews})</span></div>
              </div>
              <div class="wait">${item.avgWait} min<small>${item.queueSize} in queue</small></div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function bindBizCards() {
  document.querySelectorAll("[data-biz-id]").forEach((el) => {
    const open = () => go(`business-${el.dataset.bizId}`);
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") open(); });
  });
}

function renderDiscoverFrame() {
  const groups = discoverState.groups.slice(0, 4);
  const categories = [
    ...groups.map((group) => ({
      id: group.id,
      name: group.name,
      key: categoryKey(group.name),
    })),
    { id: "more", name: "More", key: "more" },
  ];

  const filtered = discoverState.businesses.filter((business) => {
    const matchesGroup =
      !discoverState.activeGroupId ||
      business.business_group_id === discoverState.activeGroupId;
    const q = discoverState.search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      business.name.toLowerCase().includes(q) ||
      String(business.business_group_name || "")
        .toLowerCase()
        .includes(q);
    return matchesGroup && matchesSearch;
  });

  app.innerHTML = `
    <div class="home-shell">
      <div class="home-top">
        <div>
          <h1>Discover Services</h1>
          <button class="location" type="button">${icon("pin")} Nairobi, Kenya ${icon("chevron")}</button>
        </div>
        <button class="icon-btn" type="button" aria-label="Notifications">${icon("bell")}<span class="dot"></span></button>
      </div>

      <label class="search">
        ${icon("search")}
        <input id="search-input" type="search" placeholder="Search for a service or business" value="${escapeHtml(discoverState.search)}" />
        <button class="filter" type="button" aria-label="Filters">${icon("filter")}</button>
      </label>

      <div class="categories">
        ${categories
          .map((cat) => {
            const active =
              cat.id === "more"
                ? false
                : discoverState.activeGroupId === cat.id;
            const iconKey = CATEGORY_ICONS[cat.key] || "more";
            return `
              <button class="cat ${active ? "active" : ""}" type="button" data-group="${cat.id}">
                <span class="glyph">${icon(iconKey)}</span>
                <span>${escapeHtml(cat.name)}</span>
              </button>
            `;
          })
          .join("")}
      </div>

      <div class="section-head">
        <h2>Nearby Businesses</h2>
        <button type="button">See all</button>
      </div>
      <div id="biz-list-wrap">${renderBusinessCards(filtered)}</div>
      ${tabbar("home")}
    </div>
  `;

  bindTabs();
  bindBizCards();

  document.getElementById("search-input").addEventListener("input", (event) => {
    discoverState.search = event.target.value;
    document.getElementById("biz-list-wrap").innerHTML = renderBusinessCards(
      discoverState.businesses.filter((business) => {
        const matchesGroup =
          !discoverState.activeGroupId ||
          business.business_group_id === discoverState.activeGroupId;
        const q = discoverState.search.trim().toLowerCase();
        const matchesSearch =
          !q ||
          business.name.toLowerCase().includes(q) ||
          String(business.business_group_name || "")
            .toLowerCase()
            .includes(q);
        return matchesGroup && matchesSearch;
      })
    );
    bindBizCards();
  });

  document.querySelectorAll("[data-group]").forEach((button) => {
    button.addEventListener("click", async () => {
      const value = button.getAttribute("data-group");
      if (value === "more") return;
      const groupId = Number(value);
      discoverState.activeGroupId =
        discoverState.activeGroupId === groupId ? null : groupId;
      renderDiscoverFrame();
    });
  });
}

async function renderHome() {
  app.innerHTML = `
    <div class="home-shell">
      <h1>Discover Services</h1>
      <p class="empty-state">Loading nearby businesses…</p>
      ${tabbar("home")}
    </div>
  `;
  bindTabs();

  try {
    const [me, groups, businesses] = await Promise.all([
      api("/customer/me"),
      api("/customer/business-groups"),
      api("/customer/businesses"),
    ]);
    discoverState.me = me;
    discoverState.groups = groups;
    discoverState.businesses = businesses;
    if (!discoverState.activeGroupId && groups.length) {
      const barber = groups.find((group) =>
        /barber/i.test(group.name)
      );
      discoverState.activeGroupId = (barber || groups[0]).id;
    }
    renderDiscoverFrame();
  } catch (error) {
    clearToken();
    app.innerHTML = `
      <div class="auth-shell">
        <div class="card">
          <div class="brand">Queue<span>less</span></div>
          <h2>Session expired</h2>
          <p class="lead">${escapeHtml(error.message)}</p>
          <button class="btn" type="button" id="to-login">Log in again</button>
        </div>
      </div>
    `;
    document.getElementById("to-login").onclick = () => go("login");
  }
}

function renderPlaceholder(title, copy, tab) {
  app.innerHTML = `
    <div class="placeholder-page">
      <h1>${title}</h1>
      <p>${copy}</p>
      ${tabbar(tab)}
    </div>
  `;
  bindTabs();
}

async function renderProfile() {
  app.innerHTML = `
    <div class="placeholder-page">
      <h1>Profile</h1>
      <p class="empty-state">Loading…</p>
      ${tabbar("profile")}
    </div>
  `;
  bindTabs();

  try {
    const me = await api("/customer/me");
    app.innerHTML = `
      <div class="placeholder-page">
        <h1>Profile</h1>
        <p><strong>${escapeHtml(me.first_name)}</strong></p>
        <p style="margin-top:.35rem;color:var(--text-dim)">+${escapeHtml(me.phone)}</p>
        <button class="btn" style="margin-top:1.5rem;max-width:12rem" type="button" id="logout">Sign out</button>
        ${tabbar("profile")}
      </div>
    `;
    bindTabs();
    document.getElementById("logout").onclick = () => {
      clearToken();
      go("login");
    };
  } catch (error) {
    clearToken();
    go("login");
  }
}

async function renderBusinessDetail(id) {
  app.innerHTML = `
    <div class="detail-shell">
      <div class="detail-hero skeleton"></div>
      <div class="detail-body">
        <p class="empty-state">Loading…</p>
      </div>
      ${tabbar("home")}
    </div>
  `;
  bindTabs();

  let biz;
  try {
    // Try to find in cached state first for instant render, then fetch for freshness
    const cached = discoverState.businesses.find((b) => b.id === id);
    biz = cached || await api(`/customer/businesses/${id}`);
  } catch {
    app.innerHTML = `
      <div class="detail-shell">
        <button class="detail-back" type="button" id="back-btn">← Back</button>
        <p class="empty-state" style="padding:2rem">Business not found.</p>
        ${tabbar("home")}
      </div>
    `;
    bindTabs();
    document.getElementById("back-btn").onclick = () => go("home");
    return;
  }

  // Find the index in the businesses list for enrichment
  const index = discoverState.businesses.findIndex((b) => b.id === id);
  const item = enrichBusiness(biz, index >= 0 ? index : 0);

  const queueBadgeColor = item.queueSize <= 3 ? "var(--emerald)" : item.queueSize <= 8 ? "var(--lime-deep)" : "var(--danger)";
  const queueLabel = item.queueSize === 0 ? "No queue" : item.queueSize === 1 ? "1 person" : `${item.queueSize} people`;

  app.innerHTML = `
    <div class="detail-shell">
      <div class="detail-hero" style="background-image:url('${escapeHtml(item.thumb)}')">
        <button class="detail-back" type="button" id="back-btn" aria-label="Back">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div class="detail-category-pill">${escapeHtml(item.business_group_name || "")}</div>
      </div>

      <div class="detail-body">
        <h1 class="detail-name">${escapeHtml(item.name)}</h1>
        ${item.place ? `
          <div class="detail-row">
            ${icon("pin")}
            <span>${escapeHtml(item.place)}</span>
          </div>` : ""}
        ${item.phone ? `
          <div class="detail-row">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6.5 4h3l1.5 4-2 1.2A11 11 0 0 0 12.8 13l1.2-2 4 1.5v3c0 1-.9 1.7-1.9 1.5A17 17 0 0 1 4.9 5.4C4.7 4.4 5.4 4 6.5 4Z"/></svg>
            <span>${escapeHtml(item.phone)}</span>
          </div>` : ""}
        ${item.description ? `<p class="detail-desc">${escapeHtml(item.description)}</p>` : ""}

        <div class="queue-stats">
          <div class="queue-stat">
            <div class="queue-stat-value" style="color:${queueBadgeColor}">${queueLabel}</div>
            <div class="queue-stat-label">in queue now</div>
          </div>
          <div class="queue-divider"></div>
          <div class="queue-stat">
            <div class="queue-stat-value">${item.avgWait} min</div>
            <div class="queue-stat-label">avg. per person</div>
          </div>
          <div class="queue-divider"></div>
          <div class="queue-stat">
            <div class="queue-stat-value" style="color:var(--ocean-teal)">${item.myEstimate} min</div>
            <div class="queue-stat-label">your est. wait</div>
          </div>
        </div>

        <div class="detail-rating">
          ${icon("star")} <strong>${item.rating}</strong> <span class="reviews">(${item.reviews} reviews)</span>
        </div>

        <button class="btn detail-join-btn" type="button">Join Queue</button>
      </div>
      ${tabbar("home")}
    </div>
  `;

  bindTabs();
  document.getElementById("back-btn").onclick = () => history.back() || go("home");
  document.querySelector(".detail-join-btn").onclick = () => {
    // Placeholder — queue joining will be implemented later
    const btn = document.querySelector(".detail-join-btn");
    btn.textContent = "You're in queue! 🎉";
    btn.disabled = true;
  };
}

async function render() {
  if (!getToken()) {
    const view = viewFromHash();
    if (view === "login") return renderLogin();
    if (view === "verify") return renderVerify();
    return renderSignup();
  }

  const view = viewFromHash();
  if (view.startsWith("business-")) {
    const id = Number(view.replace("business-", ""));
    if (id) return renderBusinessDetail(id);
  }
  if (view === "bookings") {
    return renderPlaceholder("Bookings", "Your bookings will appear here.", "bookings");
  }
  if (view === "queue") {
    return renderPlaceholder("Queue", "Live queue status will appear here.", "queue");
  }
  if (view === "profile") return renderProfile();
  if (view === "login" || view === "signup" || view === "verify") {
    return renderHome();
  }
  return renderHome();
}

window.addEventListener("hashchange", render);
render();
