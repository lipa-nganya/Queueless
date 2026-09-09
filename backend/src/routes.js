import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { query } from "./db.js";
import {
  login,
  vendorLogin,
  requireAdmin,
  requireCustomer,
  requireVendor,
  signCustomerToken,
} from "./auth.js";
import {
  deliverOtp,
  generateOtp,
  normalizeKenyaPhone,
  otpExpiryDate,
  sendSms,
  smsDeliveryStatus,
} from "./otp.js";
import { sendAdminInviteEmail } from "./mail.js";
import {
  SMS_ENABLED,
  WHATSAPP_ENABLED,
  CONTACT_PHONE,
  CONTACT_EMAIL,
  getBoolSetting,
  getSetting,
  setSetting,
  smsProviderConfigured,
  whatsappProviderConfigured,
} from "./settings.js";
import {
  notifyQueueEvent,
  normalizeWhatsAppPhone,
  sendWhatsAppText,
  sendWhatsAppTemplate,
  whatsappConfigured,
} from "./whatsapp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, "../uploads");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_TTL_HOURS = 72;

// Kenya bounding box used to bias Photon results toward the country.
const KENYA_BBOX = "33.909,-4.678,41.899,5.507";
const NAIROBI = { lat: -1.286389, lon: 36.817223 };

function parseCoord(value, min, max) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

async function searchPlacesKenya(q, { limit = 8 } = {}) {
  const queryText = String(q || "").trim();
  if (queryText.length < 2) return [];

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", queryText);
  url.searchParams.set("limit", String(Math.min(12, Math.max(1, limit))));
  url.searchParams.set("lang", "en");
  url.searchParams.set("lat", String(NAIROBI.lat));
  url.searchParams.set("lon", String(NAIROBI.lon));
  url.searchParams.set("bbox", KENYA_BBOX);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "QueuelessKenya/1.0 (Kenya place search)",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error("Place search is temporarily unavailable.");
  }

  const payload = await response.json().catch(() => ({}));
  const features = Array.isArray(payload.features) ? payload.features : [];
  return features
    .filter((feature) => {
      const code = String(feature?.properties?.countrycode || "").toLowerCase();
      return !code || code === "ke";
    })
    .slice(0, limit)
    .map((feature) => {
      const [longitude, latitude] = feature.geometry?.coordinates || [];
      return {
        label: placeLabel(feature.properties),
        latitude: Number(latitude),
        longitude: Number(longitude),
      };
    })
    .filter(
      (place) =>
        place.label &&
        Number.isFinite(place.latitude) &&
        Number.isFinite(place.longitude)
    );
}

async function resolveBusinessCoords(row) {
  const latitude = parseCoord(row?.latitude, -90, 90);
  const longitude = parseCoord(row?.longitude, -180, 180);
  if (latitude != null && longitude != null) {
    return { ...row, latitude, longitude };
  }

  const hint = String(row?.location || "").trim();
  if (hint.length < 2) {
    return { ...row, latitude: null, longitude: null };
  }

  try {
    const place = (await searchPlacesKenya(hint, { limit: 1 }))[0];
    if (!place) return { ...row, latitude: null, longitude: null };

    if (row?.id) {
      await query(
        `
          UPDATE businesses
          SET latitude = $1, longitude = $2
          WHERE id = $3 AND latitude IS NULL AND longitude IS NULL
        `,
        [place.latitude, place.longitude, row.id]
      );
    }

    return { ...row, latitude: place.latitude, longitude: place.longitude };
  } catch (error) {
    console.error("Geocode business failed:", error);
    return { ...row, latitude: null, longitude: null };
  }
}

function placeLabel(props = {}) {
  const parts = [
    props.name,
    props.street,
    props.locality || props.city || props.county,
    props.district || props.state,
  ].filter(Boolean);
  // Drop consecutive duplicates (Photon often repeats the city).
  const unique = parts.filter((part, i) => part !== parts[i - 1]);
  return unique.join(", ") || "Unknown place";
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `business-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) return cb(null, true);
    cb(new Error("Only image files are allowed."));
  },
});

const router = Router();
const PIN_RE = /^\d{4}$/;

function resolvePhone(body) {
  if (body?.country_code || body?.phone_number) {
    return normalizeKenyaPhone(body?.phone_number || body?.phone, body?.country_code);
  }
  return normalizeKenyaPhone(body?.phone);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createInviteToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

function inviteExpiryDate() {
  return new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);
}

function adminBaseUrl(req) {
  if (process.env.ADMIN_BASE_URL) return process.env.ADMIN_BASE_URL.replace(/\/$/, "");
  const host = req.get("host");
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  return `${proto}://${host}`;
}

function usernameFromEmail(email) {
  const local = String(email).split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return local || `admin${Date.now()}`;
}

async function uniqueUsername(preferred) {
  let base = preferred.slice(0, 40) || "admin";
  let candidate = base;
  for (let i = 0; i < 20; i += 1) {
    const existing = await query(
      "SELECT id FROM admins WHERE username = $1 LIMIT 1",
      [candidate]
    );
    if (!existing.rows[0]) return candidate;
    candidate = `${base}${i + 2}`;
  }
  return `${base}${Date.now()}`;
}

async function issueInviteForAdmin({ adminId, email, invitedByUsername, req }) {
  const { token, tokenHash } = createInviteToken();
  const expiresAt = inviteExpiryDate();

  await query(
    `
      UPDATE admins
      SET invite_token_hash = $1,
          invite_expires_at = $2,
          password_hash = NULL,
          activated_at = NULL
      WHERE id = $3
    `,
    [tokenHash, expiresAt, adminId]
  );

  const inviteUrl = `${adminBaseUrl(req)}/#accept-invite/${token}`;
  const delivery = await sendAdminInviteEmail({
    to: email,
    inviteUrl,
    invitedBy: invitedByUsername,
  });

  return { inviteUrl, delivery, expiresAt };
}

/**
 * The invite itself is already saved, so a mail problem must not fail the request —
 * hand the link back instead so it can be shared manually.
 */
function inviteDeliveryPayload({ delivery, inviteUrl, email }) {
  if (delivery.mode === "email") {
    return { mail_mode: "email", message: `Invite email sent to ${email}.` };
  }
  if (delivery.mode === "failed") {
    return {
      mail_mode: "failed",
      invite_url: inviteUrl,
      message: `${delivery.error} The invite is still valid — share the link below.`,
    };
  }
  return {
    mail_mode: "web",
    invite_url: inviteUrl,
    message: "Invite created. Email is not configured — copy the invite link below.",
  };
}

router.post("/auth/login", async (req, res) => {
  try {
    const username = String(req.body?.username || req.body?.email || "").trim();
    const password = String(req.body?.password || "");

    if (!username || !password) {
      return res.status(400).json({ error: "Username (or email) and password are required." });
    }

    const session = await login(username, password);
    if (!session) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    return res.json(session);
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({ error: "Login failed." });
  }
});

/* ---------------------------------------------------------------- settings */

async function settingsPayload() {
  return {
    sms_enabled: await getBoolSetting(SMS_ENABLED, false),
    sms_provider: "Advanta",
    sms_configured: smsProviderConfigured(),
    sms_shortcode: process.env.ADVANTA_SHORTCODE || "not set",
    whatsapp_enabled: await getBoolSetting(WHATSAPP_ENABLED, false),
    whatsapp_provider: "Meta Cloud API",
    whatsapp_configured: whatsappProviderConfigured(),
    whatsapp_phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    whatsapp_template: process.env.WHATSAPP_TEMPLATE_NAME || "",
    contact_phone: (await getSetting(CONTACT_PHONE, "")) || "",
    contact_email: (await getSetting(CONTACT_EMAIL, "")) || "",
  };
}

router.get("/settings", requireAdmin, async (_req, res) => {
  try {
    return res.json(await settingsPayload());
  } catch (error) {
    console.error("Load settings failed:", error);
    return res.status(500).json({ error: "Could not load settings." });
  }
});

router.put("/settings", requireAdmin, async (req, res) => {
  try {
    if (typeof req.body?.sms_enabled !== "undefined") {
      const enabled = req.body.sms_enabled === true || req.body.sms_enabled === "true";

      // Turning this on without credentials would silently break signup, since
      // customers would stop seeing an OTP anywhere.
      if (enabled && !smsProviderConfigured()) {
        return res.status(400).json({
          error:
            "Advanta is not configured. Set ADVANTA_API_KEY and ADVANTA_PARTNER_ID before enabling real SMS.",
        });
      }

      await setSetting(SMS_ENABLED, enabled, req.admin?.sub ?? null);
    }

    if (typeof req.body?.whatsapp_enabled !== "undefined") {
      const enabled = req.body.whatsapp_enabled === true || req.body.whatsapp_enabled === "true";
      if (enabled && !whatsappProviderConfigured()) {
        return res.status(400).json({
          error:
            "WhatsApp is not configured. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID before enabling.",
        });
      }
      await setSetting(WHATSAPP_ENABLED, enabled, req.admin?.sub ?? null);
    }

    if (typeof req.body?.contact_phone !== "undefined") {
      const phone = String(req.body.contact_phone || "").trim();
      if (phone && !normalizeKenyaPhone(phone)) {
        return res.status(400).json({ error: "Enter a valid contact phone number." });
      }
      await setSetting(
        CONTACT_PHONE,
        phone ? `+${normalizeKenyaPhone(phone)}` : "",
        req.admin?.sub ?? null
      );
    }

    if (typeof req.body?.contact_email !== "undefined") {
      const email = String(req.body.contact_email || "").trim().toLowerCase();
      if (email && !EMAIL_RE.test(email)) {
        return res.status(400).json({ error: "Enter a valid contact email address." });
      }
      await setSetting(CONTACT_EMAIL, email, req.admin?.sub ?? null);
    }

    return res.json(await settingsPayload());
  } catch (error) {
    console.error("Update settings failed:", error);
    return res.status(500).json({ error: "Could not update settings." });
  }
});

