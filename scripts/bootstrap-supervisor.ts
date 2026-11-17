import { database } from "../src/config/database.module";

async function main() {
  const email=process.argv[2]?.trim().toLowerCase();
  if(!email || !email.includes("@")) throw new Error("Usage: npm run auth:supervisor -- existing-user@example.com");
  const result=await database.query(`UPDATE receipt_tracker.users SET role_id=(SELECT id FROM receipt_tracker.roles WHERE key='supervisor' AND status='active'),updated_at=now()
    WHERE lower(email)=lower($1) AND status='active' RETURNING id`,[email]);
  if(!result.rowCount) throw new Error("No active user with that email exists. Register or sign in with Google first.");
  console.log("Supervisor role assigned to the existing account.");
}
main().catch((error:unknown)=>{console.error(error instanceof Error ? error.message : "Supervisor assignment failed.");process.exitCode=1;}).finally(()=>database.close());
