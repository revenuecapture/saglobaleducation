// submit-lead: receives enquiries from the course finder and the scholarship finder.
//
// - Accepts POST JSON from saglobal.org (and its Cloudflare preview links) only.
// - Validates and trims every field, strips control characters, and length-limits everything.
// - Quietly drops obvious bots (filled honeypot field, or a form sent within two seconds).
// - Rate-limits each source to 5 enquiries an hour using a salted hash, never the raw IP address.
// - Saves the enquiry with the service role. The browser can never read the leads table.
// - Optionally forwards a copy to LEAD_WEBHOOK_URL (for example a Google Apps Script that adds a
//   row to a Sheet and emails the team). A failed forward never loses the enquiry.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED = [
  /^https:\/\/(www\.)?saglobal\.org$/,
  /^https:\/\/([a-z0-9-]+\.)?saglobaleducation\.pages\.dev$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cors(origin: string | null): Record<string, string> {
  const ok = origin && ALLOWED.some((re) => re.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : "https://saglobal.org",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function reply(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
}
function clean(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
  return s.length ? s : null;
}
function cleanList(v: unknown, max: number, each: number): string[] {
  return Array.isArray(v) ? v.map((x) => clean(x, each)).filter((x): x is string => !!x).slice(0, max) : [];
}
function cleanObject(v: unknown, maxKeys: number): Record<string, string> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>).slice(0, maxKeys)) {
    const key = clean(k, 40), value = typeof val === "number" || typeof val === "boolean" ? String(val) : clean(val, 120);
    if (key && value) out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}
async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Prefer the new secret API key (SUPABASE_SECRET_KEYS, named "default"); fall back to the legacy
// service role key until the legacy keys are switched off in the dashboard.
function serviceKey(): string {
  try {
    const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    if (k && typeof k.default === "string") return k.default;
  } catch { /* not set yet */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return reply(405, { ok: false }, origin);
  if (!origin || !ALLOWED.some((re) => re.test(origin))) return reply(403, { ok: false }, origin);

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 20000) return reply(413, { ok: false }, origin);
    body = JSON.parse(raw);
  } catch {
    return reply(400, { ok: false }, origin);
  }

  // Bots: answer as if it worked, store nothing.
  if (clean(body.website, 200) || (typeof body.elapsed_ms === "number" && body.elapsed_ms < 2000)) {
    return reply(200, { ok: true }, origin);
  }

  const full_name = clean(body.full_name, 120);
  const whatsapp = clean(body.whatsapp, 30);
  const email = clean(body.email, 160);
  if (!full_name || (!whatsapp && !email) || body.consent_privacy !== true) return reply(422, { ok: false }, origin);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(422, { ok: false }, origin);
  if (whatsapp && !/^[+0-9 ()-]{6,30}$/.test(whatsapp)) return reply(422, { ok: false }, origin);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), {
    auth: { persistSession: false },
  });

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const ip_hash = await sha256(ip + "|" + (Deno.env.get("LEAD_HASH_SALT") || serviceKey()));
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from("lead_attempts").select("id", { count: "exact", head: true })
    .eq("ip_hash", ip_hash).gte("created_at", hourAgo);
  if ((count ?? 0) >= 5) return reply(429, { ok: false }, origin);
  await db.from("lead_attempts").insert({ ip_hash });

  const finder = clean(body.source_finder, 20);
  const profile = body.eligibility_profile && typeof body.eligibility_profile === "object"
    ? cleanObject(body.eligibility_profile, 20) : null;
  const lead = {
    source_finder: finder === "course" || finder === "scholarship" ? finder : "contact",
    full_name, whatsapp, email,
    country_of_residence: clean(body.country_of_residence, 60),
    level_of_study: clean(body.level_of_study, 40),
    budget_range: clean(body.budget_range, 40),
    intended_intake: clean(body.intended_intake, 40),
    english_status: clean(body.english_status, 40),
    message: clean(body.message, 1500),
    course_ids: cleanList(body.course_ids, 30, 40).filter((x) => UUID.test(x)),
    scholarship_ids: cleanList(body.scholarship_ids, 30, 40).filter((x) => UUID.test(x)),
    item_names: cleanList(body.item_names, 30, 200),
    eligibility_profile: profile,
    source_page: clean(body.source_page, 200),
    utm: cleanObject(body.utm, 10),
    consent_privacy: true,
    consent_text_version: clean(body.consent_text_version, 20) || "unknown",
    consent_marketing: body.consent_marketing === true,
    ip_hash,
  };

  const { data, error } = await db.from("leads").insert(lead).select("id, created_at").single();
  if (error) {
    console.error("lead insert failed", error.message);
    return reply(500, { ok: false }, origin);
  }

  const hook = Deno.env.get("LEAD_WEBHOOK_URL");
  if (hook) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      await fetch(hook, {
        method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lead, ip_hash: undefined, id: data.id, created_at: data.created_at }),
      });
      clearTimeout(t);
    } catch (e) {
      console.error("lead webhook failed", String(e)); // the lead is already saved
    }
  }

  return reply(200, { ok: true }, origin);
});
