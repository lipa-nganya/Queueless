import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { query } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "queueless_local_jwt_secret_change_me";

export async function login(identifier, password) {
  const loginId = String(identifier || "").trim();
  if (!loginId || !password) {
    return null;
  }

  const result = await query(
    `
      SELECT id, username, email, password_hash, activated_at
      FROM admins
      WHERE username = $1 OR lower(email) = lower($1)
      LIMIT 1
    `,
    [loginId]
  );

  const admin = result.rows[0];
  if (!admin?.password_hash || !admin.activated_at) {
    return null;
  }

  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) {
    return null;
  }

  const token = jwt.sign(
    {
      sub: admin.id,
      username: admin.username,
      email: admin.email,
      role: "admin",
    },
    JWT_SECRET,
    { expiresIn: "12h" }
  );

  return {
    token,
    username: admin.username,
    email: admin.email,
  };
}

export function signCustomerToken(customer) {
  return jwt.sign(
    {
      sub: customer.id,
      phone: customer.phone,
      first_name: customer.first_name,
      role: "customer",
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

export function signVendorToken(vendor) {
  return jwt.sign(
    {
      sub: vendor.id,
      username: vendor.username,
      email: vendor.email,
      phone: vendor.phone,
      role: "vendor",
    },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
}

/** Short-lived token that only lets a pending vendor describe their business. */
export function signVendorOnboardingToken(vendor) {
  return jwt.sign(
    { sub: vendor.id, phone: vendor.phone, role: "vendor_onboarding" },
    JWT_SECRET,
    { expiresIn: "2h" }
  );
}

export async function vendorLoginWithPin(phone, pin) {
  const phoneDigits = String(phone || "").trim();
  const pinValue = String(pin || "");
  if (!phoneDigits || !/^\d{4}$/.test(pinValue)) return null;

  const result = await query(
    `
      SELECT id, username, email, phone, pin_hash, activated_at
      FROM vendors
      WHERE phone = $1
      LIMIT 1
    `,
    [phoneDigits]
  );

  const vendor = result.rows[0];
  if (!vendor?.pin_hash || !vendor.activated_at) return null;

  const ok = await bcrypt.compare(pinValue, vendor.pin_hash);
  if (!ok) return null;

  return {
    token: signVendorToken(vendor),
    username: vendor.username,
    email: vendor.email,
    phone: vendor.phone,
  };
}

/** @deprecated password login — prefer vendorLoginWithPin */
export async function vendorLogin(identifier, password) {
  const loginId = String(identifier || "").trim();
  if (!loginId || !password) return null;

  const result = await query(
    `
      SELECT id, username, email, phone, password_hash, activated_at
      FROM vendors
      WHERE username = $1 OR lower(email) = lower($1)
      LIMIT 1
    `,
    [loginId]
  );

  const vendor = result.rows[0];
  if (!vendor?.password_hash || !vendor.activated_at) return null;

  const ok = await bcrypt.compare(password, vendor.password_hash);
  if (!ok) return null;

  return {
    token: signVendorToken(vendor),
    username: vendor.username,
    email: vendor.email,
    phone: vendor.phone,
  };
}

function readToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return jwt.verify(token, JWT_SECRET);
}

export function requireAdmin(req, res, next) {
  try {
    const payload = readToken(req);
    if (!payload || payload.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.admin = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export function requireCustomer(req, res, next) {
  try {
    const payload = readToken(req);
    if (!payload || payload.role !== "customer") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.customer = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

/** Lets guests through; a valid customer token still sets req.customer. */
export function optionalCustomer(req, _res, next) {
  try {
    const payload = readToken(req);
    if (payload?.role === "customer") req.customer = payload;
  } catch {
    // An expired or foreign token browses as a guest.
  }
  return next();
}

// Every vendor request checks deactivation; the queue screen polls, so remember
// the answer briefly. Admin (de)activation clears the entry at once, so the
// 30s window only matters if the API ever runs as more than one instance.
const VENDOR_STATUS_TTL_MS = 30000;
const vendorStatusCache = new Map();

export function invalidateVendorStatus(vendorId) {
  vendorStatusCache.delete(Number(vendorId));
}

async function vendorIsDeactivated(vendorId) {
  const id = Number(vendorId);
  const hit = vendorStatusCache.get(id);
  if (hit && Date.now() - hit.at < VENDOR_STATUS_TTL_MS) return hit.deactivated;
  const result = await query(`SELECT deactivated_at FROM vendors WHERE id = $1`, [id]);
  // A deleted account has no row; its leftover tokens must stop working too.
  const deactivated = !result.rows[0] || Boolean(result.rows[0].deactivated_at);
  vendorStatusCache.set(id, { at: Date.now(), deactivated });
  if (vendorStatusCache.size > 5000) {
    vendorStatusCache.delete(vendorStatusCache.keys().next().value);
  }
  return deactivated;
}

export function requireVendor(req, res, next) {
  try {
    const payload = readToken(req);
    if (!payload || payload.role !== "vendor") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.vendor = payload;
    vendorIsDeactivated(payload.sub)
      .then((deactivated) => {
        if (deactivated) {
          return res.status(403).json({
            error: "This account has been deactivated. Contact Queueless.",
          });
        }
        return next();
      })
      .catch(() => res.status(500).json({ error: "Could not check this account." }));
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

/** Admin or vendor — used for shared tools like Kenya place search. */
export function requireVendorOnboarding(req, res, next) {
  try {
    const payload = readToken(req);
    if (!payload || payload.role !== "vendor_onboarding") {
      return res.status(401).json({ error: "Your setup link expired. Log in again to continue." });
    }
    req.onboardingVendor = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Your setup link expired. Log in again to continue." });
  }
}

export function requireAdminOrVendor(req, res, next) {
  try {
    const payload = readToken(req);
    // Vendors still in onboarding need place search to pin their first branch.
    if (!payload || !["admin", "vendor", "vendor_onboarding"].includes(payload.role)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (payload.role === "admin") req.admin = payload;
    if (payload.role === "vendor") req.vendor = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

/** @deprecated use requireAdmin */
export const requireAuth = requireAdmin;