// Lets an admin confirm Advanta really works before trusting it with signups.
router.post("/settings/test-sms", requireAdmin, async (req, res) => {
  try {
    const phone = normalizeKenyaPhone(req.body?.phone, req.body?.country_code);
    if (!phone) return res.status(400).json({ error: "Enter a valid phone number." });
    if (!smsProviderConfigured()) {
      return res.status(400).json({ error: "Advanta is not configured." });
    }

    const accepted = await sendSms({
      phone,
      message: "Queueless: test message. SMS delivery is working.",
    });
    const messageId = accepted?.responses?.[0]?.messageid ?? null;
    if (!messageId) {
      return res.json({ ok: true, phone, message: `Advanta accepted the message for ${phone}.` });
    }

    // Give the provider a few seconds to move it past "Scheduled" before
    // reporting back, so the admin sees delivery rather than just acceptance.
    let delivery = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      delivery = await smsDeliveryStatus(messageId);
      if (delivery.description && delivery.description !== "Scheduled") break;
    }

    // Advanta can hold a message in "Scheduled" for anything from seconds to
    // well over half an hour when its queue is backed up, and it still lands.
    // Queued is therefore not a failure — only report what is actually known.
    const pending = !delivery || delivery.description === "Scheduled";
    return res.json({
      ok: true,
      delivered: !pending,
      pending,
      phone,
      message_id: messageId,
      delivery_status: delivery?.description ?? "Unknown",
      message: pending
        ? `Advanta accepted the message for ${phone} (ID ${messageId}) and it is queued for delivery. It has not been confirmed on the handset yet — during a backlog this can take anywhere from a few minutes to over half an hour.`
        : `Delivered to ${phone} (${delivery.description}).`,
    });
  } catch (error) {
    console.error("Test SMS failed:", error);
    return res.status(502).json({ error: error.message || "Could not send the test SMS." });
  }
});

router.post("/settings/test-whatsapp", requireAdmin, async (req, res) => {
  try {
    const phone = normalizeWhatsAppPhone(req.body?.phone || req.body?.phone_number);
    if (!phone) return res.status(400).json({ error: "Enter a valid phone number." });
    if (!whatsappConfigured()) {
      return res.status(400).json({ error: "WhatsApp is not configured." });
    }

    // Prefer Meta's default hello_world template for Settings tests — plain
    // text is often accepted by the API but never shown on the handset when
    // using the sandbox test number outside an open conversation.
    const preferredTemplate = (process.env.WHATSAPP_TEMPLATE_NAME || "hello_world").trim();
    let payload;
    let used = preferredTemplate;

    try {
      payload = await sendWhatsAppTemplate({
        phone,
        templateName: preferredTemplate,
        languageCode: process.env.WHATSAPP_TEMPLATE_LANG || "en_US",
        bodyParams:
          preferredTemplate === "hello_world"
            ? []
            : ["Test Customer", "Queueless Test Shop", "1", "5"],
      });
    } catch (templateError) {
      // Fall back to text so we still surface useful Meta errors (e.g. 131030).
      try {
        payload = await sendWhatsAppText({
          phone,
          message: "Queueless: test WhatsApp message. Delivery is working.",
        });
        used = "text";
      } catch (textError) {
        const detail = templateError.message || textError.message;
        if (templateError.code === 131030 || textError.code === 131030) {
          return res.status(400).json({
            error: `Meta rejected ${phone}: not on the WhatsApp allowlist. Add it under Meta → WhatsApp → Step 1 → To, then try again.`,
          });
        }
        throw templateError.code ? templateError : textError;
      }
    }

    return res.json({
      ok: true,
      phone,
      via: used,
      message_id: payload?.messages?.[0]?.id || null,
      message: `WhatsApp accepted the ${used === "text" ? "text" : "template"} message for ${phone}. Check chats from Meta's test number (+1 555…).`,
    });
  } catch (error) {
    console.error("Test WhatsApp failed:", error);
    if (error.code === 131030) {
      return res.status(400).json({
        error:
          "That phone is not on Meta's WhatsApp allowlist. Add it under Meta → WhatsApp → Step 1 → To.",
      });
    }
    return res.status(502).json({ error: error.message || "Could not send the test WhatsApp." });
  }
});

router.get("/admins", requireAdmin, async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        a.id,
        a.username,
        a.email,
        a.created_at,
        a.activated_at,
        a.invite_expires_at,
        inviter.username AS invited_by_username,
        CASE
          WHEN a.activated_at IS NOT NULL THEN 'active'
          WHEN a.invite_expires_at IS NOT NULL AND a.invite_expires_at < NOW() THEN 'invite_expired'
          WHEN a.invite_token_hash IS NOT NULL THEN 'invited'
          ELSE 'incomplete'
        END AS status
      FROM admins a
      LEFT JOIN admins inviter ON inviter.id = a.invited_by
      ORDER BY a.created_at DESC
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error("List admins failed:", error);
    return res.status(500).json({ error: "Could not load admins." });
  }
});

router.post("/admins/invite", requireAdmin, async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const requestedUsername = String(req.body?.username || "").trim().toLowerCase();

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    const existing = await query(
      `
        SELECT id, username, email, activated_at, invite_token_hash
        FROM admins
        WHERE lower(email) = $1
           OR ($2 <> '' AND username = $2)
        LIMIT 1
      `,
      [email, requestedUsername]
    );

    if (existing.rows[0]?.activated_at) {
      return res.status(409).json({ error: "An active admin already uses that email or username." });
    }

    let adminId = existing.rows[0]?.id;
    let username = existing.rows[0]?.username;

    if (!adminId) {
      username = await uniqueUsername(requestedUsername || usernameFromEmail(email));
      const created = await query(
        `
          INSERT INTO admins (username, email, password_hash, invited_by, activated_at)
          VALUES ($1, $2, NULL, $3, NULL)
          RETURNING id, username, email
        `,
        [username, email, req.admin.sub]
      );
      adminId = created.rows[0].id;
      username = created.rows[0].username;
    } else {
      await query(
        `
          UPDATE admins
          SET email = $1,
              invited_by = COALESCE(invited_by, $2)
          WHERE id = $3
        `,
        [email, req.admin.sub, adminId]
      );
    }

    const { inviteUrl, delivery, expiresAt } = await issueInviteForAdmin({
      adminId,
      email,
      invitedByUsername: req.admin.username,
      req,
    });

    return res.status(201).json({
      id: adminId,
      username,
      email,
      status: "invited",
      invite_expires_at: expiresAt,
      ...inviteDeliveryPayload({ delivery, inviteUrl, email }),
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "That email or username is already in use." });
    }
    console.error("Invite admin failed:", error);
    return res.status(500).json({ error: "Could not send invite." });
  }
});

router.post("/admins/:id/resend-invite", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await query(
      `
        SELECT id, username, email, activated_at
        FROM admins
        WHERE id = $1
        LIMIT 1
      `,
      [id]
    );
    const admin = result.rows[0];
    if (!admin) return res.status(404).json({ error: "Admin not found." });
    if (admin.activated_at) {
      return res.status(400).json({ error: "This admin is already active." });
    }
    if (!admin.email) {
      return res.status(400).json({ error: "This admin has no email address." });
    }

    const { inviteUrl, delivery, expiresAt } = await issueInviteForAdmin({
      adminId: admin.id,
      email: admin.email,
      invitedByUsername: req.admin.username,
      req,
    });

    return res.json({
      id: admin.id,
      username: admin.username,
      email: admin.email,
      status: "invited",
      invite_expires_at: expiresAt,
      ...inviteDeliveryPayload({ delivery, inviteUrl, email: admin.email }),
    });
  } catch (error) {
    console.error("Resend invite failed:", error);
    return res.status(500).json({ error: "Could not resend invite." });
  }
});

router.get("/admins/invite/:token", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token || token.length < 32) {
      return res.status(400).json({ error: "Invalid invite link." });
    }

    const result = await query(
      `
        SELECT id, username, email, invite_expires_at, activated_at
        FROM admins
        WHERE invite_token_hash = $1
        LIMIT 1
      `,
      [hashToken(token)]
    );
    const admin = result.rows[0];
    if (!admin) {
      return res.status(404).json({ error: "Invite not found or already used." });
    }
    if (admin.activated_at) {
      return res.status(400).json({ error: "This invite has already been accepted." });
    }
    if (admin.invite_expires_at && new Date(admin.invite_expires_at) < new Date()) {
      return res.status(400).json({ error: "This invite has expired. Ask an admin to resend it." });
    }

    return res.json({
      email: admin.email,
      username: admin.username,
      expires_at: admin.invite_expires_at,
    });
  } catch (error) {
    console.error("Get invite failed:", error);
    return res.status(500).json({ error: "Could not load invite." });
  }
});

router.post("/admins/accept-invite", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");
    const confirmPassword = String(req.body?.confirm_password || "");
    const usernameInput = String(req.body?.username || "").trim().toLowerCase();

    if (!token) {
      return res.status(400).json({ error: "Invite token is required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Password and confirm password do not match." });
    }

    const result = await query(
      `
        SELECT id, username, email, invite_expires_at, activated_at
        FROM admins
        WHERE invite_token_hash = $1
        LIMIT 1
      `,
      [hashToken(token)]
    );
    const admin = result.rows[0];
    if (!admin) {
      return res.status(404).json({ error: "Invite not found or already used." });
    }
    if (admin.activated_at) {
      return res.status(400).json({ error: "This invite has already been accepted." });
    }
    if (admin.invite_expires_at && new Date(admin.invite_expires_at) < new Date()) {
      return res.status(400).json({ error: "This invite has expired. Ask an admin to resend it." });
    }

    let username = admin.username;
    if (usernameInput && usernameInput !== admin.username) {
      if (!/^[a-z0-9._-]{3,40}$/.test(usernameInput)) {
        return res.status(400).json({
          error: "Username must be 3–40 characters (letters, numbers, . _ -).",
        });
      }
      const clash = await query(
        "SELECT id FROM admins WHERE username = $1 AND id <> $2 LIMIT 1",
        [usernameInput, admin.id]
      );
      if (clash.rows[0]) {
        return res.status(409).json({ error: "That username is already taken." });
      }
      username = usernameInput;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const activated = await query(
      `
        UPDATE admins
        SET username = $1,
            password_hash = $2,
            activated_at = NOW(),
            invite_token_hash = NULL,
            invite_expires_at = NULL
        WHERE id = $3
        RETURNING id, username, email
      `,
      [username, passwordHash, admin.id]
    );

    const session = await login(activated.rows[0].username, password);
    return res.json({
      ...session,
      message: "Password set. You are signed in.",
    });
  } catch (error) {
    console.error("Accept invite failed:", error);
    return res.status(500).json({ error: "Could not activate account." });
  }
});

