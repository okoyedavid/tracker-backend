import type { RequestHandler } from "express";
import type { asyncHandler as AsyncHandler } from "../utils/async-handler";
import type { ApiError } from "../utils/api-error";
import type { SessionService } from "../modules/session/session.service";

export const createAuthMiddleware = ({
  sessionService,
  asyncHandler,
  createApiError,
}: {
  sessionService: SessionService;
  asyncHandler: typeof AsyncHandler;
  createApiError: (status: number, message: string) => ApiError;
}) => {
  const protect: RequestHandler = asyncHandler(async (req, _res, next) => {
    const bearer = req.get("authorization");
    const token = bearer?.startsWith("Bearer ")
      ? bearer.slice(7)
      : req.cookies?.accessToken;
    if (typeof token !== "string" || !token)
      throw createApiError(401, "Authentication required.");
    req.user = await sessionService.authenticateAccess(token);
    next();
  });
  const requireSameOrigin: (trustedOrigins: string[]) => RequestHandler =
    (trustedOrigins) => (req, _res, next) => {
      if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        next();
        return;
      }
      const origin = req.get("origin");
      if (
        req.get("sec-fetch-site") === "cross-site" ||
        (origin && !trustedOrigins.includes(origin))
      ) {
        next(createApiError(403, "This request origin is not allowed."));
        return;
      }
      next();
    };
  return { protect, requireSameOrigin };
};
