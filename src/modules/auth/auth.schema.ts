import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8).max(72)
  .refine(value => Buffer.byteLength(value,"utf8") <= 72,"Password must be at most 72 UTF-8 bytes.")
  .regex(/[A-Z]/,"Password must contain an uppercase letter")
  .regex(/[a-z]/,"Password must contain a lowercase letter")
  .regex(/[0-9]/,"Password must contain a number");
const otp = z.string().regex(/^\d{6}$/,"A six-digit code is required.");
export const authSchemas = {
  register: z.object({ name: z.string().trim().min(2).max(50),email,password }).strict(),
  login: z.object({ email,password: z.string().min(1).max(72) }).strict(),
  email: z.object({ email }).strict(),
  verify: z.object({ email,otp }).strict(),
  reset: z.object({ email,otp,newPassword: password }).strict(),
  callback: z.object({ code: z.string().max(4096).optional(),state: z.string().max(256).optional(),error: z.string().max(256).optional() }),
};
