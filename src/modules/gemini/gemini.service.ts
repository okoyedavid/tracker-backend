import type { GoogleGenAI } from "@google/genai";

import type { ApiError } from "../../utils/api-error";

type InteractionRequest = Extract<
  Parameters<GoogleGenAI["interactions"]["create"]>[0],
  { model: unknown }
>;
type GenerateInput = Pick<
  InteractionRequest,
  "input" | "system_instruction" | "response_format" | "generation_config"
> & {
  model?: string;
  timeoutMs?: number;
};

export const createGeminiService = ({
  provider, defaultModel, allowedModels, defaultTimeoutMs, createApiError, isApiError, logger,
}: {
  provider: GoogleGenAI | undefined;
  defaultModel: string;
  allowedModels: readonly string[];
  defaultTimeoutMs: number;
  createApiError: (status: number, message: string) => ApiError;
  isApiError: (error: unknown) => error is ApiError;
  logger: Pick<Console, "error">;
}) => {
  const resolveModel = (model = defaultModel): string => {
    if (!allowedModels.includes(model)) {
      throw createApiError(
        400,
        "Unsupported Gemini model. Choose an approved model.",
      );
    }
    return model;
  };

  const generate = async ({
    model: requestedModel,
    timeoutMs = defaultTimeoutMs,
    ...request
  }: GenerateInput) => {
    const model = resolveModel(requestedModel);
    if (!provider)
      throw createApiError(
        503,
        "Set GEMINI_API_KEY on the backend to enable Gemini.",
      );
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 25000) {
      throw createApiError(
        400,
        "Gemini deadline must be between 1 and 25000 milliseconds.",
      );
    }
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(createApiError(504, "Gemini processing timed out. Please retry."));
      }, timeoutMs);
    });
    try {
      const result = await Promise.race([
        expired,
        provider.interactions.create(
          {
            ...request,
            api_version: "v1beta",
            automatic_continuation: false,
            model,
            store: false,
          },
          {
            signal: controller.signal,
            timeout_ms: timeoutMs,
            retries: { strategy: "none" },
          },
        ),
      ]);
      if (result.status !== "completed" || !result.output_text) {
        throw createApiError(
          502,
          "Gemini did not return a complete response. Please retry.",
        );
      }
      return { model, text: result.output_text };
    } catch (error) {
      if (isApiError(error)) throw error;
      if (
        controller.signal.aborted ||
        (error instanceof Error &&
          [
            "TimeoutError",
            "RequestTimeoutError",
            "APIConnectionTimeoutError",
            "ContinuationTimeoutError",
          ].includes(error.name))
      ) {
        throw createApiError(504, "Gemini processing timed out. Please retry.");
      }
      const status =
        typeof error === "object" && error !== null
          ? "statusCode" in error
            ? error.statusCode
            : "status" in error
              ? error.status
              : undefined
          : undefined;
      logger.error("Gemini request failed", {
        status,
        name: error instanceof Error ? error.name : "UnknownError",
      });
      if (status === 429)
        throw createApiError(
          429,
          "Gemini quota or rate limit reached. Check your API plan and retry later.",
        );
      if (status === 401 || status === 403)
        throw createApiError(
          503,
          "Gemini access was denied. Check the backend API key and project permissions.",
        );
      if (status === 404)
        throw createApiError(
          503,
          "The configured Gemini model is unavailable. Check GEMINI_MODEL.",
        );
      if (typeof status === "number" && status >= 500)
        throw createApiError(
          503,
          "Gemini is temporarily unavailable. Please retry shortly.",
        );
      throw createApiError(502, "Gemini processing failed. Please retry.");
    } finally {
      clearTimeout(timeout);
    }
  };

  return { generate };
};

export type GeminiService = ReturnType<typeof createGeminiService>;
