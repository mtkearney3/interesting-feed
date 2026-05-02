/**
 * Applies url_article_text + last_enrichment_pipeline to public.captures.
 * Requires DATABASE_URL in .env.local (Supabase Dashboard → Connect → URI, use Session or Direct).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvLocal() {
  const p = join(root, ".env.local");
  if (!existsSync(p)) {
    throw new Error("Missing .env.local");
  }
  const out = {};
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = loadEnvLocal();
const url =
  env.DATABASE_URL || env.DIRECT_URL || env.SUPABASE_DB_URL || "";
if (!url) {
  console.error(
    "Missing DATABASE_URL (or DIRECT_URL / SUPABASE_DB_URL) in .env.local.\n" +
      "Supabase Dashboard → Project Settings → Database → Connection string → URI.\n" +
      "Or run the SQL in supabase/manual_apply_capture_columns.sql in the SQL Editor."
  );
  process.exit(1);
}

const sqlPath = join(root, "supabase", "manual_apply_capture_columns.sql");
const sql = readFileSync(sqlPath, "utf8");

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
} finally {
  await client.end();
}

const verify = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
});
await verify.connect();
const { rows } = await verify.query(
  `select column_name
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'captures'
     and column_name in ('url_article_text','last_enrichment_pipeline')`
);
await verify.end();

const names = new Set(rows.map((r) => r.column_name));
if (!names.has("url_article_text") || !names.has("last_enrichment_pipeline")) {
  console.error("Verification failed; columns:", [...names]);
  process.exit(1);
}

console.log("OK: public.captures has url_article_text and last_enrichment_pipeline.");
