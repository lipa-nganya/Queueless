/**
 * Runtime settings an admin can change from the Settings page, stored in the
 * `settings` table so they survive a redeploy.
 *
 * Values are cached in memory because they are read on hot paths (every OTP
 * send) and change rarely. A single process owns its cache, so a write through
 * `setSetting` refreshes it immediately.
 */
import { query } from "./db.js";

export const SMS_ENABLED = "sms_enabled";

const cache = new Map();
let loaded = false;

function parseBool(value) {
  return String(value).toLowerCase() === "true";
}

export async function loadSettings() {
  const result = await query("SELECT key, value FROM settings");
  cache.clear();
  for (const row of result.rows) cache.set(row.key, row.value);
  loaded = true;
  return cache;
}

async function ensureLoaded() {
  if (!loaded) await loadSettings();
}

export async function getSetting(key, fallback = null) {
  await ensureLoaded();
  return cache.has(key) ? cache.get(key) : fallback;
}

export async function getBoolSetting(key, fallback = false) {
  const value = await getSetting(key, null);
  return value === null ? fallback : parseBool(value);
}

export async function setSetting(key, value, adminId = null) {
  const stored = typeof value === "boolean" ? String(value) : String(value ?? "");
  await query(
    `
      INSERT INTO settings (key, value, updated_at, updated_by)
      VALUES ($1, $2, NOW(), $3)
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by
    `,
    [key, stored, adminId]
  );
  cache.set(key, stored);
  return stored;
}

/**
 * Seeds defaults on boot. OTP_MODE used to be the only switch, so it decides
 * the starting value the first time this runs and is ignored afterwards.
 */
export async function seedSettings() {
  const smsFromEnv = (process.env.OTP_MODE || "web").toLowerCase() === "sms";
  await query(
    `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
    [SMS_ENABLED, String(smsFromEnv)]
  );
  await loadSettings();
}

/**
 * True when Advanta has enough configuration to actually deliver a message.
 * The sender ID counts: Advanta rejects any send from one its account has not
 * had approved, so a missing value is as broken as a missing key.
 */
export function smsProviderConfigured() {
  return Boolean(
    process.env.ADVANTA_API_KEY &&
      process.env.ADVANTA_PARTNER_ID &&
      process.env.ADVANTA_SHORTCODE
  );
}
