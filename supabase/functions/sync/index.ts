import { handleSync } from "./handler.ts";
import { databaseSaver } from "./store.ts";

Deno.serve((request) =>
  handleSync(request, {
    environment: Deno.env.get("APP_ENV"),
    syncSecret: Deno.env.get("SYNC_SECRET"),
    save: databaseSaver(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SECRET_KEYS")),
  })
);
