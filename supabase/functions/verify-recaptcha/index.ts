import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RECAPTCHA_SITE_KEY = "6Le2q2EsAAAAALT1XXCEYyPsT3gfauLb_0JgYXs7";
const GOOGLE_CLOUD_PROJECT_ID = "barbersoft";

interface RecaptchaRequest {
  token: string;
  action: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, action } = (await req.json()) as RecaptchaRequest;

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Token não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("RECAPTCHA_SECRET_KEY");
    if (!apiKey) {
      console.error("RECAPTCHA_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Configuração inválida" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use reCAPTCHA Enterprise API
    const verifyUrl = `https://recaptchaenterprise.googleapis.com/v1/projects/${GOOGLE_CLOUD_PROJECT_ID}/assessments?key=${apiKey}`;

    const response = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: {
          token,
          siteKey: RECAPTCHA_SITE_KEY,
          expectedAction: action,
        },
      }),
    });

    const result = await response.json();

    console.log(`reCAPTCHA Enterprise verification for action '${action}':`, JSON.stringify(result));

    if (!response.ok) {
      console.error("reCAPTCHA Enterprise API error:", JSON.stringify(result));
      return new Response(
        JSON.stringify({ success: false, error: "Erro na verificação", details: result.error?.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!result.tokenProperties?.valid) {
      console.error("Token invalid:", result.tokenProperties?.invalidReason);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Verificação falhou",
          errorCodes: [result.tokenProperties?.invalidReason || "invalid-token"],
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const score = result.riskAnalysis?.score ?? 1.0;
    if (score < 0.5) {
      console.warn(`Low reCAPTCHA score for action '${action}': ${score}`);
      return new Response(
        JSON.stringify({ success: false, error: "Verificação de segurança falhou", score }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, score, action: result.tokenProperties?.action }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error verifying reCAPTCHA:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
