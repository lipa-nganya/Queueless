import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://queueless:queueless_dev@localhost:5434/queueless",
  // Small apps stay cheap on Railway/Render; raise PG_POOL_MAX only if needed.
  max: Math.max(2, Math.min(20, Number(process.env.PG_POOL_MAX || 5) || 5)),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 15000) || 15000,
  connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS || 10000) || 10000,
  allowExitOnIdle: true,
});

export async function query(text, params) {
  return pool.query(text, params);
}
