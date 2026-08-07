import bcrypt from "bcryptjs";
import { query } from "./db.js";

export async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS business_groups (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      business_group_id INTEGER NOT NULL REFERENCES business_groups(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (name, business_group_id)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      email TEXT,
      full_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_name TEXT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS pin_hash TEXT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS otp_code TEXT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

    CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique
      ON customers (phone)
      WHERE phone IS NOT NULL;

    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS location TEXT;
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS image_url TEXT;
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS queue_size INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS avg_wait_minutes INTEGER NOT NULL DEFAULT 15;

    ALTER TABLE admins ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE admins ADD COLUMN IF NOT EXISTS invite_token_hash TEXT;
    ALTER TABLE admins ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;
    ALTER TABLE admins ADD COLUMN IF NOT EXISTS invited_by INTEGER REFERENCES admins(id);
    ALTER TABLE admins ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
    ALTER TABLE admins ALTER COLUMN password_hash DROP NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS admins_email_unique
      ON admins (lower(email))
      WHERE email IS NOT NULL;
  `);
}

export async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const email = (process.env.ADMIN_EMAIL || "admin@queueless.co.ke").toLowerCase();
  const hash = await bcrypt.hash(password, 10);

  await query(
    `
      INSERT INTO admins (username, email, password_hash, activated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (username)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        email = COALESCE(admins.email, EXCLUDED.email),
        activated_at = COALESCE(admins.activated_at, NOW())
    `,
    [username, email, hash]
  );
}