/*
 * A queue's length is the admin-maintained walk-in baseline plus everyone
 * waiting through the app, matching what customers are shown.
 */
const QUEUE_TOTALS_CTE = `
  WITH queue_totals AS (
    SELECT
      b.id,
      b.name,
      b.image_url,
      b.avg_wait_minutes,
      bg.name AS business_group_name,
      bg.icon AS business_group_icon,
      b.queue_size + COALESCE(q.waiting, 0) AS waiting_total
    FROM businesses b
    INNER JOIN business_groups bg ON bg.id = b.business_group_id
    LEFT JOIN (
      SELECT business_id, COUNT(*)::int AS waiting
      FROM queue_entries
      WHERE status = 'waiting'
      GROUP BY business_id
    ) q ON q.business_id = b.id
  )
`;

router.get("/dashboard", requireAdmin, async (_req, res) => {
  try {
    const counts = await query(`
      ${QUEUE_TOTALS_CTE}
      SELECT
        (SELECT COUNT(*)::int FROM customers) AS customers_count,
        (SELECT COUNT(*)::int FROM business_groups) AS business_groups_count,
        (SELECT COUNT(*)::int FROM businesses) AS businesses_count,
        (SELECT COUNT(*)::int FROM queue_totals WHERE waiting_total > 0) AS ongoing_queues_count,
        (SELECT COALESCE(SUM(waiting_total), 0)::int FROM queue_totals) AS people_waiting_count
    `);

    const topQueues = await query(`
      ${QUEUE_TOTALS_CTE}
      SELECT
        id,
        name,
        image_url,
        avg_wait_minutes,
        business_group_name,
        business_group_icon,
        waiting_total,
        (waiting_total * avg_wait_minutes) AS clear_time_minutes
      FROM queue_totals
      WHERE waiting_total > 0
      ORDER BY waiting_total DESC, name ASC
      LIMIT 3
    `);

    return res.json({ ...counts.rows[0], top_queues: topQueues.rows });
  } catch (error) {
    console.error("Dashboard failed:", error);
    return res.status(500).json({ error: "Could not load dashboard." });
  }
});

router.get("/customers", requireAdmin, async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        id,
        first_name,
        phone,
        otp_code,
        otp_expires_at,
        phone_verified_at,
        created_at,
        CASE
          WHEN phone_verified_at IS NOT NULL THEN 'verified'
          WHEN otp_expires_at IS NOT NULL AND otp_expires_at < NOW() THEN 'otp_expired'
          WHEN otp_code IS NOT NULL THEN 'pending_otp'
          ELSE 'incomplete'
        END AS status
      FROM customers
      ORDER BY created_at DESC
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error("List customers failed:", error);
    return res.status(500).json({ error: "Could not load customers." });
  }
});

/*
 * Icon keys the admin can pick from. The SVG for each key lives in the admin
 * and customer front-ends; only the key is stored.
 */
export const GROUP_ICONS = [
  "beauty",
  "healthcare",
  "financial",
  "automotive",
  "hospitality",
  "government",
  "education",
  "retail",
  "professional",
  "travel",
  "entertainment",
  "more",
  // Legacy keys still stored on older groups.
  "scissors",
  "salon",
  "clinic",
  "pharmacy",
  "bank",
  "restaurant",
  "shop",
  "car",
  "fitness",
  "phone",
];

function normalizeIcon(value) {
  if (value == null || value === "") return null;
  const key = String(value).trim().toLowerCase();
  return GROUP_ICONS.includes(key) ? key : undefined;
}

router.get("/business-groups", requireAdmin, async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        bg.id,
        bg.name,
        bg.icon,
        bg.created_at,
        COUNT(b.id)::int AS businesses_count
      FROM business_groups bg
      LEFT JOIN businesses b ON b.business_group_id = bg.id
      GROUP BY bg.id
      ORDER BY bg.name ASC
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error("List groups failed:", error);
    return res.status(500).json({ error: "Could not load business groups." });
  }
});

router.get("/business-group-icons", requireAdmin, (_req, res) => {
  return res.json(GROUP_ICONS);
});

router.post("/business-groups", requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Business group name is required." });
    }

    const icon = normalizeIcon(req.body?.icon);
    if (icon === undefined) {
      return res.status(400).json({ error: "Choose an icon from the list." });
    }

    const result = await query(
      `
        INSERT INTO business_groups (name, icon)
        VALUES ($1, $2)
        RETURNING id, name, icon, created_at
      `,
      [name, icon]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "That business group already exists." });
    }
    console.error("Create group failed:", error);
    return res.status(500).json({ error: "Could not create business group." });
  }
});

router.put("/business-groups/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body?.name || "").trim();
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid business group." });
    }
    if (!name) {
      return res.status(400).json({ error: "Business group name is required." });
    }

    const icon = normalizeIcon(req.body?.icon);
    if (icon === undefined) {
      return res.status(400).json({ error: "Choose an icon from the list." });
    }

    const result = await query(
      `
        UPDATE business_groups
        SET name = $1, icon = $2
        WHERE id = $3
        RETURNING id, name, icon, created_at
      `,
      [name, icon, id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Business group not found." });
    return res.json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "That business group already exists." });
    }
    console.error("Update group failed:", error);
    return res.status(500).json({ error: "Could not update business group." });
  }
});

