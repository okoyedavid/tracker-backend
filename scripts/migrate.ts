import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { env } from "../src/config/env";

async function main() {
  const connectionString=env.DATABASE_URL??env.DATABASE_URL_POOLED;
  if(!connectionString) throw new Error("Set DATABASE_URL before running migrations.");
  const files=(await readdir("migrations")).filter(file=>/^\d+_[a-z0-9_]+\.sql$/.test(file)).sort();
  const pool=new Pool({connectionString,max:1,connectionTimeoutMillis:10000});
  try {
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(724918301)");
      await client.query("CREATE SCHEMA IF NOT EXISTS receipt_tracker");
      await client.query("CREATE TABLE IF NOT EXISTS receipt_tracker.schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())");
      for (const file of files) {
      const version=file.slice(0,-4);
      const sql=await readFile(`migrations/${file}`,"utf8");
      const checksum=createHash("sha256").update(sql).digest("hex");
      const existing=await client.query<{checksum:string}>("SELECT checksum FROM receipt_tracker.schema_migrations WHERE version=$1",[version]);
      if(existing.rows[0]) {
        if(existing.rows[0].checksum!==checksum) throw new Error("Migration checksum changed. Add a new migration instead of editing an applied one.");
        console.log(`${version} already applied.`);
      } else {
        await client.query(sql);
        await client.query("INSERT INTO receipt_tracker.schema_migrations(version,checksum) VALUES($1,$2)",[version,checksum]);
        console.log(`Applied ${version} to receipt_tracker schema.`);
      }
      }
      await client.query("COMMIT");
    } catch(error) {await client.query("ROLLBACK");throw error;} finally {client.release();}
  } finally {await pool.end();}
}
main().catch((error:unknown)=>{
  const code=typeof error==="object"&&error!==null&&"code"in error?String(error.code):"configuration";
  console.error(`Migration failed (${code}). Check database access and migration configuration.`);
  process.exitCode=1;
});
