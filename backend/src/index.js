import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { migrate, seedAdmin } from "./migrate.js";
import routes from "./routes.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminDir = path.resolve(__dirname, "../../admin");
const uploadsDir = path.resolve(__dirname, "../uploads");
const port = Number(process.env.PORT || 4000);

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", routes);
app.use("/uploads", express.static(uploadsDir));
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});
app.use(express.static(adminDir));

async function start() {
  await migrate();
  await seedAdmin();

  app.listen(port, () => {
    console.log(`Admin + API: http://localhost:${port}/`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
