import type { paddleResponseSchema } from "./paddle.schema";

import type { ApiError } from "../../utils/api-error";
import type { OcrResponse } from "../ocr/ocr.types";

type ImageInput = { image: Buffer; contentType: string; filename: string };
export const createPaddleService = ({
  request, endpoint, timeoutMs, responseSchema, createApiError, isApiError,
}: {
  request: typeof fetch;
  endpoint: string;
  timeoutMs: number;
  responseSchema: Pick<typeof paddleResponseSchema, "safeParse">;
  createApiError: (status: number, message: string) => ApiError;
  isApiError: (error: unknown) => error is ApiError;
}) => {
  const recognize = async ({
    image,
    contentType,
    filename,
  }: ImageInput): Promise<OcrResponse> => {
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(image)], { type: contentType }),
      filename,
    );
    try {
      const response = await request(endpoint, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        // Provider details may contain internal paths or request data; do not forward them.
        if (response.status === 503)
          throw createApiError(
            503,
            "Paddle OCR is starting or busy. Please retry shortly.",
          );
        if (response.status === 413)
          throw createApiError(413, "Image must be 10 MB or smaller.");
        if (response.status === 415)
          throw createApiError(
            415,
            "Paddle OCR does not support this image format.",
          );
        throw createApiError(
          502,
          "Paddle OCR could not process this image. Please retry.",
        );
      }
      const parsed = responseSchema.safeParse(await response.json());
      if (!parsed.success) throw createApiError(502, "Paddle OCR returned an invalid transcript.");
      const payload = parsed.data;
      return {
        text: payload.text,
        model: payload.model ?? "PaddleOCR",
        lines: payload.lines.map(
          ({ confidence, confidencePercentage, ...line }) => ({
            ...line,
            confidencePercentage: confidencePercentage ?? confidence ?? null,
          }),
        ),
      };
    } catch (error) {
      if (isApiError(error)) throw error;
      if (
        error instanceof Error &&
        ["TimeoutError", "AbortError"].includes(error.name)
      ) {
        throw createApiError(
          504,
          "Paddle OCR timed out. Its models may still be loading; please retry shortly.",
        );
      }
      if (error instanceof SyntaxError) {
        throw createApiError(502, "Paddle OCR returned an invalid transcript.");
      }
      throw createApiError(
        503,
        "Cannot connect to Paddle OCR. Check that its API is running.",
      );
    }
  };
  return { recognize };
};
