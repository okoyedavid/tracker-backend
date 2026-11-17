import type { Request, Response } from "express";
import type { ApiError } from "../../utils/api-error";
import type { asyncHandler } from "../../utils/async-handler";
import type { ocrService } from "./ocr.service";
import type { ReceiptReview } from './receipt-review';

export type OcrController = {
  ocrService: ocrService;
  receiptReview: ReceiptReview;
  asyncHandler: typeof asyncHandler;
  logger: Pick<Console, "error">;
  isApiError: (error: unknown) => error is ApiError;
  createApiError: (statusCode: number, message: string) => ApiError;
};

export const createOcrController = ({
  createApiError,
  ocrService,
  asyncHandler,
  logger,
  isApiError,
  receiptReview,
}: OcrController) => {
  const scanReceipt = asyncHandler(async (req: Request, res: Response) => {
    const contentType = req.header("content-type")?.split(";")[0]?.trim();
    if (!contentType?.startsWith("image/")) {
      throw createApiError(415, "Send an image with an image/* Content-Type.");
    }

    const image = req.body as Buffer | undefined;
    if (!image?.length) {
      throw createApiError(400, "An image is required.");
    }

    const filename = req.header("x-filename") || "upload";
    const model = req.query.model;
    if (model !== undefined && (typeof model !== "string" || !model.trim())) {
      throw createApiError(400, "model must be a single non-empty query parameter.");
    }

    try {
      const ocr = await ocrService.processReceiptImage({
        image,
        contentType,
        filename,
        model: typeof model === "string" ? model.trim() : undefined,
      });
      const result=ocrService.processReceipt(ocr);
      res.setHeader('Cache-Control','no-store');
      res.json({...result,...receiptReview.issue(req.user!.id,image,result)});
    } catch (error) {
      logger.error("Receipt image processing failed:", error);
      if (isApiError(error)) throw error;
      if (error instanceof Error && error.name === "TimeoutError") {
        throw createApiError(504, "Receipt image processing timed out. Please retry.");
      }
      throw createApiError(502, "OCR processing failed.");
    }
  });

  return {
    scanReceipt,
  };
};
