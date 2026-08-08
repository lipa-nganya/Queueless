/**
 * Advanta SMS helpers.
 *
 * Delivery is controlled by the "Send real SMS" toggle on the admin Settings
 * page. Off → the OTP is only stored for admin web display. On → it is also
 * sent through Advanta QuickSMS. OTP_MODE seeds the toggle's initial value the
 * first time the app boots and is not consulted after that.
 */
import { getBoolSetting, SMS_ENABLED, smsProviderConfigured } from "./settings.js";

const ADVANTA_BASE = "https://quicksms.advantasms.com/api/services";
const ADVANTA_URL = `${ADVANTA_BASE}/sendsms/`;
const ADVANTA_DLR_URL = `${ADVANTA_BASE}/getdlr/`;

export function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function otpExpiryDate(minutes = 10) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export function normalizeKenyaPhone(input, countryCode) {
  const codeDigits = String(countryCode || "").replace(/\D/g, "");
  let digits = String(input || "").replace(/\D/g, "");
  if (!digits && !codeDigits) return null;

  // If country code provided separately, prepend it to the local number.
  if (codeDigits) {
    if (digits.startsWith("0")) digits = digits.slice(1);
    if (!digits.startsWith(codeDigits)) {
      digits = `${codeDigits}${digits}`;
    }
  }

  if (digits.startsWith("254") && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith("255") && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith("256") && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }
  if (digits.length === 9 && digits.startsWith("7")) {
    return `254${digits}`;
  }
  // Accept already-combined numbers of reasonable length
  if (digits.length >= 11 && digits.length <= 15) {
    return digits;
  }
  return null;
}

/**
 * Advanta replies 200 even for per-recipient failures, so the real outcome is
 * in the response body rather than the HTTP status.
 */
function advantaAccepted(payload) {
  const entries = payload?.responses;
  if (!Array.isArray(entries) || entries.length === 0) return false;
  return entries.every((entry) => {
    const code = Number(entry["response-code"] ?? entry.responseCode);
    return code === 200;
  });
}

export async function sendSms({ phone, message }) {
  const apikey = process.env.ADVANTA_API_KEY;
  const partnerID = process.env.ADVANTA_PARTNER_ID;
  const shortcode = process.env.ADVANTA_SHORTCODE;

  if (!apikey || !partnerID || !shortcode) {
    throw new Error(
      "Advanta SMS is not configured. Set ADVANTA_API_KEY, ADVANTA_PARTNER_ID and ADVANTA_SHORTCODE."
    );
  }

  const response = await fetch(ADVANTA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey,
      partnerID: String(partnerID),
      message,
      shortcode,
      mobile: phone,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !advantaAccepted(payload)) {
    console.error("Advanta SMS failed:", JSON.stringify(payload));
    const detail = payload?.responses?.[0]?.["response-description"];
    throw new Error(detail ? `Advanta rejected the message: ${detail}` : "Could not send SMS.");
  }

  return payload;
}

/**
 * Advanta accepting a message only means it is queued. A message can sit in
 * "Scheduled" indefinitely — typically when the sender ID is not yet approved
 * on the recipient's network — so acceptance alone must not be read as
 * delivery.
 */
export async function smsDeliveryStatus(messageId) {
  const response = await fetch(ADVANTA_DLR_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: process.env.ADVANTA_API_KEY,
      partnerID: process.env.ADVANTA_PARTNER_ID,
      messageID: String(messageId),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  return {
    status: payload?.["delivery-status"] ?? null,
    description: payload?.["delivery-description"] || "Unknown",
    deliveredAt: payload?.["delivery-time"] || null,
  };
}

export async function deliverOtp({ phone, otp, firstName }) {
  const message = `Queueless: Your verification code is ${otp}. It expires in 10 minutes.`;
  const smsEnabled = await getBoolSetting(SMS_ENABLED, false);

  if (!smsEnabled) {
    return { mode: "web", sent: false, message: "OTP stored for admin web display." };
  }

  if (!smsProviderConfigured()) {
    console.error("Send real SMS is on but Advanta credentials are missing.");
    return {
      mode: "web",
      sent: false,
      message: "SMS is enabled but not configured; OTP stored for admin web display.",
    };
  }

  const provider = await sendSms({ phone, message });
  return { mode: "sms", sent: true, provider, greet: firstName };
}
