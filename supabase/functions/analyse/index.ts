import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANALYSE_SYSTEM_PROMPT = `You are Chroma, an expert colour season analyst with deep knowledge of seasonal colour theory, skin tone analysis, and personal styling. You analyse selfies to determine a person's colour season and provide a complete, personalised colour guide.

You must always respond with valid JSON only. No preamble, no explanation, no markdown fences. Only the raw JSON object.

ANALYSIS METHOD:
Examine the image for: skin undertone (warm/cool/neutral), skin depth (light/medium/deep), eye colour and pattern, natural hair colour, contrast level between features. Use these to determine the season.

SEASONS:
- Spring: warm undertone, clear/bright colouring, low-medium contrast
- Summer: cool undertone, muted/soft colouring, low-medium contrast
- Autumn: warm undertone, muted/earthy colouring, medium-high contrast
- Winter: cool undertone, clear/deep colouring, high contrast

CONFIDENCE RULES:
- Image is clear and features fully readable: confidence 75-98, low_confidence: false
- Image slightly dark, angled, or partially obscured: confidence 55-74, low_confidence: true
- Image unusable (sunglasses, extreme filter, too dark, no face): confidence below 55, low_confidence: true, still return best guess or set no_face: true

RESPONSE — return exactly this JSON shape:
{
  "season": "Spring|Summer|Autumn|Winter",
  "subseason": "True Spring|Light Spring|Bright Spring|True Summer|Light Summer|Soft Summer|True Autumn|Soft Autumn|Dark Autumn|True Winter|Bright Winter|Dark Winter",
  "confidence": 0-100,
  "low_confidence": false,
  "no_face": false,
  "retake_reason": null,
  "headline": "A single evocative sentence describing this person's colouring. Personal, warm, specific. Max 12 words.",
  "colour_profile": {
    "undertone": "Warm|Cool|Neutral",
    "depth": "Light|Medium|Deep",
    "chroma": "Bright|Muted|Soft",
    "contrast": "Low|Medium|High",
    "defining_quality": "One evocative phrase describing the dominant colour characteristic e.g. 'Warm & Golden', 'Cool & Delicate', 'Deep & Intense'",
    "season_description": "2-3 sentences explaining what makes this person's colouring unique within their season. Personal and specific."
  },
  "palette": {
    "base": [
      { "name": "colour name", "hex": "#RRGGBB" }
    ],
    "accent": [
      { "name": "colour name", "hex": "#RRGGBB" }
    ],
    "best": [
      { "name": "colour name", "hex": "#RRGGBB" }
    ],
    "avoid": [
      { "name": "colour name", "hex": "#RRGGBB" }
    ]
  },
  "makeup": {
    "foundation": "Undertone guidance and finish recommendation. 2 sentences.",
    "blush": "Ideal blush family with 1-2 shade examples. 2 sentences.",
    "lip": "Lip colour family, finish, and specific shade examples. 2-3 sentences.",
    "eye": "Eyeshadow palette direction, liner colour, mascara recommendation. 3 sentences."
  },
  "hair": {
    "best_colours": ["4-5 specific shade names that suit this season"],
    "avoid": ["2-3 specific shade names to avoid"],
    "tip": "Hair colour advice including what to ask for at the salon. 3 sentences."
  },
  "jewellery": {
    "metals": ["2-3 metal types"],
    "stones": ["3-4 gemstone or stone types"],
    "tip": "Jewellery style direction. 2 sentences."
  },
  "style": {
    "silhouettes": "Silhouette and cut guidance for this season's energy. 2-3 sentences.",
    "patterns": "Pattern direction — scale, style, repeat type. 2-3 sentences.",
    "fabrics": "Fabric weight, texture and finish recommendations. 2-3 sentences.",
    "tip": "One overarching style philosophy sentence for this season."
  },
  "body_shape": "Apple|Pear|Hourglass|Rectangle|Inverted Triangle|Oval",
  "daily_tip": "One short specific actionable tip for today tied to their season. Max 20 words."
}

PALETTE RULES:
- base: exactly 4 colour objects — these are neutrals (blacks, whites, navys, creams, taupes, browns) adjusted for the season. These form the foundation of the wardrobe.
- accent: exactly 4 colour objects — these are mid-range colours that complement the base and add interest without overwhelming.
- best: exactly 8 colour objects — these are the season's hero colours, the most flattering and vibrant options.
- avoid: exactly 5 colour objects
- All hex values must be valid 6-digit hex codes
- Colour names must be specific and evocative, not generic

If low_confidence is true, set retake_reason to one of:
"poor_lighting" | "sunglasses" | "extreme_filter" | "face_angle" | "image_quality"

If no face is detected at all, set no_face: true and return:
{ "no_face": true, "error": "no_face_detected" }`;

