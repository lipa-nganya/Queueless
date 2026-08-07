import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://queueless:queueless_dev@localhost:5434/queueless",
});

export async function query(text, params) {
  return pool.query(text, params);
}
