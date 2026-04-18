import { Pool } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const schemaPath = resolve(__dirname, "..", "db", "schema.sql");
  const raw = readFileSync(schemaPath, "utf8");

  // Strip single-line comments, then split on semicolons
  const stripped = raw
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  const statements = stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    console.log(`Running: ${stmt.slice(0, 80).replace(/\s+/g, " ")}...`);
    await pool.query(stmt);
  }

  await pool.end();
  console.log("\nSchema applied successfully ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
