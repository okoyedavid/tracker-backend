import { ApiError } from "../../utils/api-error";
import { asyncHandler } from "../../utils/async-handler";
import { createOcrController } from "./ocr.controller";
import { createOcrService } from "./ocr.service";
import { geminiOcrAdapter } from "../gemini/gemini.module";
import { paddleService } from "../paddle/paddle.module";
import { createReceiptExtractor } from "./receipt-extractor";
import { ocrResponseSchema,receiptResponseSchema } from "./ocr.schema";
import { createHash } from 'node:crypto';
import { tokenService } from '../token/token.module';
import { createReceiptReview } from './receipt-review';

const createApiError = (status: number, message: string) => new ApiError(status, message);
export const receiptReview=createReceiptReview({hash:input=>createHash('sha256').update(input).digest('hex'),sign:tokenService.signReceipt,verify:tokenService.verifyReceipt,normalize:response=>receiptResponseSchema.parse(response),createApiError});
const extractor = createReceiptExtractor();
const ocrService = createOcrService({
  extractReceipt: extractor.extractReceipt,
  extractExpenses: extractor.extractExpenses,
  schema: ocrResponseSchema,
  providers: {
    paddle: paddleService.recognize,
    gemini: geminiOcrAdapter,
  },
  defaultProvider: "gemini",
  supportedTypes: new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]),
  createApiError,
});

export const ocrController = createOcrController({
  ocrService, receiptReview, createApiError, asyncHandler, logger: console,
  isApiError: (error): error is ApiError => error instanceof ApiError,
});
