import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import { createGeminiService } from "./gemini.service";
import { createGeminiOcrAdapter } from "./gemini-ocr.adapter";
import { transcriptSchema } from "./gemini.schema";

export const geminiService = createGeminiService({
  provider: env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1beta" } }) : undefined,
  defaultModel: env.GEMINI_MODEL,
  allowedModels: env.GEMINI_ALLOWED_MODELS,
  defaultTimeoutMs: env.OCR_REQUEST_TIMEOUT_MS,
  createApiError: (status, message) => new ApiError(status, message),
  isApiError: (error): error is ApiError => error instanceof ApiError,
  logger: console,
});

export const geminiOcrAdapter = createGeminiOcrAdapter({
  geminiService,
  timeoutMs: env.OCR_REQUEST_TIMEOUT_MS,
  schema: transcriptSchema,
  createApiError: (status, message) => new ApiError(status, message),
});
