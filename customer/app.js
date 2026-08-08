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
  myQueue: [],
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

const PIN_LENGTH = 4;

/*
 * One box per digit. The boxes carry no name, so the form reads the PIN from
 * the hidden input they keep in sync — call sites and the API are unchanged.
 */
function pinFieldHtml({ id, label }) {
  const boxes = Array.from({ length: PIN_LENGTH }, (_, index) => `
    <input
      class="pin-box"
      id="${id}-${index}"
      data-pin-box="${index}"
      type="password"
      inputmode="numeric"
      autocomplete="off"
      maxlength="1"
      size="1"
      pattern="[0-9]"
      placeholder=" "
      aria-label="${label}, digit ${index + 1} of ${PIN_LENGTH}"
      required
    />
  `).join("");

  return `
    <div class="field pin-field" data-pin-field="${id}">
      <div class="pin-label-row">
        <label for="${id}-0">${label}</label>
        <button class="pin-toggle" type="button" data-pin-toggle aria-label="Show PIN" aria-pressed="false">
          ${icon("eye")}
        </button>
      </div>
      <div class="pin-boxes">${boxes}</div>
      <input type="hidden" id="${id}" name="${id}" />
    </div>
  `;
}

// Wires digit entry and the reveal control. Call after rendering a pinFieldHtml.
function bindPinFields() {
  document.querySelectorAll("[data-pin-field]").forEach((field) => {
    const boxes = [...field.querySelectorAll(".pin-box")];
    const hidden = field.querySelector('input[type="hidden"]');
    const toggle = field.querySelector("[data-pin-toggle]");
    const sync = () => {
      hidden.value = boxes.map((box) => box.value).join("");
    };

    boxes.forEach((box, index) => {
      box.addEventListener("focus", () => box.select());

      box.addEventListener("input", () => {
        box.value = box.value.replace(/\D/g, "").slice(0, 1);
        sync();
        if (box.value && index < boxes.length - 1) boxes[index + 1].focus();
      });

      box.addEventListener("keydown", (event) => {
        if (event.key === "Backspace" && !box.value && index > 0) {
          // Step back and clear, so holding backspace walks the whole PIN out.
          event.preventDefault();
          boxes[index - 1].value = "";
          boxes[index - 1].focus();
          sync();
        } else if (event.key === "ArrowLeft" && index > 0) {
          event.preventDefault();
          boxes[index - 1].focus();
        } else if (event.key === "ArrowRight" && index < boxes.length - 1) {
          event.preventDefault();
          boxes[index + 1].focus();
        }
      });

      box.addEventListener("paste", (event) => {
        event.preventDefault();
        const digits = (event.clipboardData?.getData("text") || "")
          .replace(/\D/g, "")
          .slice(0, boxes.length - index);
        [...digits].forEach((digit, offset) => {
          boxes[index + offset].value = digit;
        });
        sync();
        boxes[Math.min(index + digits.length, boxes.length - 1)].focus();
      });
    });

    toggle?.addEventListener("click", () => {
      const showing = boxes[0].type === "text";
      boxes.forEach((box) => {
        box.type = showing ? "password" : "text";
      });
      toggle.innerHTML = showing ? icon("eye") : icon("eyeOff");
      toggle.setAttribute("aria-label", showing ? "Show PIN" : "Hide PIN");
      toggle.setAttribute("aria-pressed", String(!showing));
      (boxes.find((box) => !box.value) || boxes[boxes.length - 1]).focus();
    });
  });
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
  return (location.hash || "#login").replace("#", "") || "login";
}

function go(view) {
  location.hash = view;
  render();
}

// Set when arriving at the queue screen from a specific business, so the list
// can scroll straight to that card instead of making the customer hunt for it.
let queueFocusBusinessId = null;

// Handed from the login screen to the signup screen when the number typed at
// login has no account behind it.
let signupPrefillPhone = null;

