import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.VENDOR_PORT || 3500);

function firebaseWebConfigFromEnv() {
  const raw = String(process.env.FIREBASE_WEB_CONFIG_JSON || "").trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.apiKey && parsed?.projectId && parsed?.appId && parsed?.vapidKey) {
        return {
          apiKey: String(parsed.apiKey),
          authDomain: String(parsed.authDomain || `${parsed.projectId}.firebaseapp.com`),
          projectId: String(parsed.projectId),
          storageBucket: String(parsed.storageBucket || `${parsed.projectId}.appspot.com`),
          messagingSenderId: String(parsed.messagingSenderId || ""),
          appId: String(parsed.appId),
          vapidKey: String(parsed.vapidKey),
        };
      }
    } catch {
      /* ignore */
    }
  }
  const apiKey = String(process.env.FIREBASE_WEB_API_KEY || "").trim();
  const projectId = String(
    process.env.FIREBASE_WEB_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || ""
  ).trim();
  const appId = String(process.env.FIREBASE_WEB_APP_ID || "").trim();
  const vapidKey = String(process.env.FIREBASE_WEB_VAPID_KEY || "").trim();
  const messagingSenderId = String(process.env.FIREBASE_WEB_MESSAGING_SENDER_ID || "").trim();
  if (!apiKey || !projectId || !appId || !vapidKey || !messagingSenderId) return null;
  return {
    apiKey,
    authDomain: String(process.env.FIREBASE_WEB_AUTH_DOMAIN || `${projectId}.firebaseapp.com`).trim(),
    projectId,
    storageBucket: String(
      process.env.FIREBASE_WEB_STORAGE_BUCKET || `${projectId}.appspot.com`
    ).trim(),
    messagingSenderId,
    appId,
    vapidKey,
  };
}

const app = express();

app.get("/firebase-web-config.js", (_req, res) => {
  const config = firebaseWebConfigFromEnv() || null;
  res.setHeader("Cache-Control", "no-cache");
  res.type("application/javascript").send(
    `self.QUEUELESS_FIREBASE_WEB = ${JSON.stringify(config)};\n` +
      `var QUEUELESS_FIREBASE_WEB = self.QUEUELESS_FIREBASE_WEB;\n` +
      `if (typeof window !== "undefined") window.QUEUELESS_FIREBASE_WEB = self.QUEUELESS_FIREBASE_WEB;\n`
  );
});

app.use(
  express.static(__dirname, {
    maxAge: process.env.NODE_ENV === "production" ? "5m" : 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html") || filePath.endsWith("firebase-messaging-sw.js")) {
        res.setHeader("Cache-Control", "no-cache");
      }
      if (filePath.endsWith("firebase-messaging-sw.js")) {
        res.setHeader("Service-Worker-Allowed", "/");
      }
    },
  })
);

app.listen(port, () => {
  console.log(`Vendor app: http://localhost:${port}/`);
});
