import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), "../server/.env") });

function isPlaceholder(value: string | undefined) {
  if (!value) {
    return true;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized.includes("your_db_");
}

function buildDatabaseUrlFromParts() {
  const host = process.env.DB_HOST?.trim();
  const port = process.env.DB_PORT?.trim() || "5432";
  const name = process.env.DB_NAME?.trim();
  const user = process.env.DB_USER?.trim();
  const password = process.env.DB_PASSWORD?.trim();

  if (
    isPlaceholder(host) ||
    isPlaceholder(name) ||
    isPlaceholder(user) ||
    isPlaceholder(password)
  ) {
    return "";
  }

  const encodedUser = encodeURIComponent(user as string);
  const encodedPassword = encodeURIComponent(password as string);
  const requiresSsl = host?.includes("supabase.com");
  const query = requiresSsl ? "?sslmode=require" : "";

  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${name}${query}`;
}

const explicitUrl = process.env.DATABASE_URL?.trim() ?? "";
const databaseUrl = explicitUrl || buildDatabaseUrlFromParts();
const commandLine = process.argv.join(" ").toLowerCase();
const isGenerateCommand = commandLine.includes("generate");
const requiresLiveConnection = !isGenerateCommand;

if (!databaseUrl && requiresLiveConnection) {
  throw new Error(
    "Missing database connection. Set DATABASE_URL in database/.env or real DB_* values in server/.env."
  );
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl || "postgresql://postgres:postgres@localhost:5432/postgres"
  }
});
