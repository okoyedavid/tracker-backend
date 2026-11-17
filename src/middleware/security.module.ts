import { rateLimit } from "express-rate-limit";
import { createHash } from "node:crypto";
import { env } from "../config/env";
import { ApiError } from "../utils/api-error";
import { asyncHandler } from "../utils/async-handler";
import { sessionService } from "../modules/session/session.module";
import { createAuthMiddleware } from "./auth.middleware";
import { createRbacMiddleware } from "./rbac.middleware";

const createApiError = (status: number, message: string) =>
  new ApiError(status, message);
const authMiddleware = createAuthMiddleware({
  sessionService,
  asyncHandler,
  createApiError,
});
export const { protect } = authMiddleware;
export const { requirePermission, requireAnyPermission } = createRbacMiddleware(
  { createApiError },
);
export const sameOrigin = authMiddleware.requireSameOrigin([
  new URL(env.CLIENT_URL).origin,
]);
const common = {
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please retry later." },
};
export const loginLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60000,
  limit: 20,
});
export const identityLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60000,
  limit: 10,
  keyGenerator: (req) =>
    createHash("sha256")
      .update(
        String(req.body?.email ?? "")
          .trim()
          .toLowerCase(),
      )
      .digest("hex"),
});
export const otpLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60000,
  limit: 10,
});
export const emailDeliveryLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60000,
  limit: 3,
});
