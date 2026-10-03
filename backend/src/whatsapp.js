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
import { shortAccessibilityNeedLabels } from "./accessibilityOptions.js";

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

function placeLabel(details) {
  const branch = String(details.branchName || "").trim();
  return branch && branch !== "Main"
    ? `${details.businessName} (${branch})`
    : details.businessName;
}

function accessibilityLabel(details) {
  const needs = Array.isArray(details.accessibilityNeeds) ? details.accessibilityNeeds : [];
  const note = String(details.accessibilityNote || "").trim();
  if (!needs.length && !note) return "";
  const parts = [];
  if (needs.length) parts.push(`Accessibility: ${needs.join(", ")}.`);
  if (note) parts.push(`Note: "${note}"`);
  return ` ${parts.join(" ")}`;
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
  return `Queueless: ${who} joined the queue at ${placeLabel(details)}.${party}${position}${wait}${accessibilityLabel(details)}`;
}

export function buildQueueLeaveMessage(details) {
  const who = customerLabel(details);
  return `Queueless: ${who} left the queue at ${placeLabel(details)}.`;
}

const SMS_SEGMENT_CHARS = 160;

/**
 * SMS is billed per segment: 160 GSM-7 characters, but only 70 once any
 * character outside GSM-7 (curly quote, emoji, most accents) appears. Map
 * customer/business text onto plain GSM-7 so one alert stays one segment.
 */
export function toGsm7(text) {
  return String(text || "")
    .replace(/[\u2018\u2019\u201A\u201B\u2032`\u00B4]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u00B7\u2022]/g, "-")
    .replace(/[[{]/g, "(")
    .replace(/[\]}]/g, ")")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 @$_!"#%&'()*+,\-./:;<=>?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clipSms(text, limit = SMS_SEGMENT_CHARS) {
  return text.length <= limit ? text : `${text.slice(0, limit - 3).trimEnd()}...`;
}

/**
 * Single-segment SMS variant of the join/leave alert; push and WhatsApp keep
 * the full text. When space runs out, the wait estimate goes first, then the
 * note is shortened, so accessibility needs survive.
 */
export function buildQueueSms(action, details) {
  const who = clipSms(toGsm7(customerLabel(details)) || "A customer", 24);
  const place = clipSms(toGsm7(placeLabel(details)), 40);
  const placeEnd = place.endsWith("...") ? "" : ".";
  if (action === "leave") return clipSms(`Queueless: ${who} left the queue at ${place}${placeEnd}`);

  const partySize = Number(details.partySize) || 1;
  const facts = [];
  if (details.position != null) facts.push(`#${details.position} in line`);
  if (partySize > 1) facts.push(`party of ${partySize}`);
  const wait =
    details.estimatedWaitMinutes != null ? `${details.estimatedWaitMinutes} min wait` : null;

  const needs = Array.isArray(details.accessibilityNeedIds)
    ? shortAccessibilityNeedLabels(details.accessibilityNeedIds)
    : (details.accessibilityNeeds || []).map(toGsm7).filter(Boolean);
  const needsText = needs.length ? ` Needs: ${needs.join(", ")}.` : "";
  const note = toGsm7(details.accessibilityNote);

  const head = (withWait) => {
    const list = withWait && wait ? [...facts, wait] : facts;
    return `Queueless: ${who} joined ${place}${placeEnd}${list.length ? ` ${list.join(", ")}.` : ""}${needsText}`;
  };
  const withNote = (text) => (note ? `${text} Note: "${note}"` : text);

  for (const withWait of [true, false]) {
    const full = withNote(head(withWait));
    if (full.length <= SMS_SEGMENT_CHARS) return full;
  }
  const base = head(false);
  const room = SMS_SEGMENT_CHARS - base.length - ' Note: ""'.length;
  return clipSms(note && room >= 12 ? `${base} Note: "${clipSms(note, room)}"` : base);
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

  const enabled = await getBoolSetting(WHATSAPP_ENABLED, false);
  const channel = await getQueueAlertChannel();
  const message =
    channel === "sms"
      ? buildQueueSms(action, details)
      : action === "leave"
        ? buildQueueLeaveMessage(details)
        : buildQueueJoinMessage(details);
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
