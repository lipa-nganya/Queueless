/**
 * Firebase Cloud Messaging (FCM) for vendor device push.
 *
 * Configure with either:
 *   FIREBASE_SERVICE_ACCOUNT_JSON  — full service-account JSON string
 *   FIREBASE_SERVICE_ACCOUNT_PATH  — path to the JSON file
 *   FIREBASE_PROJECT_ID            — optional override (else taken from JSON)
 *
 * OTP verification stays on SMS. Vendor lifecycle + queue alerts prefer push.
 */
import { readFileSync } from "node:fs";
import { query } from "./db.js";

let messaging = null;
let initAttempted = false;
let initError = null;

function loadServiceAccount() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (raw) {
    return JSON.parse(raw);
  }
  const filePath = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "").trim();
  if (filePath) {
    return JSON.parse(readFileSync(filePath, "utf8"));
  }
  return null;
}

export function pushConfigured() {
  try {
    return Boolean(loadServiceAccount());
  } catch {
    return false;
  }
}

/**
 * Public Firebase web client config for vendor browser push (FCM).
 * These values are safe to expose (same as a Firebase web app snippet).
 *
 * Env (preferred):
 *   FIREBASE_WEB_CONFIG_JSON — full JSON: { apiKey, authDomain, projectId,
 *     messagingSenderId, appId, vapidKey, storageBucket? }
 * Or individual:
 *   FIREBASE_WEB_API_KEY, FIREBASE_WEB_AUTH_DOMAIN, FIREBASE_WEB_PROJECT_ID,
 *   FIREBASE_WEB_MESSAGING_SENDER_ID, FIREBASE_WEB_APP_ID, FIREBASE_WEB_VAPID_KEY
 */
export function getFirebaseWebClientConfig() {
  const raw = String(process.env.FIREBASE_WEB_CONFIG_JSON || "").trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.apiKey && parsed?.projectId && parsed?.appId && parsed?.vapidKey) {
        return {
          apiKey: String(parsed.apiKey),
          authDomain: String(parsed.authDomain || `${parsed.projectId}.firebaseapp.com`),
          projectId: String(parsed.projectId),
          storageBucket: parsed.storageBucket
            ? String(parsed.storageBucket)
            : `${parsed.projectId}.appspot.com`,
          messagingSenderId: String(parsed.messagingSenderId || ""),
          appId: String(parsed.appId),
          vapidKey: String(parsed.vapidKey),
        };
      }
    } catch {
      /* fall through */
    }
  }

  const apiKey = String(process.env.FIREBASE_WEB_API_KEY || "").trim();
  const projectId = String(
    process.env.FIREBASE_WEB_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || ""
  ).trim();
  const appId = String(process.env.FIREBASE_WEB_APP_ID || "").trim();
  const vapidKey = String(process.env.FIREBASE_WEB_VAPID_KEY || "").trim();
  const messagingSenderId = String(process.env.FIREBASE_WEB_MESSAGING_SENDER_ID || "").trim();
  if (!apiKey || !projectId || !appId || !vapidKey || !messagingSenderId) {
    return null;
  }
  return {
    apiKey,
    authDomain: String(
      process.env.FIREBASE_WEB_AUTH_DOMAIN || `${projectId}.firebaseapp.com`
    ).trim(),
    projectId,
    storageBucket: String(
      process.env.FIREBASE_WEB_STORAGE_BUCKET || `${projectId}.appspot.com`
    ).trim(),
    messagingSenderId,
    appId,
    vapidKey,
  };
}

export function vendorWebPushEnabled() {
  return Boolean(getFirebaseWebClientConfig());
}

async function getMessaging() {
  if (messaging) return messaging;
  if (initAttempted) {
    if (initError) throw initError;
    return null;
  }
  initAttempted = true;
  try {
    const account = loadServiceAccount();
    if (!account) {
      initError = new Error(
        "Firebase is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH."
      );
      throw initError;
    }
    const admin = (await import("firebase-admin")).default;
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(account),
        projectId: process.env.FIREBASE_PROJECT_ID || account.project_id,
      });
    }
    messaging = admin.messaging();
    return messaging;
  } catch (error) {
    initError = error;
    throw error;
  }
}

export async function upsertVendorPushToken({
  vendorId,
  token,
  platform = "android",
  deviceLabel = null,
}) {
  const value = String(token || "").trim();
  if (!vendorId || !value) return null;
  const result = await query(
    `
      INSERT INTO vendor_push_tokens (vendor_id, token, platform, device_label, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (token)
      DO UPDATE SET
        vendor_id = EXCLUDED.vendor_id,
        platform = EXCLUDED.platform,
        device_label = COALESCE(EXCLUDED.device_label, vendor_push_tokens.device_label),
        updated_at = NOW()
      RETURNING id, vendor_id, token, platform, device_label, created_at, updated_at
    `,
    [vendorId, value, String(platform || "android").slice(0, 32), deviceLabel]
  );
  return result.rows[0] || null;
}

