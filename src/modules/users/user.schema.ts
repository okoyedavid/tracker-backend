import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(254);
export const userSchemas = {
  create: z.object({
    name: z.string().trim().min(2).max(50),
    email,
    password: z.string().min(8).max(72)
      .refine(value => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 UTF-8 bytes.")
      .regex(/[A-Z]/, "Password must contain an uppercase letter")
      .regex(/[a-z]/, "Password must contain a lowercase letter")
      .regex(/[0-9]/, "Password must contain a number"),
    deliveryEmail: z.preprocess(value => typeof value === "string" && !value.trim() ? undefined : value, email.optional()),
  }).strict(),
};
