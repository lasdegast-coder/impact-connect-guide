import { handleHealth } from "./handler.ts";

Deno.serve((request) => handleHealth(request, Deno.env.get("APP_ENV")));
