import { z } from "zod";

const allowedPermissions = [
  "receipts:scan",
  "expenses:create",
  "expenses:view",
  "expenses:view_own",
  "expenses:delete",
  "expenses:approve",
  "reports:view",
  "budgets:manage",
  "roles:view",
  "roles:manage",
  "roles:assign",
  "users:view",
  "users:manage",
  "user:create",
  "categories:view",
  "categories:create",
  "categories:update",
  "categories:delete",
] as const;

const permissions = z
  .array(z.enum(allowedPermissions))
  .max(allowedPermissions.length)
  .refine(
    (value) => new Set(value).size === value.length,
    "Permissions must not contain duplicates.",
  );
export const roleSchemas = {
  id: z.object({ roleId: z.string().uuid() }),
  create: z
    .object({
      name: z.string().trim().min(2).max(50),
      permissions: permissions.default([]),
      deniedPermissions: permissions.default([]),
    })
    .strict(),
  update: z
    .object({
      name: z.string().trim().min(2).max(50).optional(),
      permissions: permissions.optional(),
      deniedPermissions: permissions.optional(),
    })
    .strict()
    .refine(
      (value) => Object.keys(value).length > 0,
      "Provide at least one role field.",
    ),
  assign: z.object({ roleId: z.string().uuid() }).strict(),
  userId: z.object({ userId: z.string().uuid() }),
  status: z.object({ status: z.enum(["active", "inactive"]) }).strict(),
};
