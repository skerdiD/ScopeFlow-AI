import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

function csv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function normalizeOrigin(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8000),
  API_PREFIX: z.string().default("/api"),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  FRONTEND_URL: z.string().optional(),
  VERCEL_URL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_AUTH_CACHE_TTL: z.coerce.number().int().min(0).default(30),
  JSON_BODY_LIMIT: z.string().default("1mb"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  DEMO_ACCOUNT_EMAIL: z.string().email().default("demo@scopeflow.ai")
});

const parsedEnv = rawEnvSchema.parse(process.env);

const derivedOrigins = [
  ...csv(parsedEnv.CORS_ALLOWED_ORIGINS),
  normalizeOrigin(parsedEnv.FRONTEND_URL),
  normalizeOrigin(parsedEnv.VERCEL_URL)
].filter((origin): origin is string => Boolean(origin));

const devOrigins =
  parsedEnv.NODE_ENV === "production"
    ? []
    : [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
        "http://127.0.0.1:3000",
        "http://localhost:3000"
      ];

export const env = {
  ...parsedEnv,
  API_PREFIX: parsedEnv.API_PREFIX.startsWith("/") ? parsedEnv.API_PREFIX : `/${parsedEnv.API_PREFIX}`,
  CORS_ALLOWED_ORIGINS: Array.from(new Set([...derivedOrigins, ...devOrigins])),
  DEMO_ACCOUNT_EMAIL: parsedEnv.DEMO_ACCOUNT_EMAIL.trim().toLowerCase()
};

export type AppEnv = typeof env;
