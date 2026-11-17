import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import { paddleResponseSchema } from "./paddle.schema";
import { createPaddleService } from "./paddle.service";

export const paddleService = createPaddleService({
  request: fetch,
  endpoint: env.PADDLE_SERVER,
  timeoutMs: env.OCR_REQUEST_TIMEOUT_MS,
  responseSchema: paddleResponseSchema,
  createApiError: (status, message) => new ApiError(status, message),
  isApiError: (error): error is ApiError => error instanceof ApiError,
});
