import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = new URL(req.url);
    const path = (url.pathname.split("/warung-api/")[1] || "").replace(/\/$/, "");

    if (req.method === "GET" && path === "products") {
      const { data, error } = await admin.from("products").select("*").eq("is_available", true).order("name");
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    if (req.method === "POST" && path === "login") {
      const { email, password } = await req.json();
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      return new Response(await r.text(), { status: r.status, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return json({ error: "Unauthorized" }, 401);
    const { data: userData } = await admin.auth.getUser(token);
    if (!userData.user) return json({ error: "Unauthorized" }, 401);

    if (req.method === "POST" && path === "products") {
      const body = await req.json();
      const { data, error } = await admin.from("products").insert(body).select().single();
      if (error) return json({ error: error.message }, 400);
      return json(data, 201);
    }

    const match = path.match(/^products\/([^/]+)$/);
    if (match && (req.method === "PATCH" || req.method === "DELETE")) {
      const id = decodeURIComponent(match[1]);
      if (req.method === "DELETE") {
        const { error } = await admin.from("products").delete().eq("id", id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      const body = await req.json();
      const { data, error } = await admin.from("products").update(body).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
