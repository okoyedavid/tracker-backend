import { z } from "zod";

export const adminSchemas = {
  listUsers: z.object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(120).default(""),
    status: z.enum(["active", "inactive"]).optional(),
    roleId: z.string().uuid().optional(),
  }).strict(),
};
