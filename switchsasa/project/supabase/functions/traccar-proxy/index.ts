const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TRACCAR_URL = "http://84.247.172.135:8082";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = body.action;
    const authHeader = `Basic ${btoa(`${body.email}:${body.password}`)}`;

    if (action === "devices") {
      const res = await fetch(`${TRACCAR_URL}/api/devices`, { headers: { Authorization: authHeader } });
      if (!res.ok) throw new Error(`Traccar returned ${res.status}`);
      return json(await res.json());
    }
    if (action === "positions") {
      const res = await fetch(`${TRACCAR_URL}/api/positions`, { headers: { Authorization: authHeader } });
      if (!res.ok) throw new Error(`Traccar returned ${res.status}`);
      return json(await res.json());
    }
    if (action === "session") {
      const res = await fetch(`${TRACCAR_URL}/api/session`, { headers: { Authorization: authHeader } });
      if (!res.ok) throw new Error("Traccar login failed. Check your credentials.");
      return json({ success: true });
    }
    return json({ error: "Unsupported action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Traccar service unavailable.";
    return json({ error: message }, 502);
  }
});
