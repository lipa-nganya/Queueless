import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.CUSTOMER_PORT || 3000);

const app = express();
app.use(
  express.static(__dirname, {
    maxAge: process.env.NODE_ENV === "production" ? "5m" : 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

app.listen(port, () => {
  console.log(`Customer app: http://localhost:${port}/`);
});
