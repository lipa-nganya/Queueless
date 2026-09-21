import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.LANDING_PORT || 8080);

const app = express();

const staticOpts = {
  maxAge: process.env.NODE_ENV === "production" ? "5m" : 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache");
    }
  },
};

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/index.html", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/landing.css", (_req, res) => {
  res.sendFile(path.join(__dirname, "landing.css"));
});
app.get("/landing-config.js", (_req, res) => {
  res.sendFile(path.join(__dirname, "landing-config.js"));
});
app.use("/assets", express.static(path.join(__dirname, "assets"), staticOpts));

app.get("/app", (_req, res) => {
  res.redirect(302, process.env.CUSTOMER_PUBLIC_URL || "http://localhost:3000/");
});
app.get("/customer", (_req, res) => {
  res.redirect(302, process.env.CUSTOMER_PUBLIC_URL || "http://localhost:3000/");
});
app.get("/customer/*", (_req, res) => {
  res.redirect(302, process.env.CUSTOMER_PUBLIC_URL || "http://localhost:3000/");
});

app.listen(port, () => {
  console.log(`Queueless landing: http://localhost:${port}/`);
});
