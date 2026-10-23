import { pgConfig } from "@rtorcato/db-drizzle/config";

// For the db:* scripts. `generate` only reads the schema, so it runs without a
// database; migrate and studio need DATABASE_URL.
export default pgConfig({
  schema: "./src/lib/history-schema.ts",
  url: process.env.DATABASE_URL ?? "",
});
