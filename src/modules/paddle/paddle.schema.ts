import { z } from "zod";

const paddleLineSchema = z.object({
  text: z.string(),
  confidencePercentage: z.number().min(0).max(100).nullable().optional(),
  confidence: z.number().min(0).max(100).nullable().optional(),
  boundingBox: z.array(z.tuple([z.number(), z.number()])).optional(),
  boxHeight: z.number().nonnegative().optional(),
});
export const paddleResponseSchema = z.object({
  success: z.literal(true).optional(),
  text: z.string(),
  model: z.string().min(1).optional(),
  lines: z.array(paddleLineSchema),
});

