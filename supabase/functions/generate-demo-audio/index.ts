import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slideIndex, text } = await req.json();

    if (slideIndex === undefined || slideIndex === null) {
      throw new Error("slideIndex is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const fileName = `slide-${slideIndex}.mp3`;

    // Check if audio already exists in storage
    const { data: existingFile } = await supabase.storage
      .from("demo-audio")
      .list("", { search: fileName });

    const fileExists = existingFile && existingFile.some((f) => f.name === fileName);

    if (fileExists) {
      const { data: urlData } = supabase.storage
        .from("demo-audio")
        .getPublicUrl(fileName);

      return new Response(
        JSON.stringify({ audioUrl: urlData.publicUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Audio doesn't exist - generate via ElevenLabs
    if (!text) {
      throw new Error("text is required for first-time audio generation");
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    const voiceId = "onwK4e9ZLuTAKqWW03F9"; // Daniel - Portuguese voice

    console.log(`Generating audio for slide ${slideIndex}, text length: ${text.length}`);

    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error("ElevenLabs API error:", ttsResponse.status, errorText);
      throw new Error(`ElevenLabs API error: ${ttsResponse.status}`);
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("demo-audio")
      .upload(fileName, audioBytes, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from("demo-audio")
      .getPublicUrl(fileName);

    console.log(`Audio for slide ${slideIndex} generated and saved: ${urlData.publicUrl}`);

    return new Response(
      JSON.stringify({ audioUrl: urlData.publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-demo-audio error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
