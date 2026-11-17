import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import { createEmailService } from "./email.service";

export const emailService = createEmailService({ apiKey: env.RESEND_API_KEY,from: env.EMAIL_FROM,appName: env.APP_NAME,clientUrl: env.CLIENT_URL,
  request: fetch,createApiError: (status,message)=>new ApiError(status,message) });
