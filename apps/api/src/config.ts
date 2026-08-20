import path from "node:path";
import dotenv from "dotenv";

// Single .env at the repository root, shared by all workspaces.
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const REQUIRED_VARS = [
  "FORTYGUARD_API_KEY",
  "FORTYGUARD_BASE_URL",
  "ORS_API_KEY",
  "PORT"
] as const;

function failFast(missing: readonly string[]): never {
  console.error(
    [
      "[Aither API] Missing required environment variable(s):",
      ...missing.map((name) => `  - ${name}`),
      "",
      "Copy .env.example to .env at the repository root and fill in real values."
    ].join("\n")
  );
  process.exit(1);
}

const missing = REQUIRED_VARS.filter((name) => {
  const value = process.env[name];
  return value === undefined || value.trim() === "";
});

if (missing.length > 0) {
  failFast(missing);
}

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("[Aither API] PORT must be an integer between 1 and 65535.");
  process.exit(1);
}

let fortyguardBaseUrl: string;
try {
  fortyguardBaseUrl = new URL(process.env.FORTYGUARD_BASE_URL as string).toString();
} catch {
  console.error("[Aither API] FORTYGUARD_BASE_URL is not a valid URL.");
  process.exit(1);
}

export const config = {
  port,
  fortyguardApiKey: process.env.FORTYGUARD_API_KEY as string,
  fortyguardBaseUrl,
  orsApiKey: process.env.ORS_API_KEY as string
};