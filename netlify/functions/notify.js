const nodemailer = require("nodemailer");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(204, {});
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  const notifyTo = process.env.NOTIFY_TO || gmailUser;

  if (!gmailUser || !gmailPass || !notifyTo) {
    console.error("Missing GMAIL_USER, GMAIL_APP_PASSWORD, or NOTIFY_TO");
    return json(500, { error: "Email is not configured yet." });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid request body." });
  }

  // Honeypot — bots fill hidden fields
  if (payload.company) {
    return json(200, { ok: true });
  }

  const email = String(payload.email || "")
    .trim()
    .toLowerCase();
  const businessName = String(payload.businessName || "")
    .trim()
    .slice(0, 120);
  const hasEmail = email.length > 0;

  if (hasEmail && !EMAIL_RE.test(email)) {
    return json(400, { error: "Please enter a valid email." });
  }
  if (!hasEmail && !businessName) {
    return json(400, { error: "Enter your business name." });
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });

  const submittedAt = new Date().toISOString();
  const site = event.headers.host || "queueless";
  const safeName = escapeHtml(businessName);
  const safeEmail = escapeHtml(email);
  const safeSite = escapeHtml(site);
  const subject = businessName
    ? `Free testing request: ${businessName}`
    : `New waitlist signup: ${email}`;

  try {
    await transporter.sendMail({
      from: `"Queueless Notify" <${gmailUser}>`,
      to: notifyTo,
      replyTo: hasEmail ? email : undefined,
      subject,
      text: [
        businessName
          ? "A business asked for free testing access."
          : "Someone joined the Queueless waitlist.",
        "",
        businessName ? `Business: ${businessName}` : null,
        hasEmail ? `Email: ${email}` : null,
        `Site: ${site}`,
        `Time: ${submittedAt}`,
      ]
        .filter(Boolean)
        .join("\n"),
      html: `
        <p>${
          businessName
            ? "A business asked for <strong>Queueless</strong> free testing."
            : "Someone joined the <strong>Queueless</strong> waitlist."
        }</p>
        ${businessName ? `<p><strong>Business:</strong> ${safeName}</p>` : ""}
        ${
          hasEmail
            ? `<p><strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>`
            : ""
        }
        <p><strong>Site:</strong> ${safeSite}<br/>
        <strong>Time:</strong> ${escapeHtml(submittedAt)}</p>
      `,
    });
  } catch (error) {
    console.error("SMTP send failed:", error);
    return json(502, { error: "Could not send notification. Try again later." });
  }

  return json(200, { ok: true });
};
