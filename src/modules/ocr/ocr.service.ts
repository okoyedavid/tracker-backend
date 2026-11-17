

import type { OcrResponse, ReceiptResponse } from "./ocr.types";
import type { ocrResponseSchema } from "./ocr.schema";
import type { ApiError } from "../../utils/api-error";

type ProcessReceiptImageInput = {
  image: Buffer;
  contentType: string;
  filename: string;
  model?: string;
};
export type OcrProviderInput = Omit<ProcessReceiptImageInput, "model">;
export type OcrProvider = (input: OcrProviderInput) => Promise<OcrResponse>;

export const createOcrService = ({ providers, defaultProvider, supportedTypes, extractReceipt, extractExpenses, schema, createApiError }: {
  providers: Readonly<Partial<Record<string, OcrProvider>>>;
  defaultProvider: string;
  supportedTypes: ReadonlySet<string>;
  extractReceipt: (ocr: OcrResponse) => ReceiptResponse["fields"];
  extractExpenses:(ocr:OcrResponse)=>Pick<ReceiptResponse,"expenses"|"adjustments">;
  schema: Pick<typeof ocrResponseSchema, "safeParse">;
  createApiError: (status: number, message: string) => ApiError;
}) => {
  const processReceiptImage = async ({ model = defaultProvider, ...image }: ProcessReceiptImageInput): Promise<OcrResponse> => {
    if (!supportedTypes.has(image.contentType)) throw createApiError(415, "Upload a JPEG, PNG, WebP, HEIC, or HEIF image.");
    const provider = Object.hasOwn(providers, model) ? providers[model] : undefined;
    if (!provider) throw createApiError(400, "model must be paddle or gemini.");
    return provider(image);
  };
  const processReceipt = (ocr: OcrResponse): ReceiptResponse => {
    const parsed = schema.safeParse(ocr);
    if (!parsed.success) {
      throw createApiError(502, "OCR returned an invalid receipt transcript.");
    }
    return {
      ocr: parsed.data,
      fields: extractReceipt(parsed.data),
      needsReview: true,
      ...extractExpenses(parsed.data),
    };
  };
  return { processReceiptImage, processReceipt };
};
export type ocrService = ReturnType<typeof createOcrService>;
