import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(254);
const password = z
  .string()
  .min(8)
  .max(72)
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Password must be at most 72 UTF-8 bytes.",
  )
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number");
export const accountSchemas = {
  profile: z
    .object({
      name: z.string().trim().min(2).max(50).optional(),
      username: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9_]{3,30}$/)
        .nullable()
        .optional(),
      bio: z.string().trim().max(250).nullable().optional(),
    })
    .strict()
    .refine(
      (value) => Object.keys(value).length > 0,
      "Provide at least one profile field.",
    ),
  avatar: z
    .object({
      avatar: z
        .string()
        .url()
        .max(2048)
        .refine(
          (value) =>
            URL.canParse(value) && new URL(value).protocol === "https:",
          "Avatar URL must use HTTPS.",
        ),
    })
    .strict(),
  changePassword: z
    .object({
      currentPassword: z.string().min(1).max(72),
      newPassword: password,
    })
    .strict(),
  changeEmail: z
    .object({
      newEmail: email,
      currentPassword: z.string().min(1).max(72).optional(),
    })
    .strict(),
  confirmEmail: z.object({ otp: z.string().regex(/^\d{6}$/) }).strict(),
};
