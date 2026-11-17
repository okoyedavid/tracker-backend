import type { ApiError } from "../../utils/api-error";

export type VerificationPurpose = "verify_email" | "reset_password" | "change_email";
export const createEmailService = ({ apiKey, from, appName, clientUrl, request, createApiError }: {
  apiKey?: string; from?: string; appName: string; clientUrl: string; request: typeof fetch;
  createApiError: (status: number,message: string) => ApiError;
}) => {
  const requireConfigured = () => {
    if (!apiKey || !from) throw createApiError(503,"Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.");
  };
  const sendTextEmail = async ({ to, subject, text, deliveryId }: {
    to: string; subject: string; text: string; deliveryId: string;
  }) => {
    requireConfigured();
    let response: Response;
    try {
      response = await request("https://api.resend.com/emails", {
        method: "POST", signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${apiKey}`,"Content-Type": "application/json","Idempotency-Key": deliveryId },
        body: JSON.stringify({ from,to,subject: subject.replace(/[\r\n]/g," "),text }),
      });
    } catch { throw createApiError(502,"Email delivery is temporarily unavailable."); }
    if (!response.ok) throw createApiError(502,"Email delivery failed. Please retry later.");
  };
  const sendVerificationOtpEmail = async ({ to, name, otp, purpose, deliveryId }: {
    to: string; name: string; otp: string; purpose: VerificationPurpose; deliveryId: string;
  }) => {
    const action = { verify_email: "Verify your email", reset_password: "Reset your password", change_email: "Confirm your new email" }[purpose];
    await sendTextEmail({ to, deliveryId, subject: `${action} for ${appName}`,
      text: `Hi ${name},\n\n${action} using this code: ${otp}\n\nIt expires in 15 minutes and can be used once. If you did not request this, ignore this email.` });
  };
  const sendAccountCredentialsEmail = async ({ to, name, loginEmail, password, deliveryId }: {
    to: string; name: string; loginEmail: string; password: string; deliveryId: string;
  }) => sendTextEmail({ to, deliveryId, subject: `Your ${appName} account is ready`,
    text: `Hi ${name},\n\nA supervisor created a Worker account for you.\n\nSign in: ${clientUrl}\nLogin email: ${loginEmail}\nTemporary password: ${password}\n\nYou can sign in immediately without email verification. You may change your password in My account whenever you choose. To reset it, enter the login email above on the login page; the reset code will be delivered to this inbox.\n\nIf you were not expecting this account, contact your supervisor.` });
  return { requireConfigured,sendVerificationOtpEmail,sendAccountCredentialsEmail };
};
export type EmailService = ReturnType<typeof createEmailService>;
