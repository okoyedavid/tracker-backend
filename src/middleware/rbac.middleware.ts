import type { RequestHandler } from "express";
import type { ApiError } from "../utils/api-error";

// Explicit role denials take precedence over grants.
export const createRbacMiddleware = ({
  createApiError,
}: {
  createApiError: (status: number, message: string) => ApiError;
}) => {
  const requirePermission =
    (permission: string): RequestHandler =>
    (req, _res, next) => {
      if (!req.user) {
        next(createApiError(401, "Authentication required."));
        return;
      }
      const role = req.user.role;
      if (
        role.status !== "active" ||
        role.deniedPermissions.includes(permission) ||
        !role.permissions.includes(permission)
      ) {
        next(createApiError(403, `Missing required permission: ${permission}`));
        return;
      }
      next();
    };
  const requireAnyPermission =
    (permissions: string[]): RequestHandler =>
    (req, _res, next) => {
      if (!req.user) {
        next(createApiError(401, "Authentication required."));
        return;
      }
      const role = req.user.role;
      if (
        role.status !== "active" ||
        !permissions.some(
          (permission) =>
            role.permissions.includes(permission) &&
            !role.deniedPermissions.includes(permission),
        )
      ) {
        next(createApiError(403, "Your role does not allow this action."));
        return;
      }
      next();
    };
  return { requirePermission, requireAnyPermission };
};
