import { z } from "zod";

export const transcriptSchema = z.object({
  lines: z.array(z.object({
    text: z.string(),
    confidencePercentage: z.number().min(0).max(100),
  })),
  expenses:z.array(z.object({title:z.string().trim().min(1).max(200),cost:z.number().finite().min(0).max(999999999999.99).nullable(),sourceLineIndexes:z.array(z.number().int().nonnegative()).max(100)})).max(200),
  tax:z.number().finite().nonnegative().nullable(),discount:z.number().finite().nonnegative().nullable(),currency:z.string().regex(/^[A-Z]{3}$/).nullable(),
});
