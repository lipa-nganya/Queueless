import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://queueless:queueless_dev@localhost:5434/queueless",
  max: Math.max(2, Math.min(30, Number(process.env.PG_POOL_MAX || 10) || 10)),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000) || 30000,
  connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS || 10000) || 10000,
});

export async function query(text, params) {
  return pool.query(text, params);
}
