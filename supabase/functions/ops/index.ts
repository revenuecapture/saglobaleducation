// ops: the narrow set of database jobs the repository's GitHub Actions need, with no
// secret stored in GitHub. Each job sends the short-lived OpenID Connect token GitHub issues
// for that run; this function checks GitHub's signature and that the run comes from the
// main branch of revenuecapture/saglobaleducation, then acts with the service role, which
// never leaves Supabase.
//
// Operations (POST JSON { op, ... }):
//   published         { table, slugs }          -> slugs of those rows already published
//   upsert_drafts     { table, rows }           -> courses or scholarships, always unpublished;
//                                                  rows a reviewer already published are skipped
//   patch_university  { slug, values }          -> researched fields of one university
//   patch_destination { code, values }          -> post-study work text of one destination
//   export            { table }                 -> catalogue tables only, for backups (no leads)
//   rebuild           {}                        -> calls the Cloudflare Pages deploy hook
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";

const REPO = "revenuecapture/saglobaleducation";
const AUDIENCE = "sa-global-ops";
const JWKS = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));

const DRAFT_TABLES = new Set(["courses", "scholarships"]);
const EXPORT_TABLES: Record<string, string> = {
  fields: "slug", destinations: "code", universities: "slug", courses: "slug", scholarships: "slug", grade_equivalences: "id",
};
const UNI_COLS = new Set(["name", "city", "region", "website_url", "international_admissions_url", "scholarships_url", "summary",
  "is_russell_group", "russell_group_source_url", "eligibility_note", "eligibility_source_url", "source_url", "verified_on",
  "review_notes"]);
const DEST_COLS = new Set(["post_study_work_summary", "post_study_work_source_url", "post_study_work_verified_on"]);
const SLUG = /^[a-z0-9-]{1,120}$/;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function only(values: Record<string, unknown>, allowed: Set<string>) {
  return Object.fromEntries(Object.entries(values || {}).filter(([k]) => allowed.has(k)));
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
  if (req.method !== "POST") return json(405, { error: "POST only" });

  // 1. Who is calling: a GitHub Actions run on main in this repository, or nobody.
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: "https://token.actions.githubusercontent.com", audience: AUDIENCE });
    if (payload.repository !== REPO || payload.ref !== "refs/heads/main") return json(403, { error: "wrong repository or branch" });
  } catch {
    return json(401, { error: "not a valid GitHub Actions token" });
  }

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json(400, { error: "bad JSON" }); }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), { auth: { persistSession: false } });

  // 2. What they may do.
  switch (body.op) {
    case "published": {
      if (!DRAFT_TABLES.has(body.table)) return json(400, { error: "table" });
      const slugs = (body.slugs || []).filter((s: string) => SLUG.test(s)).slice(0, 500);
      const { data, error } = await db.from(body.table).select("slug").in("slug", slugs).eq("is_published", true);
      return error ? json(500, { error: error.message }) : json(200, { published: (data || []).map((r) => r.slug) });
    }
    case "upsert_drafts": {
      if (!DRAFT_TABLES.has(body.table)) return json(400, { error: "table" });
      const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, 200)
        .filter((r: any) => r && SLUG.test(r.slug))
        .map((r: any) => ({ ...r, is_published: false }));
      if (!rows.length) return json(200, { written: 0, skipped: [] });
      const { data: pub } = await db.from(body.table).select("slug").in("slug", rows.map((r: any) => r.slug)).eq("is_published", true);
      const published = new Set((pub || []).map((r) => r.slug));
      const keep = rows.filter((r: any) => !published.has(r.slug));
      if (keep.length) {
        const { error } = await db.from(body.table).upsert(keep, { onConflict: "slug" });
        if (error) return json(500, { error: error.message });
      }
      return json(200, { written: keep.length, skipped: [...published] });
    }
    case "patch_university": {
      if (!SLUG.test(body.slug || "")) return json(400, { error: "slug" });
      const { data, error } = await db.from("universities").update(only(body.values, UNI_COLS)).eq("slug", body.slug).select("id");
      return error ? json(500, { error: error.message }) : json(200, { id: data && data[0] ? data[0].id : null });
    }
    case "patch_destination": {
      if (!/^[A-Z]{2}$/.test(body.code || "")) return json(400, { error: "code" });
      const { error } = await db.from("destinations").update(only(body.values, DEST_COLS)).eq("code", body.code);
      return error ? json(500, { error: error.message }) : json(200, { ok: true });
    }
    case "export": {
      const order = EXPORT_TABLES[body.table];
      if (!order) return json(400, { error: "table" });
      const all: unknown[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db.from(body.table).select("*").order(order).range(from, from + 999);
        if (error) return json(500, { error: error.message });
        all.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      return json(200, { rows: all });
    }
    case "rebuild": {
      const hook = Deno.env.get("CF_DEPLOY_HOOK");
      if (!hook) return json(409, { error: "CF_DEPLOY_HOOK is not set in Supabase yet" });
      const r = await fetch(hook, { method: "POST" });
      return json(r.ok ? 200 : 502, { status: r.status });
    }
    default:
      return json(400, { error: "unknown op" });
  }
});
