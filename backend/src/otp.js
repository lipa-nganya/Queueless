/**
 * Advanta SMS helpers.
 * OTP_MODE=web → store OTP only (shown in admin). SMS send is skipped.
 * OTP_MODE=sms  → also send via Advanta QuickSMS.
 */

const ADVANTA_URL = "https://quicksms.advantasms.com/api/services/sendsms/";

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

export async function deliverOtp({ phone, otp, firstName }) {
  const mode = (process.env.OTP_MODE || "web").toLowerCase();
  const message = `Queueless: Your verification code is ${otp}. It expires in 10 minutes.`;

  if (mode !== "sms") {
    return { mode: "web", sent: false, message: "OTP stored for admin web display." };
  }

  const apikey = process.env.ADVANTA_API_KEY;
  const partnerID = process.env.ADVANTA_PARTNER_ID;
  const shortcode = process.env.ADVANTA_SHORTCODE || "Queueless";

  if (!apikey || !partnerID) {
    throw new Error("Advanta SMS is not configured.");
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
  if (!response.ok) {
    console.error("Advanta SMS failed:", payload);
    throw new Error("Could not send OTP SMS.");
  }

  return { mode: "sms", sent: true, provider: payload, greet: firstName };
}
