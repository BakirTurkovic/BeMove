const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "GEMINI_API_KEY nije postavljen u Supabase Secrets." }, 500);
    }

    const body: unknown = await req.json();
    if (typeof body !== "object" || body === null) {
      return jsonResponse({ error: "Zahtjev mora sadržavati JSON objekat." }, 400);
    }

    const { imageBase64, mimeType } = body as { imageBase64?: unknown; mimeType?: unknown };
    if (typeof imageBase64 !== "string" || !imageBase64.trim()) {
      return jsonResponse({ error: "Nedostaje imageBase64 slike obroka." }, 400);
    }

    if (mimeType !== undefined && (typeof mimeType !== "string" || !allowedMimeTypes.has(mimeType))) {
      return jsonResponse({ error: "Format slike nije podržan. Koristi JPEG, PNG ili WebP." }, 400);
    }
    const normalizedMimeType = typeof mimeType === "string" ? mimeType : "image/jpeg";
    const normalizedImage = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
    if (!normalizedImage || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalizedImage)) {
      return jsonResponse({ error: "Slika nije validan Base64 sadržaj." }, 400);
    }
    if (normalizedImage.length > 8_000_000) {
      return jsonResponse({ error: "Slika nije validan Base64 sadržaj ili je prevelika." }, 400);
    }

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          model: "gemini-3.8-flash",
          input: [
            {
              type: "text",
              text: [
                "Analiziraj fotografiju hrane i procijeni nutritivne vrijednosti za prikazanu porciju.",
                "Vrati isključivo JSON objekat, bez Markdowna, u formatu:",
                '{"meal_name":"naziv jela","calories":0,"protein":0,"carbs":0,"fats":0,"weight_g":0,"opinion":"kratak komentar o nutritivnoj vrijednosti"}',
                "Sve nutritivne vrijednosti i gramaža moraju biti nenegativni brojevi.",
              ].join(" "),
            },
            {
              type: "image",
              data: normalizedImage,
              mime_type: normalizedMimeType,
            },
          ],
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: {
              type: "object",
              properties: {
                meal_name: { type: "string" },
                calories: { type: "number" },
                protein: { type: "number" },
                carbs: { type: "number" },
                fats: { type: "number" },
                weight_g: { type: "number" },
                opinion: { type: "string" },
              },
              required: ["meal_name", "calories", "protein", "carbs", "fats", "weight_g", "opinion"],
            },
          },
        }),
      },
    );

    const geminiData: unknown = await geminiResponse.json();
    if (!geminiResponse.ok) {
      const upstreamMessage = typeof geminiData === "object" && geminiData !== null
        ? (geminiData as { error?: { message?: unknown } }).error?.message
        : null;
      const details = typeof upstreamMessage === "string"
        ? upstreamMessage
        : `Gemini API je vratio HTTP ${geminiResponse.status}.`;
      console.error("Gemini API request failed:", geminiResponse.status, details);
      return jsonResponse({
        error: "Gemini API nije mogao analizirati fotografiju.",
        details,
        upstreamStatus: geminiResponse.status,
      }, 502);
    }

    if (typeof geminiData !== "object" || geminiData === null) {
      return jsonResponse({ error: "Gemini je vratio neispravan odgovor." }, 502);
    }
    const interaction = geminiData as {
      output_text?: unknown;
      output?: Array<{ text?: unknown; content?: Array<{ text?: unknown }> }>;
    };
    const text = typeof interaction.output_text === "string"
      ? interaction.output_text.trim()
      : interaction.output?.flatMap((item) => [
        ...(typeof item.text === "string" ? [item.text] : []),
        ...(item.content?.flatMap((content) => typeof content.text === "string" ? [content.text] : []) ?? []),
      ]).join("").trim();
    if (!text) {
      return jsonResponse({ error: "Gemini nije vratio rezultat analize." }, 502);
    }

    let analysis: unknown;
    try {
      analysis = JSON.parse(text);
    } catch {
      console.error("Gemini returned non-JSON meal analysis:", text);
      return jsonResponse({ error: "Gemini je vratio neispravan JSON rezultat." }, 502);
    }

    if (
      typeof analysis !== "object" ||
      analysis === null ||
      typeof (analysis as { meal_name?: unknown }).meal_name !== "string" ||
      !["calories", "protein", "carbs", "fats", "weight_g"].every((key) => {
        const value = (analysis as Record<string, unknown>)[key];
        return typeof value === "number" && Number.isFinite(value) && value >= 0;
      })
    ) {
      return jsonResponse({ error: "Gemini analiza ne sadrži očekivane nutritivne podatke." }, 502);
    }

    return jsonResponse(analysis as Record<string, unknown>);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Nepoznata greška.";
    console.error("analyze-meal request failed:", details);
    if (error instanceof SyntaxError) {
      return jsonResponse({ error: "Zahtjev mora sadržavati validan JSON." }, 400);
    }
    if (error instanceof Error && error.name === "TimeoutError") {
      return jsonResponse({ error: "Analiza je istekla. Pokušaj ponovo." }, 504);
    }
    return jsonResponse({
      error: "Analiza obroka trenutno nije uspjela.",
      details,
    }, 500);
  }
});
