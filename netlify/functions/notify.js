const nodemailer = require("nodemailer");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  if (!EMAIL_RE.test(email)) {
    return json(400, { error: "Please enter a valid email." });
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

  try {
    await transporter.sendMail({
      from: `"Queueless Notify" <${gmailUser}>`,
      to: notifyTo,
      replyTo: email,
      subject: `New waitlist signup: ${email}`,
      text: [
        "Someone joined the Queueless waitlist.",
        "",
        `Email: ${email}`,
        `Site: ${site}`,
        `Time: ${submittedAt}`,
      ].join("\n"),
      html: `
        <p>Someone joined the <strong>Queueless</strong> waitlist.</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <p><strong>Site:</strong> ${site}<br/>
        <strong>Time:</strong> ${submittedAt}</p>
      `,
    });
  } catch (error) {
    console.error("SMTP send failed:", error);
    return json(502, { error: "Could not send notification. Try again later." });
  }

  return json(200, { ok: true });
};