const CHECK_ITEM_SYSTEM_PROMPT = `You are Chroma, an expert colour season analyst. You are given an image of a clothing item, a full outfit, or fabric/colour swatches, and the user's confirmed colour season. Your job is to assess whether the colour(s) in the image suit their season.

You must always respond with valid JSON only. No preamble, no markdown fences. Only the raw JSON object.

VERDICT RULES:
- Base verdict purely on whether the colour suits the user's season
- Consider undertone match, saturation level, and depth
- Be decisive — avoid hedging in the reason field
- The hex should reflect the actual dominant colour of each item
- Colour names must be specific and evocative (e.g. "Dusty Rose" not "Pink")

For SINGLE ITEM mode, return:
{
  "mode": "single",
  "items": [
    {
      "colour_name": "specific colour name",
      "hex": "#RRGGBB",
      "verdict": true,
      "reason": "One sentence explaining why it does or does not suit their season.",
      "tip": "If verdict false: one sentence alternative suggestion. If verdict true: one sentence on how to wear it."
    }
  ]
}

For SWATCH mode, return the same shape but with one object per distinct swatch colour visible in the image. The user may be holding swatches against their skin — identify each distinct colour separately.
{
  "mode": "swatch",
  "items": [
    {
      "colour_name": "specific colour name",
      "hex": "#RRGGBB",
      "verdict": true,
      "reason": "One sentence explanation.",
      "tip": "One sentence on how to wear it or what to choose instead."
    }
  ]
}

For OUTFIT mode, identify each distinct garment or accessory visible separately. Assess the outfit as a whole and each piece individually.
{
  "mode": "outfit",
  "overall_verdict": true,
  "overall_tip": "One sentence on the outfit as a whole.",
  "items": [
    {
      "piece": "Top|Bottom|Dress|Shoes|Bag|Accessory|Outerwear",
      "colour_name": "specific colour name",
      "hex": "#RRGGBB",
      "verdict": true,
      "reason": "One sentence explanation.",
      "tip": "If verdict false: one sentence swap suggestion. If verdict true: one sentence styling tip."
    }
  ]
}

OUTFIT RULES:
- Identify every visible garment and accessory as a separate item
- overall_verdict is true only if the majority of pieces suit the season
- Be specific about piece type in the piece field
- Consider how pieces work together, not just individually`;

function buildAnalyseMessages(imageBase64: string, bodyShape?: string) {
  return [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: imageBase64,
          },
        },
        {
          type: "text",
          text: `Analyse this person's colour season. ${bodyShape ? `The user has identified their body shape as ${bodyShape} — use this in your style recommendations.` : ""} Return JSON only.`,
        },
      ],
    },
  ];
}