router.get("/businesses", requireAdmin, async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        b.id,
        b.name,
        b.description,
        b.location,
        b.latitude,
        b.longitude,
        b.phone,
        b.operating_hours,
        b.image_url,
        b.is_active,
        b.created_at,
        b.business_group_id,
        bg.name AS business_group_name
      FROM businesses b
      INNER JOIN business_groups bg ON bg.id = b.business_group_id
      ORDER BY b.created_at DESC
    `);
    const branches = await query(`
      SELECT
        id, business_id, name, location, latitude, longitude, phone,
        operating_hours, queue_size, avg_wait_minutes, is_active, created_at
      FROM business_branches
      ORDER BY name ASC, id ASC
    `);
    const byBusiness = new Map();
    for (const branch of branches.rows) {
      const list = byBusiness.get(branch.business_id) || [];
      list.push(branch);
      byBusiness.set(branch.business_id, list);
    }
    return res.json(
      result.rows.map((row) => ({
        ...row,
        branches: byBusiness.get(row.id) || [],
      }))
    );
  } catch (error) {
    console.error("List businesses failed:", error);
    return res.status(500).json({ error: "Could not load businesses." });
  }
});

// Kenya-only place search via Photon (OSM). Proxied so we can set a proper
// User-Agent and keep autocomplete credentials/keys out of the admin UI later.
router.get("/places/search", requireAdmin, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json([]);

    const places = await searchPlacesKenya(q, { limit: 8 });
    return res.json(places);
  } catch (error) {
    console.error("Place search failed:", error);
    return res.status(502).json({ error: "Could not search places." });
  }
});

router.post("/businesses", requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const businessGroupId = Number(req.body?.business_group_id);
    const location = String(req.body?.location || "").trim() || null;
    let latitude = parseCoord(req.body?.latitude, -90, 90);
    let longitude = parseCoord(req.body?.longitude, -180, 180);

    if (!name) {
      return res.status(400).json({ error: "Business name is required." });
    }
    if (!Number.isInteger(businessGroupId) || businessGroupId < 1) {
      return res.status(400).json({ error: "Select a business group." });
    }

    if ((latitude == null || longitude == null) && location) {
      const geocoded = await resolveBusinessCoords({ location });
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
    }

    const result = await query(
      `
        INSERT INTO businesses (name, business_group_id, location, latitude, longitude, is_active)
        VALUES ($1, $2, $3, $4, $5, false)
        RETURNING id, name, business_group_id, location, latitude, longitude, operating_hours, is_active, created_at
      `,
      [name, businessGroupId, location, latitude, longitude]
    );

    const created = result.rows[0];
    const branch = await createBusinessBranch(created.id, {
      name: "Main",
      location,
      latitude,
      longitude,
      isActive: true,
    });
    const group = await query(
      "SELECT name FROM business_groups WHERE id = $1",
      [businessGroupId]
    );

    return res.status(201).json({
      ...created,
      business_group_name: group.rows[0]?.name || null,
      branches: [branch],
    });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(400).json({ error: "Business group not found." });
    }
    if (error.code === "23505") {
      return res.status(409).json({ error: "That business already exists in this group." });
    }
    console.error("Create business failed:", error);
    return res.status(500).json({ error: "Could not create business." });
  }
});

router.get("/businesses/:id/branches", requireAdmin, async (req, res) => {
  try {
    const businessId = Number(req.params.id);
    if (!Number.isInteger(businessId) || businessId < 1) {
      return res.status(400).json({ error: "Invalid business." });
    }
    const business = await query("SELECT id FROM businesses WHERE id = $1", [businessId]);
    if (!business.rows[0]) return res.status(404).json({ error: "Business not found." });
    return res.json(await listBranchesForBusiness(businessId));
  } catch (error) {
    console.error("List branches failed:", error);
    return res.status(500).json({ error: "Could not load branches." });
  }
});

router.post("/businesses/:id/branches", requireAdmin, async (req, res) => {
  try {
    const businessId = Number(req.params.id);
    if (!Number.isInteger(businessId) || businessId < 1) {
      return res.status(400).json({ error: "Invalid business." });
    }
    const business = await query("SELECT id FROM businesses WHERE id = $1", [businessId]);
    if (!business.rows[0]) return res.status(404).json({ error: "Business not found." });

    const payload = parseBranchPayload(req.body);
    if (!payload.name) {
      return res.status(400).json({ error: "Branch name is required." });
    }

    let { latitude, longitude } = payload;
    if (payload.location && (latitude == null || longitude == null)) {
      const geocoded = await resolveBusinessCoords({ location: payload.location });
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
    }

    const branch = await createBusinessBranch(businessId, {
      name: payload.name,
      location: payload.location,
      latitude,
      longitude,
      phone: payload.phone,
      operatingHours: payload.operatingHours,
      isActive: payload.hasActive ? payload.isActive : true,
    });
    return res.status(201).json(branch);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "That branch name already exists for this business." });
    }
    console.error("Create branch failed:", error);
    return res.status(500).json({ error: "Could not create branch." });
  }
});

router.put("/businesses/:id/branches/:branchId", requireAdmin, async (req, res) => {
  try {
    const businessId = Number(req.params.id);
    const branchId = Number(req.params.branchId);
    if (!Number.isInteger(businessId) || businessId < 1 || !Number.isInteger(branchId) || branchId < 1) {
      return res.status(400).json({ error: "Invalid branch." });
    }

    const payload = parseBranchPayload(req.body);
    if (!payload.name) {
      return res.status(400).json({ error: "Branch name is required." });
    }

    let { latitude, longitude } = payload;
    if (payload.location && (latitude == null || longitude == null)) {
      const geocoded = await resolveBusinessCoords({ location: payload.location });
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
    }

    const result = await query(
      `
        UPDATE business_branches
        SET name = $1,
            location = $2,
            phone = $3,
            operating_hours = $4,
            latitude = $5,
            longitude = $6
            ${payload.hasActive ? `, is_active = ${payload.isActive ? "true" : "false"}` : ""}
        WHERE id = $7 AND business_id = $8
        RETURNING *
      `,
      [
        payload.name,
        payload.location,
        payload.phone,
        payload.operatingHours,
        latitude,
        longitude,
        branchId,
        businessId,
      ]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Branch not found." });
    return res.json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "That branch name already exists for this business." });
    }
    console.error("Update branch failed:", error);
    return res.status(500).json({ error: "Could not update branch." });
  }
});

router.delete("/businesses/:id/branches/:branchId", requireAdmin, async (req, res) => {
  try {
    const businessId = Number(req.params.id);
    const branchId = Number(req.params.branchId);
    if (!Number.isInteger(businessId) || businessId < 1 || !Number.isInteger(branchId) || branchId < 1) {
      return res.status(400).json({ error: "Invalid branch." });
    }

    const count = await query(
      "SELECT COUNT(*)::int AS total FROM business_branches WHERE business_id = $1",
      [businessId]
    );
    if ((count.rows[0]?.total || 0) <= 1) {
      return res.status(400).json({ error: "A business must keep at least one branch." });
    }

    const result = await query(
      `
        DELETE FROM business_branches
        WHERE id = $1 AND business_id = $2
        RETURNING id
      `,
      [branchId, businessId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Branch not found." });
    return res.json({ ok: true, id: result.rows[0].id });
  } catch (error) {
    console.error("Delete branch failed:", error);
    return res.status(500).json({ error: "Could not delete branch." });
  }
});

router.get("/businesses/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await query(
      `
        SELECT
          b.id, b.name, b.description, b.location, b.latitude, b.longitude,
          b.phone, b.operating_hours, b.image_url, b.is_active, b.business_group_id,
          bg.name AS business_group_name, b.created_at
        FROM businesses b
        INNER JOIN business_groups bg ON bg.id = b.business_group_id
        WHERE b.id = $1
      `,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Business not found." });
    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Get business failed:", error);
    return res.status(500).json({ error: "Could not load business." });
  }
});

router.put("/businesses/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body?.name || "").trim();
    const businessGroupId = Number(req.body?.business_group_id);
    const description = String(req.body?.description || "").trim() || null;
    const location = String(req.body?.location || "").trim() || null;
    const phone = String(req.body?.phone || "").trim() || null;
    const operatingHours = String(req.body?.operating_hours || "").trim() || null;
    let latitude = location ? parseCoord(req.body?.latitude, -90, 90) : null;
    let longitude = location ? parseCoord(req.body?.longitude, -180, 180) : null;
    const queueSize = req.body?.queue_size != null ? Number(req.body.queue_size) : undefined;
    const avgWait = req.body?.avg_wait_minutes != null ? Number(req.body.avg_wait_minutes) : undefined;
    const hasActive = typeof req.body?.is_active !== "undefined";
    const isActive = hasActive
      ? req.body.is_active === true || req.body.is_active === "true"
      : undefined;

    if (!name) return res.status(400).json({ error: "Business name is required." });
    if (!Number.isInteger(businessGroupId) || businessGroupId < 1) {
      return res.status(400).json({ error: "Select a business group." });
    }

    if (location && (latitude == null || longitude == null)) {
      const geocoded = await resolveBusinessCoords({ location });
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
    }

    const result = await query(
      `
        UPDATE businesses
        SET name = $1, business_group_id = $2, description = $3, location = $4, phone = $5,
            operating_hours = $6, latitude = $7, longitude = $8
          ${queueSize != null ? ", queue_size = " + Math.max(0, Math.round(queueSize)) : ""}
          ${avgWait != null ? ", avg_wait_minutes = " + Math.max(1, Math.round(avgWait)) : ""}
          ${hasActive ? ", is_active = " + (isActive ? "true" : "false") : ""}
        WHERE id = $9
        RETURNING id, name, business_group_id, description, location, latitude, longitude,
          phone, operating_hours, image_url, is_active, queue_size, avg_wait_minutes, created_at
      `,
      [name, businessGroupId, description, location, phone, operatingHours, latitude, longitude, id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Business not found." });

    const group = await query("SELECT name FROM business_groups WHERE id = $1", [businessGroupId]);
    return res.json({ ...result.rows[0], business_group_name: group.rows[0]?.name || null });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "That business already exists in this group." });
    console.error("Update business failed:", error);
    return res.status(500).json({ error: "Could not update business." });
  }
});

router.post("/businesses/:id/image", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!req.file) return res.status(400).json({ error: "No image file provided." });

    const imageUrl = `/uploads/${req.file.filename}`;
    const result = await query(
      "UPDATE businesses SET image_url = $1 WHERE id = $2 RETURNING id, image_url",
      [imageUrl, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Business not found." });
    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Upload image failed:", error);
    return res.status(500).json({ error: "Could not upload image." });
  }
});

router.post("/customer/signup", async (req, res) => {
  try {
    const firstName = String(req.body?.first_name || "").trim();
    const phone = resolvePhone(req.body);
    const pin = String(req.body?.pin || "");
    const confirmPin = String(req.body?.confirm_pin || "");

    if (!firstName) {
      return res.status(400).json({ error: "First name is required." });
    }
    if (!phone) {
      return res.status(400).json({ error: "Enter a valid Kenyan phone number." });
    }
    if (!PIN_RE.test(pin)) {
      return res.status(400).json({ error: "PIN must be exactly 4 digits." });
    }
    if (pin !== confirmPin) {
      return res.status(400).json({ error: "PIN and confirm PIN do not match." });
    }

    const existing = await query(
      `
        SELECT id, phone_verified_at, otp_expires_at, otp_resend_count, otp_last_sent_at
        FROM customers WHERE phone = $1 LIMIT 1
      `,
      [phone]
    );

    if (existing.rows[0]?.phone_verified_at) {
      return res.status(409).json({ error: "This phone number is already registered. Please log in." });
    }

    // Re-running signup on an unverified number is another code send, so it
    // has to respect the same cap — otherwise the limit is trivially bypassed.
    if (existing.rows[0] && (await resendState(existing.rows[0])).exhausted) {
      return res.status(429).json({
        error: await supportMessageText(),
        support_phone: await supportPhone(),
      });
    }

    const otp = generateOtp();
    const otpExpiresAt = otpExpiryDate(10);
    const pinHash = await bcrypt.hash(pin, 10);

    let customer;
    if (existing.rows[0]) {
      const updated = await query(
        `
          UPDATE customers
          SET first_name = $1,
              full_name = $1,
              pin_hash = $2,
              otp_code = $3,
              otp_expires_at = $4,
              phone_verified_at = NULL,
              otp_resend_count = customers.otp_resend_count + 1,
              otp_last_sent_at = NOW()
          WHERE phone = $5
          RETURNING id, first_name, phone, otp_code, otp_expires_at
        `,
        [firstName, pinHash, otp, otpExpiresAt, phone]
      );
      customer = updated.rows[0];
    } else {
      const created = await query(
        `
          INSERT INTO customers (first_name, full_name, phone, pin_hash, otp_code, otp_expires_at)
          VALUES ($1, $1, $2, $3, $4, $5)
          RETURNING id, first_name, phone, otp_code, otp_expires_at
        `,
        [firstName, phone, pinHash, otp, otpExpiresAt]
      );
      customer = created.rows[0];
    }

    // The account row already exists, so a provider outage must not fail the
    // signup — fall back to the admin-visible OTP instead of losing the account.
    let delivery;
    try {
      delivery = await deliverOtp({ phone, otp, firstName });
    } catch (error) {
      console.error("OTP delivery failed, falling back to web display:", error);
      delivery = { mode: "web", sent: false, degraded: true };
    }

    return res.status(201).json({
      phone: customer.phone,
      first_name: customer.first_name,
      otp_mode: delivery.mode,
      message:
        delivery.mode === "web"
          ? "Account created. Enter the OTP shown in Admin → Customers."
          : "Account created. Enter the OTP sent to your phone.",
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "This phone number is already registered." });
    }
    console.error("Customer signup failed:", error);
    return res.status(500).json({ error: "Could not create account." });
  }
});

/* ------------------------------------------------------------ OTP resends */

const DEFAULT_SUPPORT_PHONE = "+254712674333";
const MAX_OTP_RESENDS = 3;
const OTP_RESEND_COOLDOWN_SECONDS = 120;

async function supportPhone() {
  const configured = String((await getSetting(CONTACT_PHONE, "")) || "").trim();
  return configured || DEFAULT_SUPPORT_PHONE;
}

async function supportMessageText() {
  const phone = await supportPhone();
  return `You've reached the limit of ${MAX_OTP_RESENDS} code resends. Please contact support on ${phone}.`;
}

