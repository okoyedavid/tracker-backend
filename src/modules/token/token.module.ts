import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";
import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import { createTokenService } from "./token.service";

export const tokenService = createTokenService({
  jwtService: jwt, accessSecret: env.JWT_ACCESS_SECRET, refreshSecret: env.JWT_REFRESH_SECRET,
  hashToken: token => createHash("sha256").update(token).digest("hex"),
  createApiError: (status, message) => new ApiError(status, message),
});
