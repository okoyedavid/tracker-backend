import bcrypt from "bcryptjs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { database } from "../../config/database.module";
import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import { asyncHandler } from "../../utils/async-handler";
import { createAuthCookies } from "../../utils/cookie";
import { userRepository } from "../users/users.module";
import { sessionService } from "../session/session.module";
import { tokenService } from "../token/token.module";
import { emailService } from "../email/email.module";
import { verificationService } from "../verification/verification.module";
import { createGoogleOAuthAdapter } from "./google-oauth.adapter";
import { createAuthService } from "./auth.service";
import { createAuthController } from "./auth.controller";
import { authSchemas } from "./auth.schema";

const createApiError = (status: number, message: string) =>
  new ApiError(status, message);
export const hashService = {
  hashValue: (value: string) => bcrypt.hash(value, 12),
  compareHash: (value: string, hash: string) => bcrypt.compare(value, hash),
};
export const authCookies = createAuthCookies({
  secure: env.NODE_ENV === "production",
});
const googleOAuthService = createGoogleOAuthAdapter({
  configuration: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUrl: env.GOOGLE_REDIRECT_URL,
  },
  request: fetch,
  createState: () => randomBytes(32).toString("base64url"),
  statesEqual: (a, b) => {
    const expected = Buffer.from(a),
      received = Buffer.from(b);
    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    );
  },
  createApiError,
});
export const authService = createAuthService({
  database,
  userRepository,
  hashService,
  sessionService,
  tokenService,
  verificationService,
  googleOAuthService,
  requireEmailConfigured: emailService.requireConfigured,
  createApiError,
});
export const authController = createAuthController({
  authService,
  sessionService,
  googleOAuthService,
  cookies: authCookies,
  schemas: authSchemas,
  asyncHandler,
  clientUrl: env.CLIENT_URL,
  createApiError,
});
