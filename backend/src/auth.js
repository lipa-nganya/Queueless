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

/** @deprecated use requireAdmin */
export const requireAuth = requireAdmin;
