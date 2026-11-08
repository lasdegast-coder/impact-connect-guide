import { corsHeaders } from "../_shared/cors.ts";

// Tells the website which environment it is talking to. APP_ENV is set by scripts/deploy.mjs.
export function handleHealth(request: Request, environment: string | undefined): Response {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return Response.json({ ok: true, environment: environment ?? "unknown" }, { headers: corsHeaders });
}
