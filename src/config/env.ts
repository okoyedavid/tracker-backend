import dotenv from "dotenv";
import { z } from "zod";

const nodeEnv = process.env.NODE_ENV ?? "development";

dotenv.config({
  path: nodeEnv === "test" ? ".env.test" : ".env",
});

const optionalEnvString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).optional(),
);

const postgresUrlSchema = z.string().trim().url()
  .refine(value => /^postgres(?:ql)?:\/\//.test(value), {
    message: "Must be a postgres:// or postgresql:// connection URL",
  });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  DATABASE_URL: postgresUrlSchema.optional(),
  DATABASE_URL_POOLED: postgresUrlSchema.optional(),
  PADDLE_SERVER: z.string().url().default("http://127.0.0.1:8000/ocr"),
  GEMINI_API_KEY: optionalEnvString,
  GEMINI_MODEL: z.string().trim().min(1).default("gemini-3.5-flash-lite"),
  GEMINI_ALLOWED_MODELS: z.string().default("gemini-3.5-flash-lite,gemini-3.8-flash")
    .transform(value => value.split(",").map(model => model.trim()).filter(Boolean)),
  OCR_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(25000).default(25000),

  JWT_ACCESS_SECRET: z.preprocess(value => value === "" ? undefined : value, z.string().min(32).optional()),
  JWT_REFRESH_SECRET: z.preprocess(value => value === "" ? undefined : value, z.string().min(32).optional()),
  CLIENT_URL: z.string().url().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: optionalEnvString,
  GOOGLE_CLIENT_SECRET: optionalEnvString,
  GOOGLE_REDIRECT_URL: z.preprocess(value => value === "" ? undefined : value, z.string().url().optional()),
  RESEND_API_KEY: optionalEnvString,
  EMAIL_FROM: optionalEnvString,
  APP_NAME: z.string().trim().min(1).default("Receipt Tracker"),
  CLOUDINARY_CLOUD_NAME: optionalEnvString,
  CLOUDINARY_API_KEY: optionalEnvString,
  CLOUDINARY_API_SECRET: optionalEnvString,

});

export const env = envSchema.refine(value => value.GEMINI_ALLOWED_MODELS.includes(value.GEMINI_MODEL), {
  message: "GEMINI_MODEL must be included in GEMINI_ALLOWED_MODELS",
  path: ["GEMINI_MODEL"],
}).parse(process.env);