function cooldownRemaining(lastSentAt) {
  if (!lastSentAt) return 0;
  const elapsed = (Date.now() - new Date(lastSentAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed));
}

async function resendState(customer) {
  const used = customer.otp_resend_count || 0;
  const remaining = cooldownRemaining(customer.otp_last_sent_at);
  const expired = Boolean(
    customer.otp_expires_at && new Date(customer.otp_expires_at) < new Date()
  );
  const exhausted = used >= MAX_OTP_RESENDS;
  const phone = await supportPhone();

  return {
    verified: Boolean(customer.phone_verified_at),
    expired,
    resends_used: used,
    resends_left: Math.max(0, MAX_OTP_RESENDS - used),
    cooldown_seconds: remaining,
    exhausted,
    can_resend: !customer.phone_verified_at && !exhausted && remaining === 0,
    support_phone: phone,
  };
}

// Drives the verify screen: how long until the customer may ask for a new
// code, and how many attempts they have left.
router.post("/customer/otp-status", async (req, res) => {
  try {
    const phone = resolvePhone(req.body);
    if (!phone) return res.status(400).json({ error: "Enter a valid Kenyan phone number." });

    const result = await query(
      `
        SELECT phone_verified_at, otp_expires_at, otp_resend_count, otp_last_sent_at
        FROM customers WHERE phone = $1 LIMIT 1
      `,
      [phone]
    );
    const customer = result.rows[0];
    if (!customer) return res.status(404).json({ error: "Account not found. Please sign up first." });

    return res.json({ phone, ...(await resendState(customer)) });
  } catch (error) {
    console.error("OTP status failed:", error);
    return res.status(500).json({ error: "Could not check that number." });
  }
});

router.post("/customer/resend-otp", async (req, res) => {
  try {
    const phone = resolvePhone(req.body);
    if (!phone) return res.status(400).json({ error: "Enter a valid Kenyan phone number." });

    const result = await query(
      `
        SELECT id, first_name, phone, phone_verified_at, otp_expires_at,
               otp_resend_count, otp_last_sent_at
        FROM customers WHERE phone = $1 LIMIT 1
      `,
      [phone]
    );
    const customer = result.rows[0];
    if (!customer) return res.status(404).json({ error: "Account not found. Please sign up first." });

    if (customer.phone_verified_at) {
      return res.status(409).json({ error: "This number is already verified. Please log in." });
    }

    const state = await resendState(customer);
    if (state.exhausted) {
      return res.status(429).json({ error: await supportMessageText(), ...state });
    }
    if (state.cooldown_seconds > 0) {
      return res.status(429).json({
        error: `Please wait ${state.cooldown_seconds}s before requesting another code.`,
        ...state,
      });
    }

    const otp = generateOtp();
    const updated = await query(
      `
        UPDATE customers
        SET otp_code = $1,
            otp_expires_at = $2,
            otp_resend_count = otp_resend_count + 1,
            otp_last_sent_at = NOW()
        WHERE id = $3
        RETURNING phone_verified_at, otp_expires_at, otp_resend_count, otp_last_sent_at
      `,
      [otp, otpExpiryDate(10), customer.id]
    );

    // A provider outage must not consume the customer's remaining attempts
    // silently, so report the failure while keeping the new code usable.
    let delivery;
    try {
      delivery = await deliverOtp({ phone, otp, firstName: customer.first_name });
    } catch (error) {
      console.error("OTP resend delivery failed, falling back to web display:", error);
      delivery = { mode: "web", sent: false };
    }

    const next = await resendState(updated.rows[0]);
    return res.json({
      phone,
      otp_mode: delivery.mode,
      ...next,
      message:
        delivery.mode === "web"
          ? "New code generated. Enter the OTP shown in Admin → Customers."
          : "A new code is on its way to your phone.",
    });
  } catch (error) {
    console.error("OTP resend failed:", error);
    return res.status(500).json({ error: "Could not resend the code." });
  }
});

router.post("/customer/verify-otp", async (req, res) => {
  try {
    const phone = resolvePhone(req.body);
    const otp = String(req.body?.otp || "").trim();

    if (!phone || !/^\d{4}$/.test(otp)) {
      return res.status(400).json({ error: "Phone and 4-digit OTP are required." });
    }

    const result = await query(
      `
        SELECT id, first_name, phone, otp_code, otp_expires_at, phone_verified_at, pin_hash
        FROM customers
        WHERE phone = $1
        LIMIT 1
      `,
      [phone]
    );

    const customer = result.rows[0];
    if (!customer) {
      return res.status(404).json({ error: "Account not found. Please sign up first." });
    }

    if (customer.phone_verified_at) {
      const token = signCustomerToken(customer);
      return res.json({
        token,
        first_name: customer.first_name,
        phone: customer.phone,
        message: "Phone already verified.",
      });
    }

    if (!customer.otp_code || customer.otp_code !== otp) {
      return res.status(400).json({ error: "Incorrect OTP." });
    }

    if (customer.otp_expires_at && new Date(customer.otp_expires_at) < new Date()) {
      const state = await resendState(customer);
      return res.status(400).json({
        error: state.exhausted
          ? `That code has expired. ${await supportMessageText()}`
          : "That code has expired. Tap “Resend code” to get a new one.",
        expired: true,
        ...state,
      });
    }

    const verified = await query(
      `
        UPDATE customers
        SET phone_verified_at = NOW(),
            otp_code = NULL,
            otp_expires_at = NULL,
            otp_resend_count = 0,
            otp_last_sent_at = NULL
        WHERE id = $1
        RETURNING id, first_name, phone
      `,
      [customer.id]
    );

    const sessionCustomer = verified.rows[0];
    const token = signCustomerToken(sessionCustomer);

    return res.json({
      token,
      first_name: sessionCustomer.first_name,
      phone: sessionCustomer.phone,
      message: "Phone verified. You are signed in.",
    });
  } catch (error) {
    console.error("Verify OTP failed:", error);
    return res.status(500).json({ error: "Could not verify OTP." });
  }
});

/*
 * Lets the login screen ask for a PIN only once it knows the number has an
 * account. Reveals no more than the login route already does, since signup is
 * open and an unknown number is routed there anyway.
 */
router.post("/customer/phone-status", async (req, res) => {
  try {
    const phone = resolvePhone(req.body);
    if (!phone) return res.status(400).json({ error: "Enter a valid Kenyan phone number." });

    const result = await query(
      `SELECT first_name, pin_hash, phone_verified_at FROM customers WHERE phone = $1 LIMIT 1`,
      [phone]
    );
    const customer = result.rows[0];

    if (!customer?.pin_hash) {
      return res.json({ phone, registered: false });
    }
    if (!customer.phone_verified_at) {
      return res.json({ phone, registered: true, needs_otp: true });
    }
    return res.json({ phone, registered: true, first_name: customer.first_name });
  } catch (error) {
    console.error("Phone status check failed:", error);
    return res.status(500).json({ error: "Could not check that number." });
  }
});

router.post("/customer/login", async (req, res) => {
  try {
    const phone = resolvePhone(req.body);
    const pin = String(req.body?.pin || "");

    if (!phone || !PIN_RE.test(pin)) {
      return res.status(400).json({ error: "Phone and 4-digit PIN are required." });
    }

    const result = await query(
      `
        SELECT id, first_name, phone, pin_hash, phone_verified_at
        FROM customers
        WHERE phone = $1
        LIMIT 1
      `,
      [phone]
    );

    // Signup is open to anyone, so telling the caller a number is unregistered
    // reveals nothing they could not learn by trying to sign up with it.
    const customer = result.rows[0];
    if (!customer) {
      return res.status(404).json({
        error: "That number isn't registered yet.",
        not_registered: true,
        phone,
      });
    }

    if (!customer.pin_hash) {
      return res.status(401).json({ error: "Invalid phone number or PIN." });
    }

    if (!customer.phone_verified_at) {
      return res.status(403).json({
        error: "Phone not verified yet. Complete OTP verification first.",
        needs_otp: true,
        phone: customer.phone,
      });
    }

    const ok = await bcrypt.compare(pin, customer.pin_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid phone number or PIN." });
    }

    const token = signCustomerToken(customer);
    return res.json({
      token,
      first_name: customer.first_name,
      phone: customer.phone,
    });
  } catch (error) {
    console.error("Customer login failed:", error);
    return res.status(500).json({ error: "Login failed." });
  }
});

router.get("/customer/me", requireCustomer, async (req, res) => {
  try {
    const result = await query(
      `
        SELECT id, first_name, phone, phone_verified_at, created_at
        FROM customers
        WHERE id = $1
        LIMIT 1
      `,
      [req.customer.sub]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Customer not found." });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Customer me failed:", error);
    return res.status(500).json({ error: "Could not load profile." });
  }
});

router.get("/customer/contact", requireCustomer, async (_req, res) => {
  try {
    return res.json({
      phone: (await getSetting(CONTACT_PHONE, "")) || "",
      email: (await getSetting(CONTACT_EMAIL, "")) || "",
    });
  } catch (error) {
    console.error("Customer contact failed:", error);
    return res.status(500).json({ error: "Could not load contact details." });
  }
});