function buildCheckItemMessages(imageBase64: string, season: string, mode: string, swatchLabel?: string) {
  const modeInstructions: Record<string, string> = {
    single: "Check this single clothing item against my season.",
    swatch: `Check each colour swatch visible in this image against my season. I may be holding swatches against my skin.${swatchLabel ? ` These swatches are: ${swatchLabel}.` : ""}`,
    outfit: "Check this full outfit against my season. Identify each garment and accessory separately.",
  };

  const instruction = modeInstructions[mode] || modeInstructions.single;

  return [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: imageBase64,
          },
        },
        {
          type: "text",
          text: `My colour season is ${season}. ${instruction} Return JSON only.`,
        },
      ],
    },
  ];
}

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function successResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      type: string;
      image?: string;
      season?: string;
      subseason?: string;
      mode?: string;
      swatchLabel?: string;
      message?: string;
      history?: Array<{ role: string; content: string }>;
      body_shape?: string;
      wardrobe?: string;
      undertone?: string;
      chroma?: string;
      depth?: string;
    };

    const { type, image, season, mode, swatchLabel } = body;

    if (!type || (type !== "analyse" && type !== "check_item" && type !== "stylist_chat" && type !== "extended_palette")) {
      return errorResponse("Invalid type. Must be 'analyse', 'check_item', 'stylist_chat', or 'extended_palette'.");
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return errorResponse("Server configuration error.", 500);
    }

    if (type === "stylist_chat") {
      const { message, history, season: chatSeason, subseason, body_shape, wardrobe } = body;
      const stylistMessages = [
        ...(history || []),
        { role: "user", content: message }
      ];
      const response = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1000,
          system: `You are Chroma, a warm and knowledgeable personal AI stylist. The user's colour season is ${chatSeason} (${subseason}). Their body shape is ${body_shape || "unknown"}. Their wardrobe contains: ${wardrobe || "no items yet"}. Give specific, warm, practical styling advice. Reference their actual wardrobe items by name when relevant. Keep responses concise and actionable. Plain text only, no markdown.`,
          messages: stylistMessages,
        }),
      });
      const anthropicData = await response.json() as { content: Array<{ type: string; text: string }>; error?: { message: string } };
      if (anthropicData.error) return errorResponse(anthropicData.error.message, 502);
      const textBlock = anthropicData.content?.find((c) => c.type === "text");
      return successResponse({ reply: textBlock?.text || "I couldn't generate a response." });
    }
    if (type === "extended_palette") {
      const { season, subseason, undertone, chroma, depth } = body;
      const response = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2000,
          system: `You are a colour season expert. Return valid JSON only. No preamble, no markdown.`,
          messages: [{
            role: "user",
            content: `Generate an extended colour palette for a ${season} (${subseason}) with ${undertone} undertone, ${chroma} chroma and ${depth} depth. Return exactly 24 colours organised across these categories: casuals (8 colours), workwear (6 colours), evening (5 colours), accessories (5 colours). Each colour must be specific, evocative and genuinely suit this season. Return this exact JSON shape: { "colours": [ { "name": "colour name", "hex": "#RRGGBB", "category": "casuals|workwear|evening|accessories" } ] }`
          }],
        }),
      });
      const anthropicData = await response.json() as { content: Array<{ type: string; text: string }>; error?: { message: string } };
      if (anthropicData.error) return errorResponse(anthropicData.error.message, 502);
      const textBlock = anthropicData.content?.find((c) => c.type === "text");
      if (!textBlock?.text) return errorResponse("No response from AI.", 502);
      const cleaned = textBlock.text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
      try {
        const parsed = JSON.parse(cleaned);
        return successResponse(parsed);
      } catch {
        return errorResponse("Invalid response from AI.", 502);
      }
    }
    if (!image) {
      return errorResponse("Missing image field. Must be base64 encoded image.");
    }

    if (type === "check_item" && !season) {
      return errorResponse("Missing season field for check_item.");
    }

    const systemPrompt = type === "analyse" ? ANALYSE_SYSTEM_PROMPT : CHECK_ITEM_SYSTEM_PROMPT;
    const messages = type === "analyse"
  ? buildAnalyseMessages(image, body.body_shape)
  : buildCheckItemMessages(image, season!, mode || "single", swatchLabel);

    const response = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      return errorResponse("AI service error. Please try again.", 502);
    }

    const anthropicData = await response.json() as {
      content: Array<{ type: string; text: string }>;
      error?: { message: string };
    };

    if (anthropicData.error) {
      return errorResponse(anthropicData.error.message, 502);
    }

    const textBlock = anthropicData.content?.find((c) => c.type === "text");
    if (!textBlock?.text) {
      return errorResponse("No response from AI service.", 502);
    }

    const cleaned = textBlock.text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("JSON parse failed. Raw response:", cleaned);
      return errorResponse("AI returned invalid response. Please try again.", 502);
    }

    return successResponse(parsed);

  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});