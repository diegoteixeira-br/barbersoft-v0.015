import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid token");

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .single();

    if (!roleData) throw new Error("Unauthorized: super_admin required");

    const { title, slug, excerpt, image_url } = await req.json();
    if (!title || !slug) throw new Error("title and slug are required");

    // Get all active company owner user IDs
    const { data: companies, error: compErr } = await supabaseAdmin
      .from("companies")
      .select("owner_user_id")
      .eq("is_blocked", false);

    if (compErr) throw compErr;

    const ownerIds = [...new Set((companies || []).map((c: any) => c.owner_user_id))];

    if (ownerIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, failed: 0, message: "No users to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get emails via admin API
    const { data: { users: allUsers }, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });
    if (usersErr) throw usersErr;

    const ownerSet = new Set(ownerIds);
    const emails = allUsers
      .filter((u: any) => ownerSet.has(u.id) && u.email)
      .map((u: any) => u.email);

    if (emails.length === 0) {
      return new Response(JSON.stringify({ sent: 0, failed: 0, message: "No emails found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const articleUrl = `https://barbersoft.com.br/blog/${slug}`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#FF6B00,#FF8C33);padding:30px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:24px;">✂️ BarberSoft</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Novo artigo no blog!</p>
        </td></tr>
        ${image_url ? `<tr><td><img src="${image_url}" alt="${title}" style="width:100%;height:auto;display:block;" /></td></tr>` : ""}
        <!-- Content -->
        <tr><td style="padding:30px;">
          <h2 style="margin:0 0 16px;color:#fff;font-size:22px;">${title}</h2>
          ${excerpt ? `<p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">${excerpt}</p>` : ""}
          <a href="${articleUrl}" style="display:inline-block;background:#FF6B00;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
            Ler Artigo Completo →
          </a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 30px;border-top:1px solid #334155;">
          <p style="margin:0;color:#64748b;font-size:12px;text-align:center;">
            Você recebeu este email porque possui uma conta na BarberSoft.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    let sent = 0;
    let failed = 0;

    // Send in batches of 10
    const batchSize = 10;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((email: string) =>
          fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "BarberSoft <noreply@barbersoft.com.br>",
              to: [email],
              subject: `📰 Novo artigo: ${title}`,
              html: emailHtml,
            }),
          })
        )
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value.ok) {
          sent++;
        } else {
          failed++;
        }
      }
    }

    return new Response(JSON.stringify({ sent, failed, total: emails.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
