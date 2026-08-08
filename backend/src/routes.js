import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { query } from "./db.js";
import {
  login,
  requireAdmin,
  requireCustomer,
  signCustomerToken,
} from "./auth.js";
import {
  deliverOtp,
  generateOtp,
  normalizeKenyaPhone,
  otpExpiryDate,
} from "./otp.js";
import { sendAdminInviteEmail } from "./mail.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, "../uploads");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_TTL_HOURS = 72;

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

router.get("/dashboard", requireAdmin, async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM customers) AS customers_count,
        (SELECT COUNT(*)::int FROM business_groups) AS business_groups_count,
        (SELECT COUNT(*)::int FROM businesses) AS businesses_count
    `);
    return res.json(result.rows[0]);
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

router.get("/business-groups", requireAdmin, async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        bg.id,
        bg.name,
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

router.post("/business-groups", requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Business group name is required." });
    }

    const result = await query(
      `
        INSERT INTO business_groups (name)
        VALUES ($1)
        RETURNING id, name, created_at
      `,
      [name]
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

router.get("/businesses", requireAdmin, async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        b.id,
        b.name,
        b.description,
        b.location,
        b.phone,
        b.image_url,
        b.created_at,
        b.business_group_id,
        bg.name AS business_group_name
      FROM businesses b
      INNER JOIN business_groups bg ON bg.id = b.business_group_id
      ORDER BY b.created_at DESC
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error("List businesses failed:", error);
    return res.status(500).json({ error: "Could not load businesses." });
  }
});

router.post("/businesses", requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const businessGroupId = Number(req.body?.business_group_id);

    if (!name) {
      return res.status(400).json({ error: "Business name is required." });
    }
    if (!Number.isInteger(businessGroupId) || businessGroupId < 1) {
      return res.status(400).json({ error: "Select a business group." });
    }

    const result = await query(
      `
        INSERT INTO businesses (name, business_group_id)
        VALUES ($1, $2)
        RETURNING id, name, business_group_id, created_at
      `,
      [name, businessGroupId]
    );

    const created = result.rows[0];
    const group = await query(
      "SELECT name FROM business_groups WHERE id = $1",
      [businessGroupId]
    );

    return res.status(201).json({
      ...created,
      business_group_name: group.rows[0]?.name || null,
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

router.get("/businesses/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await query(
      `
        SELECT
          b.id, b.name, b.description, b.location, b.phone, b.image_url,
          b.business_group_id, bg.name AS business_group_name, b.created_at
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
    const queueSize = req.body?.queue_size != null ? Number(req.body.queue_size) : undefined;
    const avgWait = req.body?.avg_wait_minutes != null ? Number(req.body.avg_wait_minutes) : undefined;

    if (!name) return res.status(400).json({ error: "Business name is required." });
    if (!Number.isInteger(businessGroupId) || businessGroupId < 1) {
      return res.status(400).json({ error: "Select a business group." });
    }

    const result = await query(
      `
        UPDATE businesses
        SET name = $1, business_group_id = $2, description = $3, location = $4, phone = $5
          ${queueSize != null ? ", queue_size = " + Math.max(0, Math.round(queueSize)) : ""}
          ${avgWait != null ? ", avg_wait_minutes = " + Math.max(1, Math.round(avgWait)) : ""}
        WHERE id = $6
        RETURNING id, name, business_group_id, description, location, phone, image_url, queue_size, avg_wait_minutes, created_at
      `,
      [name, businessGroupId, description, location, phone, id]
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
      "SELECT id, phone_verified_at FROM customers WHERE phone = $1 LIMIT 1",
      [phone]
    );

    if (existing.rows[0]?.phone_verified_at) {
      return res.status(409).json({ error: "This phone number is already registered. Please log in." });
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
              phone_verified_at = NULL
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

    const delivery = await deliverOtp({
      phone,
      otp,
      firstName,
    });

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
      return res.status(400).json({ error: "OTP has expired. Sign up again to get a new code." });
    }

    const verified = await query(
      `
        UPDATE customers
        SET phone_verified_at = NOW(),
            otp_code = NULL,
            otp_expires_at = NULL
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

    const customer = result.rows[0];
    if (!customer?.pin_hash) {
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

router.get("/customer/business-groups", requireCustomer, async (_req, res) => {
  try {
    const result = await query(`
      SELECT id, name, created_at
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
    let where = "";
    if (Number.isInteger(groupId) && groupId > 0) {
      params.push(groupId);
      where = `WHERE b.business_group_id = $1`;
    }

    const result = await query(
      `
        SELECT
          b.id,
          b.name,
          b.description,
          b.location,
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
    return res.json(result.rows);
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
          b.phone,
          b.image_url,
          b.queue_size,
          b.avg_wait_minutes,
          b.created_at,
          b.business_group_id,
          bg.name AS business_group_name
        FROM businesses b
        INNER JOIN business_groups bg ON bg.id = b.business_group_id
        WHERE b.id = $1
      `,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Business not found." });
    return res.json(result.rows[0]);
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

const BOOKING_WINDOW_HOURS = 24;

// Wraps a queue_entries row with the derived position figures the UI needs.
const QUEUE_ENTRY_SELECT = `
  SELECT
    qe.id,
    qe.business_id,
    qe.joined_at,
    qe.booking_id,
    b.name AS business_name,
    b.image_url,
    b.location,
    b.avg_wait_minutes,
    b.queue_size AS walk_in_baseline,
    bg.name AS business_group_name,
    (
      SELECT COUNT(*)::int
      FROM queue_entries ahead
      WHERE ahead.business_id = qe.business_id
        AND ahead.status = 'waiting'
        AND ahead.joined_at < qe.joined_at
    ) AS app_customers_ahead,
    (
      SELECT COUNT(*)::int
      FROM queue_entries total
      WHERE total.business_id = qe.business_id
        AND total.status = 'waiting'
    ) AS app_queue_length
  FROM queue_entries qe
  INNER JOIN businesses b ON b.id = qe.business_id
  INNER JOIN business_groups bg ON bg.id = b.business_group_id
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

router.post("/customer/businesses/:id/queue", requireCustomer, async (req, res) => {
  try {
    const businessId = Number(req.params.id);
    if (!Number.isInteger(businessId) || businessId < 1) {
      return res.status(400).json({ error: "Invalid business." });
    }

    const business = await query("SELECT id FROM businesses WHERE id = $1", [businessId]);
    if (!business.rows[0]) return res.status(404).json({ error: "Business not found." });

    const existing = await query(
      `
        SELECT id FROM queue_entries
        WHERE business_id = $1 AND customer_id = $2 AND status = 'waiting'
        LIMIT 1
      `,
      [businessId, req.customer.sub]
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
        INSERT INTO queue_entries (business_id, customer_id, booking_id)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [businessId, req.customer.sub, bookingId]
    );

    if (bookingId) {
      await query(
        "UPDATE bookings SET status = 'fulfilled' WHERE id = $1 AND customer_id = $2",
        [bookingId, req.customer.sub]
      );
    }

    const entry = await query(`${QUEUE_ENTRY_SELECT} WHERE qe.id = $1`, [created.rows[0].id]);
    return res.status(201).json(decorateQueueEntry(entry.rows[0]));
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
    const result = await query(
      `
        UPDATE queue_entries
        SET status = 'cancelled', left_at = NOW()
        WHERE id = $1 AND customer_id = $2 AND status = 'waiting'
        RETURNING id
      `,
      [Number(req.params.id), req.customer.sub]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Queue entry not found." });
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

    const business = await query("SELECT id FROM businesses WHERE id = $1", [businessId]);
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

export default router;
