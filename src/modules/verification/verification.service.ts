import type { Database, SqlClient } from "../../config/database";
import type { EmailService, VerificationPurpose } from "../email/email.service";
import type { ApiError } from "../../utils/api-error";

type VerificationRow = { tokenHash: string; targetEmail: string | null; attempts: number; expiresAt: Date; usedAt: Date | null };
export const createVerificationService = ({ database,emailService,createOtp,hashOtp,randomUUID,createApiError }: {
  database: Database; emailService: EmailService; createOtp: () => string;
  hashOtp: (userId: string,purpose: string,otp: string) => string; randomUUID: () => string;
  createApiError: (status: number,message: string) => ApiError;
}) => {
  const issueVerificationToken = async ({ userId,email,name,purpose = "verify_email",targetEmail = null }: {
    userId: string; email: string; name: string; purpose?: VerificationPurpose; targetEmail?: string | null;
  }, transaction?: SqlClient) => {
    emailService.requireConfigured();
    const otp = createOtp(), expiresAt = new Date(Date.now()+15*60000);
    const issue = async (client: SqlClient) => {
      // Lock the user so concurrent sends cannot replace a just-issued code.
      await client.query("SELECT id FROM receipt_tracker.users WHERE id=$1 FOR UPDATE", [userId]);
      const recent = await client.query<{recent: boolean}>("SELECT created_at > now()-interval '60 seconds' AS recent FROM receipt_tracker.verification_tokens WHERE user_id=$1 AND purpose=$2", [userId,purpose]);
      if (recent.rows[0]?.recent) throw createApiError(429,"Wait 60 seconds before requesting another code.");
      await client.query(`INSERT INTO receipt_tracker.verification_tokens(user_id,purpose,token_hash,target_email,expires_at)
       VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,purpose) DO UPDATE SET token_hash=EXCLUDED.token_hash,
       target_email=EXCLUDED.target_email,expires_at=EXCLUDED.expires_at,attempts=0,used_at=NULL,created_at=now()`,
       [userId,purpose,hashOtp(userId,purpose,otp),targetEmail,expiresAt]);
      await emailService.sendVerificationOtpEmail({ to: email,name,otp,purpose,deliveryId: randomUUID() });
    };
    if (transaction) await issue(transaction); else await database.transaction(issue);
    return { expiresAt };
  };
  const withVerifiedToken = async <T>(userId: string,otp: string,purpose: VerificationPurpose,
    work: (client: SqlClient,targetEmail: string | null) => Promise<T>): Promise<T> => {
    const outcome = await database.transaction(async client => {
      // Consistent user -> token -> session lock ordering across account operations.
      await client.query("SELECT id FROM receipt_tracker.users WHERE id=$1 FOR UPDATE", [userId]);
      const rows = await client.query<VerificationRow>(`SELECT token_hash AS "tokenHash",target_email AS "targetEmail",attempts,
        expires_at AS "expiresAt",used_at AS "usedAt" FROM receipt_tracker.verification_tokens WHERE user_id=$1 AND purpose=$2 FOR UPDATE`, [userId,purpose]);
      const row = rows.rows[0];
      if (!row || row.usedAt || row.expiresAt <= new Date() || row.attempts >= 5) return { error: createApiError(400,"Invalid or expired verification code.") };
      if (row.tokenHash !== hashOtp(userId,purpose,otp)) {
        await client.query("UPDATE receipt_tracker.verification_tokens SET attempts=attempts+1 WHERE user_id=$1 AND purpose=$2",[userId,purpose]);
        return { error: createApiError(400,"Invalid or expired verification code.") };
      }
      await client.query("UPDATE receipt_tracker.verification_tokens SET used_at=now() WHERE user_id=$1 AND purpose=$2",[userId,purpose]);
      return { value: await work(client,row.targetEmail) };
    });
    if (outcome.error) throw outcome.error;
    return outcome.value!;
  };
  return { issueVerificationToken,withVerifiedToken };
};
export type VerificationService = ReturnType<typeof createVerificationService>;
