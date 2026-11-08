import { useEffect, useState } from "react";
import { readConfig } from "./config";
import { fetchHealth, type Health } from "./health";

type Status =
  | { state: "loading" }
  | { state: "connected"; health: Health }
  | { state: "error"; message: string };

export function App() {
  const [status, setStatus] = useState<Status>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const config = readConfig({
          VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
          VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        });
        const health = await fetchHealth(config.supabaseUrl);
        if (!cancelled) setStatus({ state: "connected", health });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!cancelled) setStatus({ state: "error", message });
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="page">
      <h1>Impact Connect</h1>
      <p lang="nl">De studentengids komt eraan.</p>
      <p lang="en">The student guide is on its way.</p>
      <p className="status" role="status">
        {status.state === "loading" && "Checking the connection…"}
        {status.state === "connected" && `Connected to the ${status.health.environment} environment.`}
        {status.state === "error" && `Not connected: ${status.message}`}
      </p>
    </main>
  );
}
