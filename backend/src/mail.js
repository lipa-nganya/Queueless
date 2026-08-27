/**
 * Admin invite email.
 *
 * Resend is preferred because it delivers over HTTPS: hosts such as Railway
 * block outbound SMTP ports, so nodemailer can only reach a mail server from
 * a local machine. SMTP is kept as the fallback for development.
 */
import nodemailer from "nodemailer";

const RESEND_URL = "https://api.resend.com/emails";

function env(name, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}

/** Google displays app passwords in groups of four; spaces are not part of it. */
function smtpPass() {
  return env("email_smtp_pass").replace(/\s+/g, "");
}

function smtpUser() {
  return env("email_smtp_user");
}

function smtpFrom() {
  return env("email_smtp_from") || smtpUser();
}

function resendConfigured() {
  return Boolean(env("RESEND_API_KEY") && mailFrom());
}

function smtpConfigured() {
  return Boolean(env("email_smtp_host") && smtpUser() && smtpPass());
}

/** Resend only accepts senders on a domain verified in the account. */
function mailFrom() {
  return env("MAIL_FROM") || smtpFrom();
}

/**
 * Resend reports per-message problems in the body rather than only the status,
 * so a 200 alone is not proof the message was accepted.
 */
async function sendViaResend({ to, subject, text, html }) {
  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${env("MAIL_FROM_NAME", "Queueless Admin")} <${mailFrom()}>`,
      to: [to],
      subject,
      text,
      html,
    }),
    signal: AbortSignal.timeout(15000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    const detail = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return payload;
}

function createTransporter() {
  const port = Number(env("email_smtp_port", "587")) || 587;
  const secure = env("email_smtp_secure", "false").toLowerCase() === "true";

  return nodemailer.createTransport({
    host: env("email_smtp_host", "smtp.gmail.com"),
    port,
    secure,
    // Hosts that block outbound SMTP drop the packets rather than refusing
    // them, so the default timeouts leave the invite request hanging for two
    // minutes before the caller can fall back to showing the link.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
    auth: {
      user: smtpUser(),
      pass: smtpPass(),
    },
  });
}

/**
 * Send an admin invite email. If SMTP is not configured, returns mode "web"
 * so the caller can surface the invite link in the admin UI.
 */
export async function sendAdminInviteEmail({ to, inviteUrl, invitedBy }) {
  const subject = "You're invited to Queueless Admin";
  const text = [
    "You've been invited to join Queueless Admin.",
    invitedBy ? `Invited by: ${invitedBy}` : null,
    "",
    "Open this link to set your password and activate your account:",
    inviteUrl,
    "",
    "This link expires in 72 hours. If you did not expect this email, you can ignore it.",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Montserrat,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0a0f1a">
      <h2 style="margin:0 0 12px">You're invited to Queueless Admin</h2>
      <p style="color:#667085;line-height:1.5">
        You've been invited to manage Queueless${invitedBy ? ` by <strong>${invitedBy}</strong>` : ""}.
        Set your password to activate your account.
      </p>
      <p style="margin:28px 0">
        <a href="${inviteUrl}"
           style="display:inline-block;background:#a6e600;color:#0a0f1a;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:10px;letter-spacing:0.04em;text-transform:uppercase;font-size:13px">
          Set password
        </a>
      </p>
      <p style="color:#667085;font-size:13px;line-height:1.5">
        Or copy this link:<br/>
        <a href="${inviteUrl}" style="color:#0a0f1a;word-break:break-all">${inviteUrl}</a>
      </p>
      <p style="color:#667085;font-size:12px">This link expires in 72 hours.</p>
    </div>
  `;

  if (!resendConfigured() && !smtpConfigured()) {
    console.log(`[mail:web] Admin invite for ${to}: ${inviteUrl}`);
    return { mode: "web", inviteUrl };
  }

  try {
    if (resendConfigured()) {
      await sendViaResend({ to, subject, text, html });
    } else {
      await createTransporter().sendMail({
        from: `"${env("MAIL_FROM_NAME", "Queueless Admin")}" <${smtpFrom()}>`,
        to,
        subject,
        text,
        html,
      });
    }
  } catch (error) {
    console.error("Invite email send failed:", error);
    return { mode: "failed", inviteUrl, error: inviteError(error) };
  }

  return { mode: "email" };
}

function inviteError(error) {
  if (error.code === "EAUTH") {
    return "SMTP rejected the credentials. Check email_smtp_user and email_smtp_pass (16-character Gmail app password, 2-Step Verification enabled).";
  }
  if (error.code === "ETIMEDOUT" || error.code === "ESOCKET" || error.name === "TimeoutError") {
    return "Could not reach the mail server. Hosts such as Railway block outbound SMTP ports, so send through Resend or share the invite link manually.";
  }
  return error.message || "Could not send the invite email.";
}