function goToQueue(businessId = null) {
  queueFocusBusinessId = businessId;
  go("queue");
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
    pharmacy: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg>`,
    government: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3.5 19 6v5.5c0 4-2.9 7.3-7 8.9-4.1-1.6-7-4.9-7-8.9V6l7-2.5Z"/></svg>`,
    restaurant: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3v6a2 2 0 0 0 4 0V3M8 11v10M17 3c-1.2 1.6-2 3.4-2 5.2 0 1.6.8 2.6 2 2.8v10"/></svg>`,
    shop: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>`,
    car: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 15v-2.5L6 8h12l2 4.5V15H4Z"/><circle cx="7.5" cy="15.5" r="1.5"/><circle cx="16.5" cy="15.5" r="1.5"/></svg>`,
    education: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 5 9 4-9 4-9-4 9-4Z"/><path d="M7 11v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4"/></svg>`,
    fitness: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>`,
    phone: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/></svg>`,
    more: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="6" cy="6" r="1.5"/><circle cx="12" cy="6" r="1.5"/><circle cx="18" cy="6" r="1.5"/><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/><circle cx="6" cy="18" r="1.5"/><circle cx="12" cy="18" r="1.5"/><circle cx="18" cy="18" r="1.5"/></svg>`,
    search: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>`,
    filter: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M7 12h10M10 18h4"/></svg>`,
    pin: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"/><circle cx="12" cy="11" r="2.2"/></svg>`,
    chevron: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m7 10 5 5 5-5"/></svg>`,
    eye: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>`,
    eyeOff: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c6 0 9.5 6.2 9.5 6.2a17 17 0 0 1-3.3 3.9M6.4 7.3A16.7 16.7 0 0 0 2.5 11.2S6 17.4 12 17.4a9.5 9.5 0 0 0 3.7-.73"/><path d="M9.9 9.3a3 3 0 0 0 4.2 4.2"/><path d="m4 3.6 16.4 16.4"/></svg>`,
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
  // Carried over when login found no account for the number just typed.
  const carried = signupPrefillPhone;
  signupPrefillPhone = null;
  const parts = splitStoredPhone(carried || "");

  app.innerHTML = `
    <div class="auth-shell">
      <form class="card" id="signup-form">
        <div class="brand">Queue<span>less</span></div>
        <h2>Create account</h2>
        <p class="lead">
          ${carried
            ? "That number isn't registered yet. Add your name and a PIN to finish signing up."
            : "Sign up with your phone number and a 4-digit PIN."}
        </p>
        <div class="field">
          <label for="first_name">First name</label>
          <input id="first_name" name="first_name" autocomplete="given-name" required />
        </div>
        ${phoneFieldHtml({ selectedCode: parts.code, localValue: parts.local })}
        ${pinFieldHtml({ id: "pin", label: "Create PIN" })}
        ${pinFieldHtml({ id: "confirm_pin", label: "Confirm PIN" })}
        <button class="btn" type="submit">Continue</button>
        <button class="btn-link" type="button" id="to-login">Already have an account? Log in</button>
        <p class="message" id="message" role="status"></p>
      </form>
    </div>
  `;

  bindPinFields();
  document.getElementById("to-login").onclick = () => go("login");
  // The phone is already filled in, so start where the customer still has work.
  if (carried) document.getElementById("first_name").focus();

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
        <div class="resend-row">
          <button class="btn-link" type="button" id="resend-btn" hidden></button>
        </div>
        <button class="btn-link" type="button" id="to-signup">Back to sign up</button>
        <p class="message" id="message" role="status"></p>
      </form>
    </div>
  `;

  const resendBtn = document.getElementById("resend-btn");
  const statusMessage = document.getElementById("message");
  let countdown = null;

  const stopCountdown = () => {
    if (countdown) clearInterval(countdown);
    countdown = null;
  };

  /*
   * Reflects the server's throttle: a live countdown while cooling down, an
   * enabled button once it lapses, and the support number once the customer
   * has used all their attempts.
   */
  function applyResendState(state) {
    stopCountdown();
    if (!state || state.verified) {
      resendBtn.hidden = true;
      return;
    }

    resendBtn.hidden = false;

    if (state.exhausted) {
      resendBtn.disabled = true;
      resendBtn.textContent = `Contact support on ${state.support_phone}`;
      return;
    }

    let seconds = state.cooldown_seconds || 0;
    const label = () =>
      seconds > 0
        ? `Resend code in ${seconds}s`
        : `Resend code (${state.resends_left} left)`;

    resendBtn.disabled = seconds > 0;
    resendBtn.textContent = label();

    if (seconds > 0) {
      countdown = setInterval(() => {
        seconds -= 1;
        if (seconds <= 0) {
          stopCountdown();
          resendBtn.disabled = false;
        }
        resendBtn.textContent = label();
      }, 1000);
    }
  }

  async function refreshResendState() {
    if (!phone) return;
    try {
      applyResendState(await api("/customer/otp-status", {
        method: "POST",
        body: JSON.stringify({ phone }),
      }));
    } catch {
      // No account yet, or the check failed — leave the button hidden.
    }
  }

  resendBtn.addEventListener("click", async () => {
    resendBtn.disabled = true;
    statusMessage.textContent = "";
    statusMessage.classList.remove("success");
    try {
      const result = await api("/customer/resend-otp", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      statusMessage.textContent = result.message;
      statusMessage.classList.add("success");
      applyResendState(result);
    } catch (error) {
      statusMessage.textContent = error.message;
      // The 429 bodies carry the current throttle, so the button stays honest.
      applyResendState(error.payload?.support_phone ? error.payload : null);
      if (!error.payload?.support_phone) refreshResendState();
    }
  });

  refreshResendState();

  document.getElementById("to-signup").onclick = () => {
    stopCountdown();
    go("signup");
  };
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
      stopCountdown();
      setToken(result.token);
      localStorage.removeItem(PENDING_PHONE_KEY);
      go("home");
    } catch (error) {
      message.textContent = error.message;
      // An expired code comes back with the throttle attached, so the resend
      // button can offer the way out straight away.
      if (error.payload?.expired) applyResendState(error.payload);
    } finally {
      button.disabled = false;
    }
  });
}

/*
 * Two steps: confirm the number has an account, then ask for the PIN. An
 * unknown number never sees a PIN prompt it could not satisfy — it goes to
 * signup instead.
 */
function renderLogin() {
  let stage = "phone";
  let knownPhone = null;
  let greeting = "";
  let phoneParts = { code: "254", local: "" };

  function paint() {
    const onPin = stage === "pin";
    app.innerHTML = `
      <div class="auth-shell">
        <form class="card" id="login-form">
          <div class="brand">Queue<span>less</span></div>
          <h2>${onPin ? `Welcome back${greeting ? `, ${escapeHtml(greeting)}` : ""}` : "Log in"}</h2>
          <p class="lead">
            ${onPin
              ? `Enter the 4-digit PIN for <strong>+${escapeHtml(knownPhone)}</strong>.`
              : "Enter your phone number to continue."}
          </p>
          ${onPin
            ? pinFieldHtml({ id: "pin", label: "PIN" })
            : phoneFieldHtml({ selectedCode: phoneParts.code, localValue: phoneParts.local })}
          <button class="btn" type="submit">${onPin ? "Log in" : "Continue"}</button>
          <button class="btn-link" type="button" id="secondary-action">
            ${onPin ? "Use a different number" : "Create an account"}
          </button>
          <p class="message" id="message" role="status"></p>
        </form>
      </div>
    `;

    if (onPin) {
      bindPinFields();
      document.getElementById("pin-0")?.focus();
      document.getElementById("secondary-action").onclick = () => {
        stage = "phone";
        paint();
      };
    } else {
      document.getElementById("secondary-action").onclick = () => go("signup");
    }

    document.getElementById("login-form").addEventListener("submit", onSubmit);
  }

  // Re-queried because paint() may have replaced the button mid-flight.
  const enableButton = () => {
    const button = document.querySelector("#login-form .btn");
    if (button) button.disabled = false;
  };

  async function onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.getElementById("message");
    const button = form.querySelector(".btn");
    message.textContent = "";
    message.classList.remove("success");
    button.disabled = true;

    try {
      if (stage === "phone") {
        const payload = formPhonePayload(new FormData(form));
        phoneParts = splitStoredPhone(payload.phone);

        const status = await api("/customer/phone-status", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (!status.registered) {
          signupPrefillPhone = status.phone;
          message.textContent = "That number isn't registered yet. Taking you to sign up…";
          setTimeout(() => go("signup"), 700);
          return;
        }
        if (status.needs_otp) {
          localStorage.setItem(PENDING_PHONE_KEY, status.phone);
          message.textContent = "Finish verifying this number first.";
          setTimeout(() => go("verify"), 700);
          return;
        }

        knownPhone = status.phone;
        greeting = status.first_name || "";
        stage = "pin";
        paint();
        return;
      }

      const result = await api("/customer/login", {
        method: "POST",
        body: JSON.stringify({ phone: knownPhone, pin: new FormData(form).get("pin") }),
      });
      setToken(result.token);
      go("home");
    } catch (error) {
      if (error.payload?.needs_otp) {
        localStorage.setItem(PENDING_PHONE_KEY, error.payload.phone);
        message.textContent = error.message;
        setTimeout(() => go("verify"), 700);
      } else if (error.payload?.not_registered) {
        signupPrefillPhone = error.payload.phone;
        message.textContent = `${error.message} Taking you to sign up…`;
        setTimeout(() => go("signup"), 700);
      } else {
        message.textContent = error.message;
      }
    } finally {
      enableButton();
    }
  }

  paint();
}

function resolveImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http")) return imageUrl;
  return UPLOADS_BASE + imageUrl;
}

function formatWaitMinutes(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}min`;
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

function matchesHomeFilters(business, { ignoreGroup = false } = {}) {
  const matchesGroup =
    ignoreGroup ||
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
}

// Joined businesses float to the top, shortest estimated wait first.
// Estimated wait = people ahead × average service time (from the queue API).
function orderedHomeBusinesses() {
  const businessById = new Map(
    discoverState.businesses.map((business) => [Number(business.id), business])
  );

  const joined = discoverState.myQueue
    .slice()
    .sort((a, b) => {
      const waitDiff =
        (a.estimated_wait_minutes ?? Number.POSITIVE_INFINITY) -
        (b.estimated_wait_minutes ?? Number.POSITIVE_INFINITY);
      if (waitDiff !== 0) return waitDiff;
      return (a.position ?? 0) - (b.position ?? 0);
    })
    .map((entry) => {
      const business = businessById.get(Number(entry.business_id));
      if (!business) return null;
      if (!matchesHomeFilters(business, { ignoreGroup: true })) return null;
      return { ...business, myQueueEntry: entry };
    })
    .filter(Boolean);

  const joinedIds = new Set(joined.map((business) => Number(business.id)));
  const others = discoverState.businesses
    .filter((business) => !joinedIds.has(Number(business.id)))
    .filter((business) => matchesHomeFilters(business))
    .map((business) => ({ ...business, myQueueEntry: null }));

  return [...joined, ...others];
}

function positionBadge(entry, fallbackItem) {
  if (!entry) {
    return `<div class="wait">${fallbackItem.avgWait} min<small>${fallbackItem.queueSize} in queue</small></div>`;
  }

  const wait = entry.estimated_wait_minutes ?? 0;
  const waitLabel = wait <= 0 ? "You're next" : formatWaitMinutes(wait);
  return `
    <div class="wait wait-joined">
      #${entry.position}
      <small>${escapeHtml(waitLabel)}</small>
    </div>
  `;
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
          const entry = business.myQueueEntry || null;
          return `
            <article class="biz-card ${entry ? "biz-card-joined" : ""}" role="button" tabindex="0" data-biz-id="${item.id}">
              <img class="biz-thumb" src="${escapeHtml(item.thumb)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2270%22 height=%2270%22 fill=%22%23eef0f3%22%3E%3Crect width=%2270%22 height=%2270%22/%3E%3C/svg%3E'" />
              <div class="biz-meta">
                <h3>${escapeHtml(item.name)}</h3>
                <div class="place">${icon("pin")} ${escapeHtml(item.place)}</div>
                ${
                  entry
                    ? `<div class="queue-position-line">Your position · ${entry.people_ahead} ahead</div>`
                    : `<div class="rating">${icon("star")} ${item.rating} <span class="reviews">(${item.reviews})</span></div>`
                }
              </div>
              ${positionBadge(entry, item)}
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
      // Admins pick the icon; fall back to guessing from the name for groups
      // created before icons existed.
      iconKey: group.icon || CATEGORY_ICONS[categoryKey(group.name)] || "more",
    })),
    { id: "more", name: "More", iconKey: "more" },
  ];

  const ordered = orderedHomeBusinesses();
  const joinedCount = ordered.filter((business) => business.myQueueEntry).length;
  const sectionTitle = joinedCount
    ? joinedCount === 1
      ? "Your queue · Nearby"
      : "Your queues · Nearby"
    : "Nearby Businesses";

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
            return `
              <button class="cat ${active ? "active" : ""}" type="button" data-group="${cat.id}">
                <span class="glyph">${icon(cat.iconKey)}</span>
                <span>${escapeHtml(cat.name)}</span>
              </button>
            `;
          })
          .join("")}
      </div>

      <div class="section-head">
        <h2>${sectionTitle}</h2>
        <button type="button">See all</button>
      </div>
      <div id="biz-list-wrap">${renderBusinessCards(ordered)}</div>
      ${tabbar("home")}
    </div>
  `;

  bindTabs();
  bindBizCards();

  document.getElementById("search-input").addEventListener("input", (event) => {
    discoverState.search = event.target.value;
    document.getElementById("biz-list-wrap").innerHTML = renderBusinessCards(
      orderedHomeBusinesses()
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
    const [me, groups, businesses, myQueue] = await Promise.all([
      api("/customer/me"),
      api("/customer/business-groups"),
      api("/customer/businesses"),
      api("/customer/queue"),
    ]);
    discoverState.me = me;
    discoverState.groups = groups;
    discoverState.businesses = businesses;
    discoverState.myQueue = Array.isArray(myQueue) ? myQueue : [];
    if (!discoverState.activeGroupId && groups.length) {
      const barber = groups.find((group) =>
        /barber/i.test(group.name)
      );
      discoverState.activeGroupId = (barber || groups[0]).id;
    }
    renderDiscoverFrame();
  } catch (error) {
    const authFailed = error.status === 401 || error.status === 403;
    if (authFailed) clearToken();
    app.innerHTML = `
      <div class="auth-shell">
        <div class="card">
          <div class="brand">Queue<span>less</span></div>
          <h2>${authFailed ? "Session expired" : "Something went wrong"}</h2>
          <p class="lead">${escapeHtml(error.message)}</p>
          <button class="btn" type="button" id="home-error-action">
            ${authFailed ? "Log in again" : "Try again"}
          </button>
        </div>
      </div>
    `;
    document.getElementById("home-error-action").onclick = () =>
      authFailed ? go("login") : renderHome();
  }
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

  let myEntry = null;
  try {
    const myQueue = await api("/customer/queue");
    myEntry = myQueue.find((entry) => Number(entry.business_id) === Number(item.id)) || null;
  } catch {
    // If the check fails, leave the button enabled and let join handle conflicts.
  }
  const alreadyInQueue = Boolean(myEntry);

  const queueBadgeColor = item.queueSize <= 3 ? "var(--emerald)" : item.queueSize <= 8 ? "var(--lime-deep)" : "var(--danger)";
  const queueLabel = item.queueSize === 0 ? "No queue" : item.queueSize === 1 ? "1 person" : `${item.queueSize} people`;
  const joinLabel = alreadyInQueue ? `View my place · #${myEntry.position}` : "Join Queue";

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
            <div class="queue-stat-value" style="color:var(--ocean-teal)">${escapeHtml(formatWaitMinutes(item.myEstimate))}</div>
            <div class="queue-stat-label">your est. wait</div>
          </div>
        </div>

        <div class="detail-rating">
          ${icon("star")} <strong>${item.rating}</strong> <span class="reviews">(${item.reviews} reviews)</span>
        </div>

        <div class="detail-actions">
          <button
            class="btn detail-join-btn${alreadyInQueue ? " in-queue" : ""}"
            type="button"
          >${alreadyInQueue ? `${joinLabel} ${icon("chevron")}` : joinLabel}</button>
          <button class="btn btn-ghost detail-book-btn" type="button">Book for later</button>
        </div>
        <p class="message" id="detail-message" role="status"></p>
      </div>
      ${bookingSheetHtml(item)}
      ${tabbar("home")}
    </div>
  `;

  bindTabs();
  document.getElementById("back-btn").onclick = () => history.back() || go("home");

  const message = document.getElementById("detail-message");
  const joinBtn = document.querySelector(".detail-join-btn");

  if (!alreadyInQueue) {
    joinBtn.onclick = async (event) => {
      const btn = event.currentTarget;
      btn.disabled = true;
      message.textContent = "";
      message.classList.remove("success");
      try {
        await api(`/customer/businesses/${item.id}/queue`, { method: "POST" });
        goToQueue(item.id);
      } catch (error) {
        if (error.status === 409) {
          goToQueue(item.id);
          return;
        }
        message.textContent = error.message;
        btn.disabled = false;
      }
    };
  } else {
    joinBtn.onclick = () => goToQueue(item.id);
    message.textContent = `You're #${myEntry.position} in this queue · about ${formatWaitMinutes(
      myEntry.estimated_wait_minutes
    )} to go.`;
    message.classList.add("success");
  }

  bindBookingSheet(item, message);
}

/* ---------------------------------------------------------------- bookings */

// Bookings are limited to the next 24 hours, so the picker never offers a
// time the API would reject.
const BOOKING_WINDOW_HOURS = 24;

function bookingSlots(now = new Date()) {
  const slots = [];
  const start = new Date(now.getTime() + 15 * 60 * 1000);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
  const limit = now.getTime() + BOOKING_WINDOW_HOURS * 60 * 60 * 1000;

  for (let t = start.getTime(); t <= limit; t += 15 * 60 * 1000) {
    slots.push(new Date(t));
  }
  return slots;
}

function slotLabel(date) {
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `Today ${time}` : `Tomorrow ${time}`;
}

function bookingSheetHtml(item) {
  const slots = bookingSlots();
  return `
    <div class="sheet-overlay hidden" id="booking-sheet">
      <div class="sheet">
        <div class="sheet-handle"></div>
        <h3>Book a slot</h3>
        <p class="sheet-lead">
          Reserve your place at ${escapeHtml(item.name)}. You can book up to
          ${BOOKING_WINDOW_HOURS} hours ahead.
        </p>
        <div class="field">
          <label for="booking-slot">Arrival time</label>
          <select id="booking-slot">
            ${slots
              .map((slot) => `<option value="${slot.toISOString()}">${escapeHtml(slotLabel(slot))}</option>`)
              .join("")}
          </select>
        </div>
        <button class="btn" type="button" id="booking-confirm">Confirm booking</button>
        <button class="btn-link" type="button" id="booking-cancel">Not now</button>
        <p class="message" id="booking-message" role="status"></p>
      </div>
    </div>
  `;
}

function bindBookingSheet(item, detailMessage) {
  const sheet = document.getElementById("booking-sheet");
  const sheetMessage = document.getElementById("booking-message");
  const close = () => sheet.classList.add("hidden");

  document.querySelector(".detail-book-btn").onclick = () => {
    sheetMessage.textContent = "";
    sheet.classList.remove("hidden");
  };
  document.getElementById("booking-cancel").onclick = close;
  sheet.addEventListener("click", (event) => {
    if (event.target === sheet) close();
  });

  document.getElementById("booking-confirm").onclick = async (event) => {
    const btn = event.currentTarget;
    const scheduledFor = document.getElementById("booking-slot").value;
    btn.disabled = true;
    sheetMessage.textContent = "";
    try {
      await api(`/customer/businesses/${item.id}/bookings`, {
        method: "POST",
        body: JSON.stringify({ scheduled_for: scheduledFor }),
      });
      close();
      go("bookings");
    } catch (error) {
      sheetMessage.textContent = error.message;
      if (detailMessage) detailMessage.textContent = "";
    } finally {
      btn.disabled = false;
    }
  };
}

async function renderBookings() {
  app.innerHTML = `
    <div class="placeholder-page">
      <h1>Bookings</h1>
      <p class="empty-state">Loading…</p>
      ${tabbar("bookings")}
    </div>
  `;
  bindTabs();

  let bookings = [];
  try {
    bookings = await api("/customer/bookings");
  } catch (error) {
    app.innerHTML = `
      <div class="placeholder-page">
        <h1>Bookings</h1>
        <p class="empty-state">${escapeHtml(error.message)}</p>
        ${tabbar("bookings")}
      </div>
    `;
    bindTabs();
    return;
  }

  const list = bookings.length
    ? bookings
        .map((booking) => {
          const when = new Date(booking.scheduled_for);
          const minutesAway = Math.round((when.getTime() - Date.now()) / 60000);
          const countdown =
            minutesAway <= 0
              ? "Now"
              : minutesAway < 60
                ? `in ${minutesAway} min`
                : `in ${Math.floor(minutesAway / 60)}h ${minutesAway % 60}m`;
          return `
            <article class="booking-card">
              <div class="booking-when">
                <span class="booking-time">${escapeHtml(
                  when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                )}</span>
                <span class="booking-day">${escapeHtml(slotLabel(when).split(" ")[0])}</span>
              </div>
              <div class="booking-meta">
                <h3>${escapeHtml(booking.business_name)}</h3>
                <div class="place">${icon("pin")} ${escapeHtml(booking.location || "—")}</div>
                <div class="booking-countdown">${escapeHtml(countdown)}</div>
              </div>
              <div class="booking-actions">
                <button class="chip chip-primary" data-join="${booking.business_id}" data-booking="${booking.id}">Check in</button>
                <button class="chip" data-cancel="${booking.id}">Cancel</button>
              </div>
            </article>
          `;
        })
        .join("")
    : `<p class="empty-state">No bookings yet. Open a business and tap “Book for later”.</p>`;

  app.innerHTML = `
    <div class="placeholder-page">
      <h1>Bookings</h1>
      <p class="page-lead">Reserved slots for the next ${BOOKING_WINDOW_HOURS} hours.</p>
      <div class="booking-list">${list}</div>
      <p class="message" id="bookings-message" role="status"></p>
      ${tabbar("bookings")}
    </div>
  `;
  bindTabs();

  const message = document.getElementById("bookings-message");

  document.querySelectorAll("[data-cancel]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await api(`/customer/bookings/${btn.dataset.cancel}/cancel`, { method: "POST" });
        await renderBookings();
      } catch (error) {
        message.textContent = error.message;
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-join]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await api(`/customer/businesses/${btn.dataset.join}/queue`, {
          method: "POST",
          body: JSON.stringify({ booking_id: Number(btn.dataset.booking) }),
        });
        go("queue");
      } catch (error) {
        if (error.status === 409) return go("queue");
        message.textContent = error.message;
        btn.disabled = false;
      }
    });
  });
}

/* ------------------------------------------------------------- live queue */

let queueTimer = null;
let queueVisibilityHandler = null;

function stopQueuePolling() {
  if (queueTimer) {
    clearTimeout(queueTimer);
    queueTimer = null;
  }
  if (queueVisibilityHandler) {
    document.removeEventListener("visibilitychange", queueVisibilityHandler);
    queueVisibilityHandler = null;
  }
}

/*
 * Refresh often when the customer is about to be served and rarely when they
 * are far back, so a long wait costs a handful of requests instead of one
 * every ten seconds.
 */
function queuePollDelay(entries) {
  if (!entries.length) return 30000;
  const soonest = Math.min(...entries.map((entry) => entry.position ?? Infinity));
  if (soonest <= 3) return 10000;
  if (soonest <= 8) return 20000;
  return 45000;
}

function queueMilestone(position) {
  if (position <= 1) return { emoji: "🎉", text: "You're up next!", tone: "now" };
  if (position === 2) return { emoji: "🔥", text: "Almost there — one to go", tone: "close" };
  if (position <= 4) return { emoji: "⚡️", text: "Getting close, stay nearby", tone: "close" };
  return { emoji: "⏳", text: "Hang tight, we'll keep you posted", tone: "waiting" };
}

function queueCardHtml(entry) {
  const { position, people_ahead: ahead, queue_length: total } = entry;
  const milestone = queueMilestone(position);
  // Progress reflects how much of the original line has cleared.
  const served = Math.max(total - ahead, 0);
  const progress = total > 0 ? Math.round((served / total) * 100) : 100;
  const wait = entry.estimated_wait_minutes;
  const waitLabel = wait <= 0 ? "Any moment" : formatWaitMinutes(wait);

  return `
    <article class="queue-card ${milestone.tone}" data-entry="${entry.id}">
      <div class="queue-card-main">
        <div class="position-ring" style="--progress:${progress}">
          <div class="position-inner">
            <span class="position-number">${position}</span>
            <span class="position-of">of ${total || position}</span>
          </div>
        </div>

        <div class="queue-card-info">
          <div class="queue-card-head">
            <h2>${escapeHtml(entry.business_name)}</h2>
            <span class="queue-chip">${escapeHtml(entry.business_group_name || "")}</span>
          </div>
          <div class="place">${icon("pin")} ${escapeHtml(entry.location || "—")}</div>
          <p class="queue-milestone">
            <span class="milestone-emoji">${milestone.emoji}</span>
            ${escapeHtml(milestone.text)}
          </p>
          <div class="queue-facts">
            <span><strong>${ahead}</strong> ahead</span>
            <span><strong>${escapeHtml(waitLabel)}</strong> est. wait</span>
          </div>
        </div>
      </div>

      <div class="queue-card-foot">
        <div class="queue-progress" title="${served} of ${total || position} served">
          <div class="queue-progress-bar" style="width:${progress}%"></div>
        </div>
        <button class="queue-leave" data-leave="${entry.id}" type="button">Leave</button>
      </div>
    </article>
  `;
}

function queueNavHtml(entries) {
  // Only worth showing once there is more than one queue to move between.
  if (entries.length < 2) return "";
  return `
    <nav class="queue-nav" aria-label="Your queues">
      ${entries
        .map(
          (entry) => `
            <button class="queue-nav-chip" type="button" data-nav="${entry.id}">
              <span class="queue-nav-pos">#${entry.position}</span>
              ${escapeHtml(entry.business_name)}
            </button>
          `
        )
        .join("")}
    </nav>
  `;
}

// Highlights the chip whose card is currently nearest the top of the viewport.
function highlightQueueCard(entryId) {
  const card = document.querySelector(`[data-entry="${entryId}"]`);
  if (!card) return false;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.add("flash");
  setTimeout(() => card.classList.remove("flash"), 900);
  return true;
}

function bindQueueNav(focusEntryId = null) {
  const nav = document.querySelector(".queue-nav");
  if (!nav) return null;

  const chips = new Map(
    [...nav.querySelectorAll("[data-nav]")].map((chip) => [chip.dataset.nav, chip])
  );

  const setActive = (id) => {
    for (const [chipId, chip] of chips) {
      chip.classList.toggle("active", chipId === String(id));
    }
  };

  nav.querySelectorAll("[data-nav]").forEach((chip) => {
    chip.addEventListener("click", () => {
      if (highlightQueueCard(chip.dataset.nav)) setActive(chip.dataset.nav);
    });
  });

  const observer = new IntersectionObserver(
    (records) => {
      const visible = records
        .filter((record) => record.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActive(visible.target.dataset.entry);
    },
    { rootMargin: "-45% 0px -45% 0px" }
  );

  document.querySelectorAll("[data-entry]").forEach((card) => observer.observe(card));

  if (focusEntryId && chips.has(String(focusEntryId))) {
    setActive(focusEntryId);
  } else {
    const firstChip = nav.querySelector("[data-nav]");
    if (firstChip) setActive(firstChip.dataset.nav);
  }

  return observer;
}

async function renderQueue() {
  stopQueuePolling();

  let navObserver = null;

  const paint = (inner, nav = "") => {
    app.innerHTML = `
      <div class="queue-shell">
        <div class="queue-header">
          <h1>Your Queue</h1>
          <p class="page-lead">Live position, updated automatically.</p>
          ${nav}
        </div>
        <div id="queue-body">${inner}</div>
        <p class="message" id="queue-message" role="status"></p>
        ${tabbar("queue")}
      </div>
    `;
    bindTabs();
  };

  paint(`<p class="empty-state">Loading…</p>`);

  // Chained timeouts rather than a fixed interval, so the gap can adapt.
  function scheduleNext(entries) {
    if (queueTimer) clearTimeout(queueTimer);
    if (document.hidden) return;
    queueTimer = setTimeout(load, queuePollDelay(entries));
  }

  async function load() {
    let entries;
    try {
      entries = await api("/customer/queue");
    } catch (error) {
      stopQueuePolling();
      paint(`<p class="empty-state">${escapeHtml(error.message)}</p>`);
      return;
    }

    if (viewFromHash() !== "queue") {
      stopQueuePolling();
      return;
    }

    if (!document.getElementById("queue-body")) return;

    if (!entries.length) {
      stopQueuePolling();
      paint(`<p class="empty-state">You're not in any queue. Open a business and tap “Join Queue”.</p>`);
      return;
    }

    scheduleNext(entries);

    entries.sort((a, b) => {
      const waitDiff =
        (a.estimated_wait_minutes ?? Number.POSITIVE_INFINITY) -
        (b.estimated_wait_minutes ?? Number.POSITIVE_INFINITY);
      if (waitDiff !== 0) return waitDiff;
      return (a.position ?? 0) - (b.position ?? 0);
    });

    // Rebuilding the whole shell keeps the sticky nav in sync with the cards.
    navObserver?.disconnect();
    paint(entries.map(queueCardHtml).join(""), queueNavHtml(entries));

    // Only jump on the paint right after arriving from a business page; later
    // polls must not yank the customer's scroll position around.
    const focusEntry = queueFocusBusinessId
      ? entries.find((entry) => Number(entry.business_id) === Number(queueFocusBusinessId))
      : null;
    queueFocusBusinessId = null;

    navObserver = bindQueueNav(focusEntry?.id);
    // Done here rather than in the nav so it still runs for a lone queue,
    // where there is no nav bar to bind.
    if (focusEntry) highlightQueueCard(focusEntry.id);

    document.querySelectorAll("[data-leave]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await api(`/customer/queue/${btn.dataset.leave}/leave`, { method: "POST" });
          await load();
        } catch (error) {
          const message = document.getElementById("queue-message");
          if (message) message.textContent = error.message;
          btn.disabled = false;
        }
      });
    });
  }

  // A backgrounded tab has nobody watching it, so stop polling until it returns.
  queueVisibilityHandler = () => {
    if (document.hidden) {
      if (queueTimer) clearTimeout(queueTimer);
      queueTimer = null;
    } else if (viewFromHash() === "queue") {
      load();
    }
  };
  document.addEventListener("visibilitychange", queueVisibilityHandler);

  await load();
}

async function render() {
  stopQueuePolling();

  if (!getToken()) {
    const view = viewFromHash();
    if (view === "signup") return renderSignup();
    if (view === "verify") return renderVerify();
    return renderLogin();
  }

  const view = viewFromHash();
  // Drop a pending focus if the customer headed somewhere other than the queue.
  if (view !== "queue") queueFocusBusinessId = null;

  if (view.startsWith("business-")) {
    const id = Number(view.replace("business-", ""));
    if (id) return renderBusinessDetail(id);
  }
  if (view === "bookings") return renderBookings();
  if (view === "queue") return renderQueue();
  if (view === "profile") return renderProfile();
  if (view === "login" || view === "signup" || view === "verify") {
    return renderHome();
  }
  return renderHome();
}

window.addEventListener("hashchange", render);
render();