router.get("/customer/business-groups", requireCustomer, async (_req, res) => {
  try {
    const result = await query(`
      SELECT id, name, icon, created_at
      FROM business_groups
      ORDER BY name ASC
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error("Customer groups failed:", error);
    return res.status(500).json({ error: "Could not load categories." });
  }
});

router.get("/customer/businesses", requireCustomer, async (req, res) => {
  try {
    const groupId = Number(req.query.group_id);
    const params = [];
    const clauses = ["b.is_active = true"];
    if (Number.isInteger(groupId) && groupId > 0) {
      params.push(groupId);
      clauses.push(`b.business_group_id = $${params.length}`);
    }
    const where = `WHERE ${clauses.join(" AND ")}`;

    const result = await query(
      `
        SELECT
          b.id,
          b.name,
          b.description,
          b.location,
          b.latitude,
          b.longitude,
          b.phone,
          b.image_url,
          b.queue_size,
          b.avg_wait_minutes,
          b.created_at,
          b.business_group_id,
          bg.name AS business_group_name
        FROM businesses b
        INNER JOIN business_groups bg ON bg.id = b.business_group_id
        ${where}
        ORDER BY b.name ASC
      `,
      params
    );
    return res.json(
      await Promise.all(result.rows.map((row) => resolveBusinessCoords(row)))
    );
  } catch (error) {
    console.error("Customer businesses failed:", error);
    return res.status(500).json({ error: "Could not load businesses." });
  }
});

router.get("/customer/businesses/:id", requireCustomer, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await query(
      `
        SELECT
          b.id,
          b.name,
          b.description,
          b.location,
          b.latitude,
          b.longitude,
          b.phone,
          b.image_url,
          b.queue_size,
          b.avg_wait_minutes,
          b.created_at,
          b.business_group_id,
          bg.name AS business_group_name
        FROM businesses b
        INNER JOIN business_groups bg ON bg.id = b.business_group_id
        WHERE b.id = $1 AND b.is_active = true
      `,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Business not found." });
    return res.json(await resolveBusinessCoords(result.rows[0]));
  } catch (error) {
    console.error("Customer business detail failed:", error);
    return res.status(500).json({ error: "Could not load business." });
  }
});

/*
 * Queue and bookings.
 *
 * businesses.queue_size is the walk-in baseline an admin maintains for people
 * physically in line, so the number of customers ahead of an app user is that
 * baseline plus everyone who joined through the app before them.
 */

async function createBusinessBranch(businessId, {
  name = "Main",
  location = null,
  latitude = null,
  longitude = null,
  phone = null,
  operatingHours = null,
  queueSize = 0,
  avgWaitMinutes = 15,
  isActive = true,
} = {}) {
  const branchName = String(name || "Main").trim() || "Main";
  const result = await query(
    `
      INSERT INTO business_branches (
        business_id, name, location, latitude, longitude, phone, operating_hours,
        queue_size, avg_wait_minutes, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
    [
      businessId,
      branchName,
      location,
      latitude,
      longitude,
      phone,
      operatingHours,
      Math.max(0, Math.round(Number(queueSize) || 0)),
      Math.max(1, Math.round(Number(avgWaitMinutes) || 15)),
      Boolean(isActive),
    ]
  );
  return result.rows[0];
}

async function listBranchesForBusiness(businessId) {
  const result = await query(
    `
      SELECT
        id, business_id, name, location, latitude, longitude, phone,
        operating_hours, queue_size, avg_wait_minutes, is_active, created_at
      FROM business_branches
      WHERE business_id = $1
      ORDER BY name ASC, id ASC
    `,
    [businessId]
  );
  return result.rows;
}

async function getDefaultBranchForBusiness(businessId, { activeOnly = true } = {}) {
  const result = await query(
    `
      SELECT *
      FROM business_branches
      WHERE business_id = $1
        ${activeOnly ? "AND is_active = true" : ""}
      ORDER BY id ASC
      LIMIT 1
    `,
    [businessId]
  );
  return result.rows[0] || null;
}

function parseBranchPayload(body = {}) {
  const name = String(body?.name || "").trim();
  const location = String(body?.location || "").trim() || null;
  const phone = String(body?.phone || "").trim() || null;
  const operatingHours = String(body?.operating_hours || "").trim() || null;
  const latitude = location ? parseCoord(body?.latitude, -90, 90) : null;
  const longitude = location ? parseCoord(body?.longitude, -180, 180) : null;
  const hasActive = typeof body?.is_active !== "undefined";
  const isActive = hasActive
    ? body.is_active === true || body.is_active === "true"
    : undefined;
  return {
    name,
    location,
    phone,
    operatingHours,
    latitude,
    longitude,
    hasActive,
    isActive,
  };
}

const BOOKING_WINDOW_HOURS = 24;

// Wraps a queue_entries row with the derived position figures the UI needs.
const QUEUE_ENTRY_SELECT = `
  SELECT
    qe.id,
    qe.business_id,
    qe.branch_id,
    qe.joined_at,
    qe.booking_id,
    b.name AS business_name,
    COALESCE(br.name, 'Main') AS branch_name,
    b.image_url,
    COALESCE(br.location, b.location) AS location,
    COALESCE(br.avg_wait_minutes, b.avg_wait_minutes) AS avg_wait_minutes,
    COALESCE(br.queue_size, b.queue_size, 0) AS walk_in_baseline,
    bg.name AS business_group_name,
    c.first_name AS customer_first_name,
    c.phone AS customer_phone,
    (
      SELECT COUNT(*)::int
      FROM queue_entries ahead
      WHERE ahead.status = 'waiting'
        AND ahead.joined_at < qe.joined_at
        AND (
          (qe.branch_id IS NOT NULL AND ahead.branch_id = qe.branch_id)
          OR (qe.branch_id IS NULL AND ahead.business_id = qe.business_id AND ahead.branch_id IS NULL)
        )
    ) AS app_customers_ahead,
    (
      SELECT COUNT(*)::int
      FROM queue_entries total
      WHERE total.status = 'waiting'
        AND (
          (qe.branch_id IS NOT NULL AND total.branch_id = qe.branch_id)
          OR (qe.branch_id IS NULL AND total.business_id = qe.business_id AND total.branch_id IS NULL)
        )
    ) AS app_queue_length
  FROM queue_entries qe
  INNER JOIN businesses b ON b.id = qe.business_id
  INNER JOIN business_groups bg ON bg.id = b.business_group_id
  INNER JOIN customers c ON c.id = qe.customer_id
  LEFT JOIN business_branches br ON br.id = qe.branch_id
`;

function decorateQueueEntry(row) {
  const ahead = row.walk_in_baseline + row.app_customers_ahead;
  return {
    ...row,
    people_ahead: ahead,
    position: ahead + 1,
    queue_length: row.walk_in_baseline + row.app_queue_length,
    estimated_wait_minutes: ahead * row.avg_wait_minutes,
  };
}

/** Phones that should get WhatsApp when someone joins/leaves this business. */
async function queueAlertRecipients(businessId, businessPhone = null) {
  const recipients = new Set();

  for (const phone of String(process.env.WHATSAPP_NOTIFY_PHONES || "").split(",")) {
    const trimmed = phone.trim();
    if (trimmed) recipients.add(trimmed);
  }

  const contactPhone = await getSetting(CONTACT_PHONE, "");
  if (contactPhone) recipients.add(contactPhone);
  if (businessPhone) recipients.add(businessPhone);

  const vendors = await query(
    `
      SELECT v.phone
      FROM vendors v
      INNER JOIN vendor_businesses vb ON vb.vendor_id = v.id
      WHERE vb.business_id = $1 AND v.phone IS NOT NULL AND v.phone <> ''
    `,
    [businessId]
  );
  for (const row of vendors.rows) recipients.add(row.phone);

  const admins = await query(
    `SELECT phone FROM admins WHERE phone IS NOT NULL AND phone <> ''`
  );
  for (const row of admins.rows) recipients.add(row.phone);

  return [...recipients];
}

function fireQueueWhatsApp(action, businessId, businessPhone, details) {
  void (async () => {
    try {
      const recipients = await queueAlertRecipients(businessId, businessPhone);
      await notifyQueueEvent(action, recipients, details);
    } catch (error) {
      console.error(`Queue ${action} WhatsApp notify failed:`, error);
    }
  })();
}

router.post("/customer/businesses/:id/queue", requireCustomer, async (req, res) => {
  try {
    const businessId = Number(req.params.id);
    if (!Number.isInteger(businessId) || businessId < 1) {
      return res.status(400).json({ error: "Invalid business." });
    }

    const business = await query(
      "SELECT id, name, phone FROM businesses WHERE id = $1 AND is_active = true",
      [businessId]
    );
    if (!business.rows[0]) return res.status(404).json({ error: "Business not found." });

    const requestedBranchId = Number(req.body?.branch_id);
    let branch = null;
    if (Number.isInteger(requestedBranchId) && requestedBranchId > 0) {
      const branchResult = await query(
        `
          SELECT * FROM business_branches
          WHERE id = $1 AND business_id = $2 AND is_active = true
        `,
        [requestedBranchId, businessId]
      );
      branch = branchResult.rows[0] || null;
      if (!branch) return res.status(404).json({ error: "Branch not found." });
    } else {
      branch = await getDefaultBranchForBusiness(businessId, { activeOnly: true });
      if (!branch) return res.status(404).json({ error: "No active branch available." });
    }

    const existing = await query(
      `
        SELECT id FROM queue_entries
        WHERE branch_id = $1 AND customer_id = $2 AND status = 'waiting'
        LIMIT 1
      `,
      [branch.id, req.customer.sub]
    );
    if (existing.rows[0]) {
      return res.status(409).json({
        error: "You are already in this queue.",
        entry_id: existing.rows[0].id,
      });
    }

    const bookingId = req.body?.booking_id ? Number(req.body.booking_id) : null;
    const created = await query(
      `
        INSERT INTO queue_entries (business_id, branch_id, customer_id, booking_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [businessId, branch.id, req.customer.sub, bookingId]
    );

    if (bookingId) {
      await query(
        "UPDATE bookings SET status = 'fulfilled' WHERE id = $1 AND customer_id = $2",
        [bookingId, req.customer.sub]
      );
    }

    const entry = await query(`${QUEUE_ENTRY_SELECT} WHERE qe.id = $1`, [created.rows[0].id]);
    const decorated = decorateQueueEntry(entry.rows[0]);

    fireQueueWhatsApp("join", businessId, branch.phone || business.rows[0].phone, {
      customerName: req.customer.first_name || null,
      customerPhone: req.customer.phone || null,
      businessName: decorated.business_name || business.rows[0].name,
      position: decorated.position,
      estimatedWaitMinutes: decorated.estimated_wait_minutes,
    });

    return res.status(201).json(decorated);
  } catch (error) {
    console.error("Join queue failed:", error);
    return res.status(500).json({ error: "Could not join the queue." });
  }
});

router.get("/customer/queue", requireCustomer, async (req, res) => {
  try {
    const result = await query(
      `${QUEUE_ENTRY_SELECT} WHERE qe.customer_id = $1 AND qe.status = 'waiting' ORDER BY qe.joined_at ASC`,
      [req.customer.sub]
    );
    return res.json(result.rows.map(decorateQueueEntry));
  } catch (error) {
    console.error("Load queue failed:", error);
    return res.status(500).json({ error: "Could not load your queue." });
  }
});

router.post("/customer/queue/:id/leave", requireCustomer, async (req, res) => {
  try {
    const entryId = Number(req.params.id);
    const existing = await query(
      `
        SELECT
          qe.id,
          qe.business_id,
          b.name AS business_name,
          b.phone AS business_phone
        FROM queue_entries qe
        INNER JOIN businesses b ON b.id = qe.business_id
        WHERE qe.id = $1 AND qe.customer_id = $2 AND qe.status = 'waiting'
      `,
      [entryId, req.customer.sub]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: "Queue entry not found." });

    const result = await query(
      `
        UPDATE queue_entries
        SET status = 'cancelled', left_at = NOW()
        WHERE id = $1 AND customer_id = $2 AND status = 'waiting'
        RETURNING id
      `,
      [entryId, req.customer.sub]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Queue entry not found." });

    const row = existing.rows[0];
    fireQueueWhatsApp("leave", row.business_id, row.business_phone, {
      customerName: req.customer.first_name || null,
      customerPhone: req.customer.phone || null,
      businessName: row.business_name,
    });

    return res.json({ ok: true, id: result.rows[0].id });
  } catch (error) {
    console.error("Leave queue failed:", error);
    return res.status(500).json({ error: "Could not leave the queue." });
  }
});

router.post("/customer/businesses/:id/bookings", requireCustomer, async (req, res) => {
  try {
    const businessId = Number(req.params.id);
    const scheduledFor = new Date(req.body?.scheduled_for);

    if (!Number.isInteger(businessId) || businessId < 1) {
      return res.status(400).json({ error: "Invalid business." });
    }
    if (Number.isNaN(scheduledFor.getTime())) {
      return res.status(400).json({ error: "Choose a valid time." });
    }

    const now = Date.now();
    if (scheduledFor.getTime() <= now) {
      return res.status(400).json({ error: "Pick a time in the future." });
    }
    if (scheduledFor.getTime() > now + BOOKING_WINDOW_HOURS * 60 * 60 * 1000) {
      return res.status(400).json({
        error: `Bookings can only be made up to ${BOOKING_WINDOW_HOURS} hours in advance.`,
      });
    }

    const business = await query(
      "SELECT id FROM businesses WHERE id = $1 AND is_active = true",
      [businessId]
    );
    if (!business.rows[0]) return res.status(404).json({ error: "Business not found." });

    const clash = await query(
      `
        SELECT id FROM bookings
        WHERE customer_id = $1 AND business_id = $2 AND status = 'booked'
        LIMIT 1
      `,
      [req.customer.sub, businessId]
    );
    if (clash.rows[0]) {
      return res.status(409).json({ error: "You already have a booking with this business." });
    }

    const created = await query(
      `
        INSERT INTO bookings (business_id, customer_id, scheduled_for)
        VALUES ($1, $2, $3)
        RETURNING id, business_id, scheduled_for, status, created_at
      `,
      [businessId, req.customer.sub, scheduledFor.toISOString()]
    );

    return res.status(201).json(created.rows[0]);
  } catch (error) {
    console.error("Create booking failed:", error);
    return res.status(500).json({ error: "Could not create the booking." });
  }
});

router.get("/customer/bookings", requireCustomer, async (req, res) => {
  try {
    const result = await query(
      `
        SELECT
          bk.id,
          bk.business_id,
          bk.scheduled_for,
          bk.status,
          bk.created_at,
          b.name AS business_name,
          b.image_url,
          b.location,
          b.avg_wait_minutes,
          bg.name AS business_group_name
        FROM bookings bk
        INNER JOIN businesses b ON b.id = bk.business_id
        INNER JOIN business_groups bg ON bg.id = b.business_group_id
        WHERE bk.customer_id = $1 AND bk.status = 'booked'
        ORDER BY bk.scheduled_for ASC
      `,
      [req.customer.sub]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("Load bookings failed:", error);
    return res.status(500).json({ error: "Could not load your bookings." });
  }
});

router.post("/customer/bookings/:id/cancel", requireCustomer, async (req, res) => {
  try {
    const result = await query(
      `
        UPDATE bookings
        SET status = 'cancelled'
        WHERE id = $1 AND customer_id = $2 AND status = 'booked'
        RETURNING id
      `,
      [Number(req.params.id), req.customer.sub]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Booking not found." });
    return res.json({ ok: true, id: result.rows[0].id });
  } catch (error) {
    console.error("Cancel booking failed:", error);
    return res.status(500).json({ error: "Could not cancel the booking." });
  }
});

/* ---------------------------------------------------------------- vendors */

async function vendorOwnsBusiness(vendorId, businessId) {
  const result = await query(
    `
      SELECT 1 FROM vendor_businesses
      WHERE vendor_id = $1 AND business_id = $2
      LIMIT 1
    `,
    [vendorId, businessId]
  );
  return Boolean(result.rows[0]);
}

async function vendorOwnsBranch(vendorId, branchId) {
  const result = await query(
    `
      SELECT br.id, br.business_id
      FROM business_branches br
      INNER JOIN vendor_businesses vb
        ON vb.business_id = br.business_id AND vb.vendor_id = $1
      WHERE br.id = $2
      LIMIT 1
    `,
    [vendorId, branchId]
  );
  return result.rows[0] || null;
}

async function replaceVendorBusinesses(vendorId, businessIds) {
  const ids = [
    ...new Set(
      (Array.isArray(businessIds) ? businessIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    ),
  ];

  if (ids.length) {
    const existing = await query(
      `SELECT id FROM businesses WHERE id = ANY($1::int[])`,
      [ids]
    );
    if (existing.rows.length !== ids.length) {
      const err = new Error("One or more businesses were not found.");
      err.status = 400;
      throw err;
    }
  }

  await query("DELETE FROM vendor_businesses WHERE vendor_id = $1", [vendorId]);
  for (const businessId of ids) {
    await query(
      `
        INSERT INTO vendor_businesses (vendor_id, business_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [vendorId, businessId]
    );
  }
  return ids;
}

async function vendorWithBusinesses(vendorId) {
  const vendor = await query(
    `
      SELECT id, username, email, phone, created_at, activated_at
      FROM vendors WHERE id = $1
    `,
    [vendorId]
  );
  if (!vendor.rows[0]) return null;

  const businesses = await query(
    `
      SELECT b.id, b.name, b.is_active
      FROM vendor_businesses vb
      INNER JOIN businesses b ON b.id = vb.business_id
      WHERE vb.vendor_id = $1
      ORDER BY b.name ASC
    `,
    [vendorId]
  );

  return { ...vendor.rows[0], businesses: businesses.rows };
}

router.post("/vendor/login", async (req, res) => {
  try {
    const username = String(req.body?.username || req.body?.email || "").trim();
    const password = String(req.body?.password || "");
    if (!username || !password) {
      return res.status(400).json({ error: "Username (or email) and password are required." });
    }

    const session = await vendorLogin(username, password);
    if (!session) {
      return res.status(401).json({ error: "Invalid username or password." });
    }
    return res.json(session);
  } catch (error) {
    console.error("Vendor login failed:", error);
    return res.status(500).json({ error: "Login failed." });
  }
});

router.get("/vendor/me", requireVendor, async (req, res) => {
  try {
    const result = await query(
      `
        SELECT id, username, email, created_at, activated_at
        FROM vendors WHERE id = $1
      `,
      [req.vendor.sub]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Vendor not found." });
    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Vendor me failed:", error);
    return res.status(500).json({ error: "Could not load profile." });
  }
});

router.get("/vendor/businesses", requireVendor, async (req, res) => {
  try {
    // Vendors see every branch under their assigned businesses.
    const result = await query(
      `
        SELECT
          br.id,
          br.business_id,
          b.name AS business_name,
          br.name,
          br.location,
          br.phone,
          br.operating_hours,
          b.image_url,
          br.queue_size,
          br.avg_wait_minutes,
          br.is_active,
          bg.name AS business_group_name,
          (
            SELECT COUNT(*)::int FROM queue_entries qe
            WHERE qe.branch_id = br.id AND qe.status = 'waiting'
          ) AS app_waiting
        FROM vendor_businesses vb
        INNER JOIN businesses b ON b.id = vb.business_id
        INNER JOIN business_groups bg ON bg.id = b.business_group_id
        INNER JOIN business_branches br ON br.business_id = b.id
        WHERE vb.vendor_id = $1
        ORDER BY b.name ASC, br.name ASC, br.id ASC
      `,
      [req.vendor.sub]
    );

    return res.json(
      result.rows.map((row) => ({
        ...row,
        waiting_total: (row.queue_size || 0) + (row.app_waiting || 0),
      }))
    );
  } catch (error) {
    console.error("Vendor businesses failed:", error);
    return res.status(500).json({ error: "Could not load businesses." });
  }
});

router.get("/vendor/businesses/:id", requireVendor, async (req, res) => {
  try {
    const branchId = Number(req.params.id);
    if (!Number.isInteger(branchId) || branchId < 1) {
      return res.status(400).json({ error: "Invalid branch." });
    }
    if (!(await vendorOwnsBranch(req.vendor.sub, branchId))) {
      return res.status(403).json({ error: "You do not manage this branch." });
    }

    const result = await query(
      `
        SELECT
          br.id,
          br.business_id,
          b.name AS business_name,
          br.name,
          br.location,
          br.phone,
          br.operating_hours,
          b.image_url,
          br.is_active,
          b.business_group_id,
          bg.name AS business_group_name
        FROM business_branches br
        INNER JOIN businesses b ON b.id = br.business_id
        INNER JOIN business_groups bg ON bg.id = b.business_group_id
        WHERE br.id = $1
      `,
      [branchId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Branch not found." });
    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Vendor business detail failed:", error);
    return res.status(500).json({ error: "Could not load business." });
  }
});

router.put("/vendor/businesses/:id", requireVendor, async (req, res) => {
  try {
    const branchId = Number(req.params.id);
    if (!Number.isInteger(branchId) || branchId < 1) {
      return res.status(400).json({ error: "Invalid branch." });
    }
    if (!(await vendorOwnsBranch(req.vendor.sub, branchId))) {
      return res.status(403).json({ error: "You do not manage this branch." });
    }

    const name = String(req.body?.name || "").trim();
    const operatingHours = String(req.body?.operating_hours || "").trim() || null;
    const hasActive = typeof req.body?.is_active !== "undefined";
    const isActive = hasActive
      ? req.body.is_active === true || req.body.is_active === "true"
      : undefined;

    if (!name) {
      return res.status(400).json({ error: "Branch name is required." });
    }

    const result = await query(
      `
        UPDATE business_branches
        SET name = $1,
            operating_hours = $2
            ${hasActive ? `, is_active = ${isActive ? "true" : "false"}` : ""}
        WHERE id = $3
        RETURNING
          id, business_id, name, location, phone, operating_hours, is_active
      `,
      [name, operatingHours, branchId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Branch not found." });

    const business = await query(
      `
        SELECT b.name, b.business_group_id, bg.name AS business_group_name, b.image_url
        FROM businesses b
        INNER JOIN business_groups bg ON bg.id = b.business_group_id
        WHERE b.id = $1
      `,
      [result.rows[0].business_id]
    );
    return res.json({
      ...result.rows[0],
      business_name: business.rows[0]?.name || null,
      business_group_id: business.rows[0]?.business_group_id || null,
      business_group_name: business.rows[0]?.business_group_name || null,
      image_url: business.rows[0]?.image_url || null,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "That branch name already exists for this business." });
    }
    console.error("Vendor business update failed:", error);
    return res.status(500).json({ error: "Could not update business." });
  }
});

router.get("/vendor/businesses/:id/queue", requireVendor, async (req, res) => {
  try {
    const branchId = Number(req.params.id);
    if (!Number.isInteger(branchId) || branchId < 1) {
      return res.status(400).json({ error: "Invalid branch." });
    }
    if (!(await vendorOwnsBranch(req.vendor.sub, branchId))) {
      return res.status(403).json({ error: "You do not manage this branch." });
    }

    const branch = await query(
      `
        SELECT
          br.id,
          br.business_id,
          br.name,
          br.location,
          br.queue_size,
          br.avg_wait_minutes,
          br.is_active,
          b.name AS business_name,
          bg.name AS business_group_name
        FROM business_branches br
        INNER JOIN businesses b ON b.id = br.business_id
        INNER JOIN business_groups bg ON bg.id = b.business_group_id
        WHERE br.id = $1
      `,
      [branchId]
    );
    if (!branch.rows[0]) return res.status(404).json({ error: "Branch not found." });

    const entries = await query(
      `${QUEUE_ENTRY_SELECT}
       WHERE qe.branch_id = $1 AND qe.status = 'waiting'
       ORDER BY qe.joined_at ASC`,
      [branchId]
    );

    const decorated = entries.rows.map(decorateQueueEntry);
    const br = branch.rows[0];
    return res.json({
      business: {
        id: br.id,
        business_id: br.business_id,
        name: br.business_name,
        branch_name: br.name,
        location: br.location,
        queue_size: br.queue_size,
        avg_wait_minutes: br.avg_wait_minutes,
        is_active: br.is_active,
        business_group_name: br.business_group_name,
        waiting_total: (br.queue_size || 0) + decorated.length,
        app_waiting: decorated.length,
      },
      entries: decorated,
    });
  } catch (error) {
    console.error("Vendor queue failed:", error);
    return res.status(500).json({ error: "Could not load the queue." });
  }
});

async function closeVendorQueueEntry(req, res, status) {
  try {
    const entryId = Number(req.params.id);
    if (!Number.isInteger(entryId) || entryId < 1) {
      return res.status(400).json({ error: "Invalid queue entry." });
    }

    const entry = await query(
      `
        SELECT qe.id, qe.business_id, qe.status
        FROM queue_entries qe
        INNER JOIN vendor_businesses vb
          ON vb.business_id = qe.business_id AND vb.vendor_id = $2
        WHERE qe.id = $1
        LIMIT 1
      `,
      [entryId, req.vendor.sub]
    );
    if (!entry.rows[0]) return res.status(404).json({ error: "Queue entry not found." });
    if (entry.rows[0].status !== "waiting") {
      return res.status(409).json({ error: "That customer is no longer waiting." });
    }

    const updated = await query(
      `
        UPDATE queue_entries
        SET status = $1, left_at = NOW()
        WHERE id = $2 AND status = 'waiting'
        RETURNING id, business_id, status, left_at
      `,
      [status, entryId]
    );
    if (!updated.rows[0]) {
      return res.status(409).json({ error: "That customer is no longer waiting." });
    }
    return res.json({ ok: true, ...updated.rows[0] });
  } catch (error) {
    console.error(`Vendor queue ${status} failed:`, error);
    return res.status(500).json({ error: "Could not update the queue." });
  }
}

router.post("/vendor/queue/:id/serve", requireVendor, (req, res) =>
  closeVendorQueueEntry(req, res, "served")
);

router.post("/vendor/queue/:id/no-show", requireVendor, (req, res) =>
  closeVendorQueueEntry(req, res, "no_show")
);

router.put("/vendor/businesses/:id/walk-ins", requireVendor, async (req, res) => {
  try {
    const branchId = Number(req.params.id);
    const queueSize = Number(req.body?.queue_size);
    if (!Number.isInteger(branchId) || branchId < 1) {
      return res.status(400).json({ error: "Invalid branch." });
    }
    if (!Number.isFinite(queueSize) || queueSize < 0 || queueSize > 500) {
      return res.status(400).json({ error: "Walk-in count must be between 0 and 500." });
    }
    if (!(await vendorOwnsBranch(req.vendor.sub, branchId))) {
      return res.status(403).json({ error: "You do not manage this branch." });
    }

    const result = await query(
      `
        UPDATE business_branches
        SET queue_size = $1
        WHERE id = $2
        RETURNING id, name, queue_size, avg_wait_minutes
      `,
      [Math.round(queueSize), branchId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Branch not found." });
    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Vendor walk-ins update failed:", error);
    return res.status(500).json({ error: "Could not update walk-ins." });
  }
});

/* -------------------------------------------------------- admin vendors */

router.get("/admins/vendors", requireAdmin, async (_req, res) => {
  try {
    const vendors = await query(
      `
        SELECT id, username, email, phone, created_at, activated_at
        FROM vendors
        ORDER BY created_at DESC
      `
    );

    const links = await query(
      `
        SELECT vb.vendor_id, b.id, b.name, b.is_active
        FROM vendor_businesses vb
        INNER JOIN businesses b ON b.id = vb.business_id
        ORDER BY b.name ASC
      `
    );

    const byVendor = new Map();
    for (const link of links.rows) {
      if (!byVendor.has(link.vendor_id)) byVendor.set(link.vendor_id, []);
      byVendor.get(link.vendor_id).push({
        id: link.id,
        name: link.name,
        is_active: link.is_active,
      });
    }

    return res.json(
      vendors.rows.map((vendor) => ({
        ...vendor,
        businesses: byVendor.get(vendor.id) || [],
      }))
    );
  } catch (error) {
    console.error("List vendors failed:", error);
    return res.status(500).json({ error: "Could not load vendors." });
  }
});

router.post("/admins/vendors", requireAdmin, async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim().toLowerCase();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const phoneRaw = String(req.body?.phone || "").trim();
    const password = String(req.body?.password || "");
    const businessIds = req.body?.business_ids;

    if (!username || username.length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters." });
    }
    if (email && !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    const phone = phoneRaw ? normalizeWhatsAppPhone(phoneRaw) : null;
    if (phoneRaw && !phone) {
      return res.status(400).json({ error: "Enter a valid WhatsApp phone number." });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const hash = await bcrypt.hash(password, 10);
    const created = await query(
      `
        INSERT INTO vendors (username, email, phone, password_hash, activated_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id, username, email, phone, created_at, activated_at
      `,
      [username, email || null, phone, hash]
    );

    await replaceVendorBusinesses(created.rows[0].id, businessIds);
    return res.status(201).json(await vendorWithBusinesses(created.rows[0].id));
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message });
    if (error.code === "23505") {
      return res.status(409).json({ error: "That username or email is already in use." });
    }
    console.error("Create vendor failed:", error);
    return res.status(500).json({ error: "Could not create vendor." });
  }
});

router.put("/admins/vendors/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid vendor." });
    }

    const existing = await query("SELECT id FROM vendors WHERE id = $1", [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: "Vendor not found." });

    const email =
      typeof req.body?.email !== "undefined"
        ? String(req.body.email || "").trim().toLowerCase()
        : undefined;
    const phoneRaw =
      typeof req.body?.phone !== "undefined" ? String(req.body.phone || "").trim() : undefined;
    const password =
      typeof req.body?.password !== "undefined" ? String(req.body.password || "") : undefined;

    if (email !== undefined && email && !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    let phone;
    if (phoneRaw !== undefined) {
      phone = phoneRaw ? normalizeWhatsAppPhone(phoneRaw) : null;
      if (phoneRaw && !phone) {
        return res.status(400).json({ error: "Enter a valid WhatsApp phone number." });
      }
    }
    if (password !== undefined && password && password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    if (email !== undefined) {
      await query(`UPDATE vendors SET email = $1 WHERE id = $2`, [email || null, id]);
    }
    if (phoneRaw !== undefined) {
      await query(`UPDATE vendors SET phone = $1 WHERE id = $2`, [phone, id]);
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await query(`UPDATE vendors SET password_hash = $1 WHERE id = $2`, [hash, id]);
    }
    if (typeof req.body?.business_ids !== "undefined") {
      await replaceVendorBusinesses(id, req.body.business_ids);
    }

    return res.json(await vendorWithBusinesses(id));
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message });
    if (error.code === "23505") {
      return res.status(409).json({ error: "That email is already in use." });
    }
    console.error("Update vendor failed:", error);
    return res.status(500).json({ error: "Could not update vendor." });
  }
});

export default router;
