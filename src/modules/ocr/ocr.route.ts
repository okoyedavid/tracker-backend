import express, { Router } from "express";

import { ocrController } from "./ocr.module";
import { protect,requirePermission,sameOrigin } from "../../middleware/security.module";

export const OcrRouter = Router();

OcrRouter.post(
  "/",
  sameOrigin,
  protect,
  requirePermission("receipts:scan"),
  express.raw({ type: "image/*", limit: "10mb" }),
  ocrController.scanReceipt,
);
