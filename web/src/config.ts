export type AppConfig = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

type ConfigInput = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

// Reads the browser configuration. Only public values belong here: the project URL and the
// publishable key. Secret keys never go into the website.
export function readConfig(env: ConfigInput): AppConfig {
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const supabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  const missing = [
    !supabaseUrl && "VITE_SUPABASE_URL",
    !supabasePublishableKey && "VITE_SUPABASE_PUBLISHABLE_KEY",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`Missing configuration: ${missing.join(", ")}`);
  }
  if (!supabaseUrl!.startsWith("https://")) {
    throw new Error("VITE_SUPABASE_URL must start with https://");
  }
  // The project URL has no path. A copied API URL such as ".../rest/v1/" would break every call.
  if (new URL(supabaseUrl!).pathname !== "/") {
    throw new Error("VITE_SUPABASE_URL must be the project URL only, like https://abc.supabase.co");
  }

  return { supabaseUrl: supabaseUrl!, supabasePublishableKey: supabasePublishableKey! };
}