export async function deleteVendorPushToken({ vendorId = null, token }) {
  const value = String(token || "").trim();
  if (!value) return 0;
  if (vendorId) {
    const result = await query(
      `DELETE FROM vendor_push_tokens WHERE vendor_id = $1 AND token = $2`,
      [vendorId, value]
    );
    return result.rowCount || 0;
  }
  const result = await query(`DELETE FROM vendor_push_tokens WHERE token = $1`, [value]);
  return result.rowCount || 0;
}

export async function listPushTokensForVendorIds(vendorIds = []) {
  const ids = [...new Set((vendorIds || []).map(Number).filter((id) => id > 0))];
  if (!ids.length) return [];
  const result = await query(
    `
      SELECT id, vendor_id, token, platform
      FROM vendor_push_tokens
      WHERE vendor_id = ANY($1::int[])
      ORDER BY updated_at DESC
    `,
    [ids]
  );
  return result.rows;
}

export async function listPushTokensForVendorPhones(phones = []) {
  const normalized = [
    ...new Set(
      (phones || [])
        .map((phone) => String(phone || "").replace(/\D/g, ""))
        .filter((phone) => phone.length >= 10)
    ),
  ];
  if (!normalized.length) return { tokens: [], vendorIds: [] };
  const result = await query(
    `
      SELECT t.id, t.vendor_id, t.token, t.platform, v.phone
      FROM vendor_push_tokens t
      INNER JOIN vendors v ON v.id = t.vendor_id
      WHERE regexp_replace(COALESCE(v.phone, ''), '\\D', '', 'g') = ANY($1::text[])
      ORDER BY t.updated_at DESC
    `,
    [normalized]
  );
  return {
    tokens: result.rows,
    vendorIds: [...new Set(result.rows.map((row) => row.vendor_id))],
  };
}

async function pruneInvalidToken(token) {
  if (!token) return;
  await query(`DELETE FROM vendor_push_tokens WHERE token = $1`, [token]);
}

/**
 * Send a data+notification push to one or more FCM tokens.
 * Never throws for partial failures — returns per-token results.
 */
export async function sendVendorPush({
  tokens = [],
  title,
  body,
  data = {},
}) {
  const uniqueTokens = [...new Set((tokens || []).map((t) => String(t || "").trim()).filter(Boolean))];
  if (!uniqueTokens.length) {
    return { sent: false, reason: "no_tokens", results: [] };
  }
  if (!pushConfigured()) {
    console.log(
      `[push:web] would notify ${uniqueTokens.length} device(s): ${title} — ${body}`
    );
    return { sent: false, reason: "not_configured", results: [] };
  }

  let client;
  try {
    client = await getMessaging();
  } catch (error) {
    console.error("[push] init failed:", error.message);
    return { sent: false, reason: "init_failed", error: error.message, results: [] };
  }

  const stringData = Object.fromEntries(
    Object.entries({
      title,
      body,
      ...(data || {}),
    }).map(([key, value]) => [key, String(value ?? "")])
  );

  const results = [];
  // FCM multicast supports up to 500 tokens.
  for (let i = 0; i < uniqueTokens.length; i += 500) {
    const chunk = uniqueTokens.slice(i, i + 500);
    try {
      const response = await client.sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        data: stringData,
        android: {
          priority: "high",
          notification: {
            channelId: "queueless_vendor",
            priority: "high",
          },
        },
        webpush: {
          headers: { Urgency: "high" },
          notification: {
            title,
            body,
            icon: "/favicon.svg",
            badge: "/favicon.svg",
          },
          fcmOptions: {
            link: String(data?.link || data?.url || "/"),
          },
        },
      });
      response.responses.forEach((entry, index) => {
        const token = chunk[index];
        if (entry.success) {
          results.push({ token, ok: true, id: entry.messageId || null });
        } else {
          const code = entry.error?.code || "";
          if (
            code.includes("registration-token-not-registered") ||
            code.includes("invalid-registration-token")
          ) {
            void pruneInvalidToken(token);
          }
          results.push({
            token,
            ok: false,
            error: entry.error?.message || "send failed",
            code,
          });
        }
      });
    } catch (error) {
      console.error("[push] multicast failed:", error.message);
      for (const token of chunk) {
        results.push({ token, ok: false, error: error.message });
      }
    }
  }

  const okCount = results.filter((row) => row.ok).length;
  return {
    sent: okCount > 0,
    reason: okCount > 0 ? null : "all_failed",
    results,
  };
}

export async function notifyVendorsPushByPhones({
  phones,
  title,
  body,
  data = {},
}) {
  const { tokens } = await listPushTokensForVendorPhones(phones);
  if (!tokens.length) {
    return { sent: false, reason: "no_tokens", results: [] };
  }
  return sendVendorPush({
    tokens: tokens.map((row) => row.token),
    title,
    body,
    data,
  });
}

export async function notifyVendorsPushByIds({
  vendorIds,
  title,
  body,
  data = {},
}) {
  const tokens = await listPushTokensForVendorIds(vendorIds);
  if (!tokens.length) {
    return { sent: false, reason: "no_tokens", results: [] };
  }
  return sendVendorPush({
    tokens: tokens.map((row) => row.token),
    title,
    body,
    data,
  });
}
