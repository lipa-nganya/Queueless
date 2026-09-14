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
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS operating_hours TEXT;
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS image_url TEXT;
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS queue_size INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS avg_wait_minutes INTEGER NOT NULL DEFAULT 15;

    -- Soft on/off for the customer site. Existing rows stay visible; new ones
    -- start inactive so an admin must activate them before customers see them.
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
    UPDATE businesses SET is_active = true WHERE is_active IS NULL;
    ALTER TABLE businesses ALTER COLUMN is_active SET DEFAULT false;
    ALTER TABLE businesses ALTER COLUMN is_active SET NOT NULL;

    -- Coordinates for customer "X minutes away". Filled when an admin picks
    -- a Kenya place from Photon autocomplete.
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

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

    -- One ticket per customer account; party_size covers companions in the same place.
    ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS party_size INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS party_names JSONB NOT NULL DEFAULT '[]'::jsonb;

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

    CREATE TABLE IF NOT EXISTS vendors (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS vendors_email_unique
      ON vendors (lower(email))
      WHERE email IS NOT NULL;

    CREATE TABLE IF NOT EXISTS vendor_businesses (
      vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
      business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      PRIMARY KEY (vendor_id, business_id)
    );

    CREATE INDEX IF NOT EXISTS vendor_businesses_business_id
      ON vendor_businesses (business_id);

    ALTER TABLE vendors ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE admins ADD COLUMN IF NOT EXISTS phone TEXT;

    ALTER TABLE vendors ADD COLUMN IF NOT EXISTS pin_hash TEXT;
    ALTER TABLE vendors ADD COLUMN IF NOT EXISTS otp_code TEXT;
    ALTER TABLE vendors ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ;
    ALTER TABLE vendors ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
    ALTER TABLE vendors ADD COLUMN IF NOT EXISTS otp_resend_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE vendors ADD COLUMN IF NOT EXISTS otp_last_sent_at TIMESTAMPTZ;
    ALTER TABLE vendors ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
    ALTER TABLE vendors ALTER COLUMN password_hash DROP NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS vendors_phone_unique
      ON vendors (phone)
      WHERE phone IS NOT NULL;

    -- Branches are physical sites under a brand business. Existing businesses
    -- are backfilled as a single "Main" branch below.
    CREATE TABLE IF NOT EXISTS business_branches (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      location TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      phone TEXT,
      operating_hours TEXT,
      queue_size INTEGER NOT NULL DEFAULT 0,
      avg_wait_minutes INTEGER NOT NULL DEFAULT 15,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (business_id, name)
    );

    CREATE INDEX IF NOT EXISTS business_branches_business_id
      ON business_branches (business_id);

    ALTER TABLE business_branches
      ADD COLUMN IF NOT EXISTS accessibility_options TEXT;

    INSERT INTO business_branches (
      business_id, name, location, latitude, longitude, phone, operating_hours,
      queue_size, avg_wait_minutes, is_active
    )
    SELECT
      b.id,
      'Main',
      b.location,
      b.latitude,
      b.longitude,
      b.phone,
      b.operating_hours,
      COALESCE(b.queue_size, 0),
      COALESCE(b.avg_wait_minutes, 15),
      COALESCE(b.is_active, true)
    FROM businesses b
    WHERE NOT EXISTS (
      SELECT 1 FROM business_branches bb WHERE bb.business_id = b.id
    );

    ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS branch_id INTEGER
      REFERENCES business_branches(id) ON DELETE CASCADE;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS branch_id INTEGER
      REFERENCES business_branches(id) ON DELETE CASCADE;

    UPDATE queue_entries qe
    SET branch_id = bb.id
    FROM business_branches bb
    WHERE bb.business_id = qe.business_id
      AND qe.branch_id IS NULL
      AND bb.id = (
        SELECT MIN(bb2.id) FROM business_branches bb2 WHERE bb2.business_id = qe.business_id
      );

    UPDATE bookings bk
    SET branch_id = bb.id
    FROM business_branches bb
    WHERE bb.business_id = bk.business_id
      AND bk.branch_id IS NULL
      AND bb.id = (
        SELECT MIN(bb2.id) FROM business_branches bb2 WHERE bb2.business_id = bk.business_id
      );

    DROP INDEX IF EXISTS queue_entries_one_active;
    CREATE UNIQUE INDEX IF NOT EXISTS queue_entries_one_active_per_branch
      ON queue_entries (branch_id, customer_id)
      WHERE status = 'waiting' AND branch_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS queue_entries_branch_waiting
      ON queue_entries (branch_id, joined_at)
      WHERE status = 'waiting';

    -- Catalog of services offered by a business (shared across its branches).
    -- duration_minutes is the service period used for wait estimates.
    CREATE TABLE IF NOT EXISTS business_services (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 15,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (business_id, name)
    );

    CREATE INDEX IF NOT EXISTS business_services_business_id
      ON business_services (business_id);
  `);
}

export async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const email = (process.env.ADMIN_EMAIL || "admin@queueless.co.ke").toLowerCase();
  const phone = process.env.ADMIN_WHATSAPP
    ? String(process.env.ADMIN_WHATSAPP).replace(/\D/g, "") || null
    : null;
  const hash = await bcrypt.hash(password, 10);

  await query(
    `
      INSERT INTO admins (username, email, password_hash, activated_at, phone)
      VALUES ($1, $2, $3, NOW(), $4)
      ON CONFLICT (username)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        email = COALESCE(admins.email, EXCLUDED.email),
        phone = COALESCE(EXCLUDED.phone, admins.phone),
        activated_at = COALESCE(admins.activated_at, NOW())
    `,
    [username, email, hash, phone]
  );
}

/** Canonical customer-facing groups from the brand icon sheet. */
const CANONICAL_GROUPS = [
  { name: "Beauty & Wellness", icon: "beauty" },
  { name: "Healthcare", icon: "healthcare" },
  { name: "Financial Services", icon: "financial" },
  { name: "Automotive", icon: "automotive" },
  { name: "Hospitality", icon: "hospitality" },
  { name: "Government & Public Services", icon: "government" },
  { name: "Education Services", icon: "education" },
  { name: "Retail & Telecom", icon: "retail" },
  { name: "Professional Services", icon: "professional" },
  { name: "Travel & Transport", icon: "travel" },
  { name: "Entertainment & Recreation", icon: "entertainment" },
];

export async function seedBusinessGroups() {
  for (const group of CANONICAL_GROUPS) {
    await query(
      `
        INSERT INTO business_groups (name, icon)
        VALUES ($1, $2)
        ON CONFLICT (name)
        DO UPDATE SET icon = EXCLUDED.icon
      `,
      [group.name, group.icon]
    );
  }

  await query(`UPDATE business_groups SET icon = 'beauty' WHERE icon IN ('scissors', 'salon')`);
  await query(`UPDATE business_groups SET icon = 'healthcare' WHERE icon IN ('clinic', 'pharmacy')`);
  await query(`UPDATE business_groups SET icon = 'financial' WHERE icon = 'bank'`);
  await query(`UPDATE business_groups SET icon = 'automotive' WHERE icon = 'car'`);
  await query(`UPDATE business_groups SET icon = 'hospitality' WHERE icon = 'restaurant'`);
  await query(`UPDATE business_groups SET icon = 'retail' WHERE icon IN ('shop', 'phone')`);
  await query(`UPDATE business_groups SET icon = 'entertainment' WHERE icon = 'fitness'`);
}
export async function seedVendor() {
  const username = process.env.VENDOR_USERNAME || "vendor";
  const password = process.env.VENDOR_PASSWORD || "vendor123";
  const pin = String(process.env.VENDOR_PIN || "1234").trim();
  const email = (process.env.VENDOR_EMAIL || "vendor@queueless.co.ke").toLowerCase();
  const phoneRaw = process.env.VENDOR_WHATSAPP || process.env.WHATSAPP_NOTIFY_PHONES || "254700000001";
  const phone = String(phoneRaw).split(",")[0].replace(/\D/g, "") || "254700000001";
  const passwordHash = await bcrypt.hash(password, 10);
  const pinHash = /^\d{4}$/.test(pin) ? await bcrypt.hash(pin, 10) : null;

  const vendor = await query(
    `
      INSERT INTO vendors (
        username, email, phone, password_hash, pin_hash, phone_verified_at, activated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (username)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        email = COALESCE(vendors.email, EXCLUDED.email),
        phone = COALESCE(EXCLUDED.phone, vendors.phone),
        pin_hash = COALESCE(vendors.pin_hash, EXCLUDED.pin_hash),
        phone_verified_at = COALESCE(vendors.phone_verified_at, EXCLUDED.phone_verified_at),
        activated_at = COALESCE(vendors.activated_at, NOW())
      RETURNING id
    `,
    [username, email, phone, passwordHash, pinHash]
  );

  const vendorId = vendor.rows[0]?.id;
  if (!vendorId) return;

  const linked = await query(
    "SELECT 1 FROM vendor_businesses WHERE vendor_id = $1 LIMIT 1",
    [vendorId]
  );
  if (linked.rows[0]) return;

  const business = await query("SELECT id FROM businesses ORDER BY id ASC LIMIT 1");
  if (!business.rows[0]) return;

  await query(
    `
      INSERT INTO vendor_businesses (vendor_id, business_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `,
    [vendorId, business.rows[0].id]
  );
}
