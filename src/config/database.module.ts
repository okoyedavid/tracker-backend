import { Pool } from "pg";
import { env } from "./env";
import { ApiError } from "../utils/api-error";
import { createDatabase } from "./database";

const connectionString = env.DATABASE_URL_POOLED ?? env.DATABASE_URL;
const pool = connectionString
  ? new Pool({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    })
  : undefined;
pool?.on("error", () => console.error("An idle PostgreSQL connection failed."));
export const database = createDatabase({
  pool,
  createApiError: (status, message) => new ApiError(status, message),
});
