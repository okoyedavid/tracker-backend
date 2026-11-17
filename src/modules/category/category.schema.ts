import { z } from "zod";
export const categorySchemas = {
  create: z.object({ name: z.string().trim().min(1).max(100), description: z.string().trim().max(500).default("") }).strict(),
  id:z.object({id:z.string().uuid()}),
  update:z.object({name:z.string().trim().min(1).max(100).optional(),description:z.string().trim().max(500).optional()}).strict()
    .refine(input=>Object.keys(input).length>0,"Provide a name or description to update."),
};
