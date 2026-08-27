import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.VENDOR_PORT || 3500);

const app = express();
app.use(express.static(__dirname));

app.listen(port, () => {
  console.log(`Vendor app: http://localhost:${port}/`);
});
