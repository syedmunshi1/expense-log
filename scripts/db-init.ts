import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Set it in .env.local or export it.");
    process.exit(1);
  }

  const sql = neon(url);
  const schemaPath = resolve(__dirname, "..", "db", "schema.sql");
  const schema = readFileSync(schemaPath, "utf8");

  // Neon's serverless driver requires statements to be executed one at a time.
  const statements = schema
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    console.log(`Running: ${stmt.slice(0, 80).replace(/\s+/g, " ")}...`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sql as any).query(stmt);
  }

  console.log("Schema applied successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
