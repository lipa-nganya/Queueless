import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { migrate, seedAdmin } from "./migrate.js";
import { seedSettings } from "./settings.js";
import routes from "./routes.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminDir = path.resolve(__dirname, "../../admin");
const uploadsDir = path.resolve(__dirname, "../uploads");
const port = Number(process.env.PORT || 4000);

// The deployed frontends call this API cross-origin; local dev serves them from these ports.
const defaultOrigins = [
  "http://localhost:3000",
  "http://localhost:4000",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:4000",
];
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .concat(defaultOrigins)
);

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin and non-browser clients send no Origin header.
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed.`));
    },
  })
);
app.use(express.json());
app.use("/api", routes);

// Upload filenames embed a timestamp and are never rewritten, so they can be
// cached indefinitely. Without this every page view revalidates every image.
app.use(
  "/uploads",
  express.static(uploadsDir, {
    maxAge: "1y",
    immutable: true,
  })
);
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});
app.use(express.static(adminDir));

async function start() {
  await migrate();
  await seedAdmin();
  await seedSettings();

  app.listen(port, () => {
    console.log(`Admin + API: http://localhost:${port}/`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
