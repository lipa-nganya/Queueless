import nodemailer from "nodemailer";

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

function mailConfigured() {
  return Boolean(env("email_smtp_host") && smtpUser() && smtpPass());
}

function createTransporter() {
  const port = Number(env("email_smtp_port", "587")) || 587;
  const secure = env("email_smtp_secure", "false").toLowerCase() === "true";

  return nodemailer.createTransport({
    host: env("email_smtp_host", "smtp.gmail.com"),
    port,
    secure,
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

  if (!mailConfigured()) {
    console.log(`[mail:web] Admin invite for ${to}: ${inviteUrl}`);
    return { mode: "web", inviteUrl };
  }

  const transporter = createTransporter();
  const fromName = env("MAIL_FROM_NAME", "Queueless Admin");
  const fromAddress = smtpFrom();

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error("Invite email send failed:", error);
    return {
      mode: "failed",
      inviteUrl,
      error:
        error.code === "EAUTH"
          ? "SMTP rejected the credentials. Check email_smtp_user and email_smtp_pass (16-character Gmail app password, 2-Step Verification enabled)."
          : "Could not send the invite email.",
    };
  }

  return { mode: "email" };
}
