/**
 * WhatsApp Cloud API (Meta) helpers for queue join/leave alerts.
 *
 * Local-first: if queue alerts are disabled or the selected channel is not
 * configured, we log the intended message so queue actions still succeed.
 */
import {
  getBoolSetting,
  getQueueAlertChannel,
  WHATSAPP_ENABLED,
  whatsappProviderConfigured,
  smsProviderConfigured,
} from "./settings.js";
import { normalizeKenyaPhone, sendSms } from "./otp.js";

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v22.0";

/** Digits-only international number for Graph API `to` fields. */
export function normalizeWhatsAppPhone(input) {
  const kenya = normalizeKenyaPhone(input);
  if (kenya) return kenya;
  const digits = String(input || "").replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

export function whatsappConfigured() {
  return whatsappProviderConfigured();
}

function graphUrl(path) {
  return `https://graph.facebook.com/${API_VERSION}/${path}`;
}

async function graphPost(path, body) {
  const token = process.env.WHATSAPP_TOKEN;
  const response = await fetch(graphUrl(path), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      payload?.error?.message ||
      payload?.error?.error_user_msg ||
      `HTTP ${response.status}`;
    const err = new Error(detail);
    err.code = payload?.error?.code;
    err.payload = payload;
    throw err;
  }
  return payload;
}

/**
 * Send a free-form text message. Works inside the 24h customer-care window
 * after a template (or inbound user message), and to Meta allowlisted test numbers.
 */
export async function sendWhatsAppText({ phone, message }) {
  const to = normalizeWhatsAppPhone(phone);
  if (!to) throw new Error("Invalid WhatsApp phone number.");
  if (!whatsappConfigured()) {
    throw new Error("WhatsApp is not configured. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID.");
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return graphPost(`${phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { preview_url: false, body: message },
  });
}

/**
 * Send an approved template (needed for reliable business-initiated alerts).
 * Supports positional {{1}} params or named {{customer_name}} params.
 */
export async function sendWhatsAppTemplate({
  phone,
  templateName,
  languageCode = "en_US",
  bodyParams = [],
}) {
  const to = normalizeWhatsAppPhone(phone);
  if (!to) throw new Error("Invalid WhatsApp phone number.");
  if (!whatsappConfigured()) {
    throw new Error("WhatsApp is not configured. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID.");
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const parameters = bodyParams
    .map((entry) => {
      if (entry == null) return null;
      if (typeof entry === "object") {
        const text = String(entry.text ?? "");
        if (!text) return null;
        return entry.name
          ? { type: "text", parameter_name: entry.name, text }
          : { type: "text", text };
      }
      const text = String(entry);
      return text ? { type: "text", text } : null;
    })
    .filter(Boolean);

  const components = parameters.length
    ? [{ type: "body", parameters }]
    : undefined;

  return graphPost(`${phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {}),
    },
  });
}

function customerLabel(details) {
  return details.customerName || details.customerPhone || "A customer";
}

export function buildQueueJoinMessage(details) {
  const who = customerLabel(details);
  const wait =
    details.estimatedWaitMinutes == null
      ? ""
      : ` Est. wait: ${details.estimatedWaitMinutes} min.`;
  const position =
    details.position == null ? "" : ` Position #${details.position}.`;
  const partySize = Number(details.partySize) || 1;
  const party = partySize > 1 ? ` Party of ${partySize}.` : "";
  return `Queueless: ${who} joined the queue at ${details.businessName}.${party}${position}${wait}`;
}

export function buildQueueLeaveMessage(details) {
  const who = customerLabel(details);
  return `Queueless: ${who} left the queue at ${details.businessName}.`;
}

/**
 * Notify staff phones about a queue join/leave. Never throws — the queue
 * action must succeed even if WhatsApp/SMS fails.
 *
 * Channel is chosen in Admin → Settings (WhatsApp vs SMS / Advanta).
 */
export async function notifyQueueEvent(action, recipients, details) {
  const unique = [
    ...new Set(
      (recipients || [])
        .map((phone) => normalizeWhatsAppPhone(phone))
        .filter(Boolean)
    ),
  ];

  const message =
    action === "leave" ? buildQueueLeaveMessage(details) : buildQueueJoinMessage(details);
  const enabled = await getBoolSetting(WHATSAPP_ENABLED, false);
  const channel = await getQueueAlertChannel();
  const configured =
    channel === "sms" ? smsProviderConfigured() : whatsappConfigured();

  if (!enabled || !configured) {
    if (process.env.LOG_VERBOSE === "1") {
      console.log(
        `[queue-alert:${channel}:web] would notify ${unique.join(", ") || "(no recipients)"}: ${message}`
      );
    }
    return { mode: "web", channel, recipients: unique, message };
  }

  if (!unique.length) {
    if (process.env.LOG_VERBOSE === "1") {
      console.log(`[queue-alert:${channel}] no recipients for: ${message}`);
    }
    return { mode: "skip", channel, recipients: [], message };
  }

  if (channel === "sms") {
    const results = [];
    for (const phone of unique) {
      try {
        const payload = await sendSms({ phone, message });
        results.push({
          phone,
          ok: true,
          id: payload?.responses?.[0]?.messageid || null,
        });
        if (process.env.LOG_VERBOSE === "1") {
          console.log(`[sms] ${action} alert sent to ${phone}`);
        }
      } catch (error) {
        console.error(`[sms] ${action} alert to ${phone} failed:`, error.message);
        results.push({ phone, ok: false, error: error.message });
      }
    }
    return { mode: "live", channel, recipients: unique, message, results };
  }

  const joinTemplate = (process.env.WHATSAPP_TEMPLATE_NAME || "").trim();
  const leaveTemplate = (
    process.env.WHATSAPP_TEMPLATE_LEAVE_NAME ||
    process.env.WHATSAPP_TEMPLATE_NAME ||
    ""
  ).trim();
  const templateName = action === "leave" ? leaveTemplate : joinTemplate;
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANG || "en_US";
  const results = [];

  for (const phone of unique) {
    try {
      let payload;
      if (templateName && templateName !== "hello_world") {
        // Templates use positional vars {{1}}, {{2}}, … (Meta editor requirement).
        payload = await sendWhatsAppTemplate({
          phone,
          templateName,
          languageCode,
          bodyParams:
            action === "leave"
              ? [customerLabel(details), details.businessName]
              : [
                  customerLabel(details),
                  details.businessName,
                  String(details.position ?? ""),
                  String(details.estimatedWaitMinutes ?? ""),
                ],
        });
      } else {
        payload = await sendWhatsAppText({ phone, message });
      }
      results.push({ phone, ok: true, id: payload?.messages?.[0]?.id || null });
      if (process.env.LOG_VERBOSE === "1") {
        console.log(`[whatsapp] ${action} alert sent to ${phone}`);
      }
    } catch (error) {
      console.error(`[whatsapp] ${action} alert to ${phone} failed:`, error.message);
      results.push({ phone, ok: false, error: error.message, code: error.code });
    }
  }

  return { mode: "live", channel, recipients: unique, message, results };
}

/** @deprecated use notifyQueueEvent("join", ...) */
export async function notifyQueueJoin(recipients, details) {
  return notifyQueueEvent("join", recipients, details);
}
