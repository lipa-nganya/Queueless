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

    -- Throttling for OTP resends on unverified accounts.
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS otp_resend_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS otp_last_sent_at TIMESTAMPTZ;

    ALTER TABLE business_groups ADD COLUMN IF NOT EXISTS icon TEXT;

    -- Runtime configuration an admin can change without a redeploy.
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by INTEGER REFERENCES admins(id)
    );


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

    -- A booking is a queue slot reserved for a future time.
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      scheduled_for TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'booked',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Live queue. Position is derived from joined_at rather than stored, so
    -- entries never need renumbering when someone leaves.
    CREATE TABLE IF NOT EXISTS queue_entries (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      left_at TIMESTAMPTZ
    );

    -- A customer can hold only one live place per business.
    CREATE UNIQUE INDEX IF NOT EXISTS queue_entries_one_active
      ON queue_entries (business_id, customer_id)
      WHERE status = 'waiting';

    CREATE INDEX IF NOT EXISTS queue_entries_business_waiting
      ON queue_entries (business_id, joined_at)
      WHERE status = 'waiting';

    CREATE INDEX IF NOT EXISTS bookings_customer_upcoming
      ON bookings (customer_id, scheduled_for)
      WHERE status = 'booked';
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
