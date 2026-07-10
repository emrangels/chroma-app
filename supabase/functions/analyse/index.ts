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
Colour analysis is nuanced — placement matters. Use three verdict values:
- "yes" — this colour suits the season and looks great near the face (tops, jackets, scarves, earrings, makeup)
- "neutral" — this colour doesn't clash but works better away from the face (bottoms, shoes, bags, outerwear). Pair with season colours near the face.
- "no" — this colour clashes with the season's undertone regardless of placement. Avoid.

Rules:
- Consider undertone match, saturation level, and depth
- For items worn near the face: be strict — only season-harmonious colours get "yes"
- For items worn away from the face: neutrals, basics and off-season colours can be "neutral"
- Be decisive but measured — photo colours can shift with lighting, so for borderline cases lean toward "neutral" rather than "no"
- The hex should reflect the actual dominant colour of each item as photographed
- Colour names must be specific and evocative (e.g. "Dusty Rose" not "Pink")
- Also return verdict: true if verdict_v2 is "yes", false otherwise (for backwards compatibility)
- Always include a specific alternative suggestion in the tip field — name a real colour, brand or shade the user could try instead

For SINGLE ITEM mode, return:
{
  "mode": "single",
  "items": [
    {
      "colour_name": "specific colour name",
      "hex": "#RRGGBB",
      "verdict": true,
      "verdict_v2": "yes|neutral|no",
      "reason": "One sentence explaining the verdict considering placement.",
      "tip": "If no: one sentence alternative. If neutral: one sentence on how to wear it away from face. If yes: one sentence on how to style it."
    }
  ]
}

For SWATCH mode, return the same shape but with one object per distinct swatch colour visible in the image.
{
  "mode": "swatch",
  "items": [
    {
      "colour_name": "specific colour name",
      "hex": "#RRGGBB",
      "verdict": true,
      "verdict_v2": "yes|neutral|no",
      "reason": "One sentence explanation.",
      "tip": "One sentence on how to wear it or what to choose instead."
    }
  ]
}

For OUTFIT mode, identify each distinct garment or accessory visible separately.
{
  "mode": "outfit",
  "overall_verdict": true,
  "overall_tip": "One sentence on the outfit as a whole.",
  "items": [
    {
      "piece": "Top|Knitwear|Jacket|Coat|Bottom|Dress|Jumpsuit|Shoes|Bag|Accessory",
      "colour_name": "specific colour name",
      "hex": "#RRGGBB",
      "verdict": true,
      "verdict_v2": "yes|neutral|no",
      "reason": "One sentence explanation considering placement.",
      "tip": "Styling tip or swap suggestion based on verdict."
    }
  ]
}

OUTFIT RULES:
- Identify every visible garment and accessory as a separate item
- overall_verdict is true only if the majority of pieces are "yes" or "neutral"
- Be specific about piece type in the piece field
- Consider how pieces work together, not just individually`;

const MAKEUP_PHOTO_CHECK_SYSTEM_PROMPT = `You are Chroma, an expert colour season analyst and makeup specialist. You are given one or more photos of a makeup product or a swatch, and the user's confirmed colour season, undertone and depth. Your job is to assess whether the colour suits their season.

If the user has separately typed a shade name or code they believe is correct, treat that as a strong hint: if it matches what you can read or infer from the photos, use it to confidently identify the real product and set "detected_text" to that shade name, with confidence "high" if you genuinely recognise the resulting product. If the typed hint seems unrelated to what's visible in the photos, mention this gently in your reason rather than ignoring the mismatch.

CRITICAL FIRST STEP — READ THE IMAGES FOR TEXT:
Before judging colour from pixels alone, carefully look for any visible text across all provided images: a shade name, a shade number/code, or a brand name printed on packaging, a bullet, a compact, or a label. This text is far more reliable than guessing colour from a photo affected by lighting, screen calibration, or camera quality.

- If you can read a shade name, number, or brand from any of the images, use your real knowledge of that specific named product to determine its actual colour and assess it against the user's season — do not just analyse the pixel colour in this case. Set "text_detected": true and "detected_text" to whatever you read (e.g. "NC42", "Pillow Talk", "315 Rouge").
- If no legible text is visible across any image (a bare swatch, an unbranded product, smudged makeup on skin), assess the dominant colour directly from the visible pixels in whichever image best shows the real product, as your fallback method. Set "text_detected": false and "detected_text": null.
- Never confuse packaging colour with product colour — if the packaging is, say, gold, but the lipstick swatch itself is visible and red, assess the actual product colour, not the packaging.

HONESTY RULE — this is critical:
If you can see actual product colour in the photo (a visible swatch, the product itself, makeup on skin), you can always assess that visible colour directly even without reading any text — this is not "unknown", this is a legitimate photo-based colour read, just mark it "estimated" rather than "high". Only use confidence "unknown" in the rare case where the image shows packaging only with no visible product colour AND no readable text (e.g. a closed compact, a sealed box) — in that case set hex to null and say in the reason/tip that the actual product colour isn't visible in this photo, and suggest opening the product or swatching it for a usable photo.

You must always respond with valid JSON only. No preamble, no markdown fences. Only the raw JSON object.

Return exactly this JSON shape:
{
  "mode": "single",
  "items": [
    {
      "colour_name": "specific colour/shade name",
      "hex": "#RRGGBB — your best genuine attempt at the actual visible product colour, using text-read product knowledge if available, otherwise the photographed pixel colour. Null only if confidence is unknown.",
      "text_detected": true,
      "detected_text": "exact text read from the image, or null",
      "confidence": "high|estimated|unknown",
      "verdict": true,
      "verdict_v2": "yes|neutral|no",
      "reason": "One sentence explaining the verdict for this season, undertone and depth — or, if unknown, a clear statement that the actual product colour wasn't visible in this photo.",
      "tip": "One sentence with a specific actionable suggestion — if yes: how to wear it; if neutral or no: name 1-2 real brand/shade alternatives; if unknown: suggest a clearer photo showing the actual product colour, or typing the product name instead."
    }
  ]
}

VERDICT RULES:
- For complexion products (foundation, concealer, bronzer, powder): judge whether the shade's undertone harmonises with the user's undertone.
- For colour products (lip, blush, eye, highlighter): judge the shade colour directly against the season's palette.
- confidence "high": identified via readable text and genuinely confident in its real-world colour.
- confidence "estimated": colour assessed from the visible photo (with or without text), reasonable confidence in the read but not a guaranteed match.
- confidence "unknown": no usable colour visible in the photo at all — packaging only, no text, no visible product.`;

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

function buildMakeupPhotoMessages(images: string[], season: string, subseason?: string, undertone?: string, depth?: string, shadeHint?: string) {
  const imageContent = images.map(img => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: "image/jpeg" as const,
      data: img,
    },
  }));

  const multiImageNote = images.length > 1
    ? ` I've included ${images.length} photos of the same product — they may show different things (e.g. the packaging with the shade name in one, and a swatch of the actual colour in another). Use all of them together: read any shade name/code from whichever photo shows it, and assess the actual product colour from whichever photo shows the real swatch or product, not just the first image.`
    : "";

  return [
    {
      role: "user",
      content: [
        ...imageContent,
        {
          type: "text",
          text: `My colour season is ${subseason || season} (${season}).${undertone ? ` My undertone is ${undertone}.` : ""}${depth ? ` My depth is ${depth}.` : ""}${shadeHint ? ` I believe the shade name or code is: "${shadeHint}" — use this as a strong hint, and confirm or refine it using your knowledge of the actual product if you recognise it.` : ""} Check this makeup product or swatch against my season — first try to read any visible shade name, number or brand text in the image(s), then assess colour accordingly.${multiImageNote} Return JSON only.`,
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
      images?: string[];
      shadeHint?: string;
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
      foundation?: string;
      makeupKit?: string;
    };

    const { type, image, season, mode, swatchLabel } = body;

    if (!type || (type !== "analyse" && type !== "check_item" && type !== "stylist_chat" && type !== "extended_palette" && type !== "weather_outfit" && type !== "weekly_plan" && type !== "makeup_check_product")) {
      return errorResponse("Invalid type. Must be 'analyse', 'check_item', 'stylist_chat', 'extended_palette', or 'weather_outfit'.");
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return errorResponse("Server configuration error.", 500);
    }

    if (type === "stylist_chat") {
      const { message, history, season: chatSeason, subseason, body_shape, wardrobe, undertone, depth, chroma, foundation, makeupKit } = body as any;
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
          system: `You are Chroma, a warm and knowledgeable personal AI stylist. The user's colour season is ${chatSeason} (${subseason}).${undertone ? ` Their undertone is ${undertone}.` : ""}${depth ? ` Their depth is ${depth}.` : ""}${chroma ? ` Their chroma is ${chroma}.` : ""} Their body shape is ${body_shape || "unknown"}. Their wardrobe contains: ${wardrobe || "no items yet"}.${foundation ? ` They have previously told you these foundation/concealer shades they currently wear, which you can use as a calibration reference for their actual skin tone: ${foundation}.` : ""}${makeupKit ? ` Their saved makeup kit, with real confirmed verdicts from past checks, contains: ${makeupKit}. Always reference and build on these real, confirmed items first when discussing makeup — they are ground truth for this specific person, more reliable than any generic guess. IMPORTANT: some entries are marked "not yet checked against their season" — these are shades the person currently wears that have NOT been assessed for fit, only saved as a skin-tone reference point. Never state a verdict (suits/doesn't suit) on those specific unassessed items. You can still use them to calibrate your sense of their actual skin tone and depth, but if asked directly about one of those specific products, say it hasn't been checked yet and suggest running it through the makeup checker for a real verdict.` : ""}

Give specific, warm, practical styling advice. Reference their actual wardrobe items and makeup kit by name when relevant. Keep responses concise and actionable. Plain text only, no markdown.

DEPTH ACCURACY — this is critical, do not default to light shades:
Their depth is explicitly stated above as Light, Medium or Deep. You must calibrate every shade suggestion to their actual depth, not a generic assumption. A "Deep" or "Medium" depth person should never be defaulted into pale/fair shade recommendations — that is a common and serious error. If their depth is Deep, recommend deep/tan/rich shade numbers and names appropriate to that depth (e.g. higher numeric shade codes, "tan", "deep", "rich" naming in real product lines). If Medium, recommend mid-range shades. Only recommend light/fair shades if their depth is genuinely Light. Always sense-check: does this shade suggestion match the stated depth, or have I defaulted to a safe generic light shade out of habit? If the latter, correct it.

MAKEUP SHADE MATCHING — if the user asks what shade to buy in a specific named makeup product or brand (e.g. "what shade should I get in NARS Sheer Glow", "which Fenty foundation shade for me"), you should:
1. Give your best-guess shade or shade range based on their ACTUAL stated undertone and depth above, using real shade names from that actual product line where you know them (e.g. for a Deep, warm person: "Fenty Beauty 420 or 440, leaning warm" — not a light shade)
2. If they have a makeup kit or foundation shades saved, cross-reference: does the brand/line they're asking about have a known relationship to a shade they already confirmed works? Use that to anchor your guess.
3. Be clear this is an educated estimate, not a guarantee — screen colours, lighting and skin can all vary
4. Always include a concrete way to verify in-store: swatch along the jawline (never the back of the hand or wrist), check it in natural daylight near a window rather than under store lighting, and let it sit for 10-15 minutes to oxidise before deciding
5. Keep the tone helpful and confident, not hedgy or vague — give a real, specific, useful starting point every time, correctly calibrated to their actual depth`,
          messages: stylistMessages,
        }),
      });
      const anthropicData = await response.json() as { content: Array<{ type: string; text: string }>; error?: { message: string } };
      if (anthropicData.error) return errorResponse(anthropicData.error.message, 502);
      const textBlock = anthropicData.content?.find((c) => c.type === "text");
      return successResponse({ reply: textBlock?.text || "I couldn't generate a response." });
    }
    if (type === "weather_outfit") {
  const { season: wSeason, palette, temp, desc } = body as { season: string; palette: string; temp: number; desc: string };
  const response = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `You are a personal stylist AI for Solla, a colour season app. Suggest a cohesive, stylish, wearable daily outfit for a ${wSeason} colour season. Today's weather is ${temp}°C and ${desc}. Their best colours include ${palette}. Rules: every garment colour must be from or closely harmonious with the ${wSeason} palette — no colours that clash or don't belong to this season. The outfit must be cohesive as a whole — colours and styles should work together, not just individually. Suggest something a real person would genuinely want to wear and feel comfortable and confident in. Avoid random colour combinations — think about how the pieces relate to each other.${(body as any).wardrobe ? ` Pull from their actual wardrobe where possible and learn their preferences over time: ${(body as any).wardrobe}.` : ""} Return ONLY a JSON object in this exact shape, no other text: {"coat":"item or null","base":"top + bottom or dress description","shoes":"footwear","accessories":"accessories"}`
      }]
    }),
  });
  const weatherData = await response.json() as { content: Array<{ type: string; text: string }>; error?: { message: string } };
if (weatherData.error) return errorResponse(weatherData.error.message, 502);
const textBlock = weatherData.content?.find((c) => c.type === "text");
const raw = textBlock?.text || "{}";
const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
return successResponse({ outfit: cleaned });
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
    if (type === "weekly_plan") {
  const { season, palette, wardrobe, days } = body as { season: string; palette: string; wardrobe: string; days: string[] };
  const response = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `You are a personal stylist AI for Solla. Create a 7-day outfit plan for a ${season} colour season. Their best colours: ${palette}. Their wardrobe: ${wardrobe || "no items yet — suggest general season-appropriate outfits"}. Create one cohesive, stylish, wearable outfit per day. Pull from their wardrobe where possible. Return ONLY valid JSON, no markdown: {"plan":[{"day":"Monday","coat":"item or null","base":"top + bottom","shoes":"footwear","accessories":"accessories"},{"day":"Tuesday",...},{"day":"Wednesday",...},{"day":"Thursday",...},{"day":"Friday",...},{"day":"Saturday",...},{"day":"Sunday",...}]}`
      }],
    }),
  });
  const planData = await response.json() as { content: Array<{ type: string; text: string }>; error?: { message: string } };
  if (planData.error) return errorResponse(planData.error.message, 502);
  const textBlock = planData.content?.find((c) => c.type === "text");
  const raw = textBlock?.text || "{}";
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return successResponse(parsed);
  } catch {
    return errorResponse("Invalid response from AI.", 502);
  }
}
    if (type === "makeup_check_product") {
      const { season, products, foundation } = body as { season: string; products: Array<{ name: string; category: string }>; foundation?: string };
      const response = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1500,
          messages: [{
            role: "user",
            content: `You are a makeup and colour season expert for Solla. The user's colour season is ${(body as any).subseason || season} (${season}).${(body as any).undertone ? ` Their undertone is ${(body as any).undertone}.` : ""}${(body as any).depth ? ` Their depth is ${(body as any).depth}.` : ""}${(body as any).context ? ` Context: ${(body as any).context}` : ""} Check the following makeup products against their season.

HEX ACCURACY AND HONESTY RULES — this is critical:
- confidence "high": only for widely known, iconic shades you are genuinely certain about (e.g. MAC Ruby Woo, Charlotte Tilbury Pillow Talk, NARS Orgasm blush). Return a precise, confident hex.
- confidence "estimated": you recognise the brand and product line, and can make an educated guess at the shade family/tone from its name or number, but are not fully certain of the exact hex. Return your best genuine attempt at the described tone (a "rose" blush must be rose-toned, a "315 Rouge" lip must be a plausible red) — never an unrelated colour, and never a generic beige/tan placeholder.
- confidence "unknown": you do not recognise this product, brand, or shade at all, and have no reasonable basis to guess its colour family. In this case, do NOT invent a hex. Set hex to null, set verdict_v2 to "neutral", and make the reason/tip explicitly say the product could not be identified and recommend checking in person or photographing the shade name clearly. This is the correct and expected response when a product is unfamiliar or obscure — it is far better to say "I don't know" than to guess wrong.
- Foundation and concealer hex should reflect actual skin-tone family (not lip/blush tones), scaled to the shade depth implied by its name or number.

CATEGORY LOGIC:
For COMPLEXION products (Foundation, Concealer, Bronzer, Powder): assess whether the undertone of the shade harmonises with the season's undertone — warm foundations on cool seasons look grey/ashy, cool foundations on warm seasons look pink/flat. Bronzer should be 1-2 shades deeper than skin but still harmonise in undertone.
For COLOUR products (Lip, Blush, Eye, Highlighter): check the shade colour directly against the season palette.
For ALL products: suggest a specific better alternative by real brand and shade name if the verdict is not "yes".

Return ONLY valid JSON, no markdown: {"results":[{"name":"exact product name as given","brand":"brand name","shade":"shade name","category":"category","hex":"#RRGGBB, or null if confidence is unknown","confidence":"high|estimated|unknown","verdict":true,"verdict_v2":"yes|neutral|no","reason":"one specific sentence why this does or doesn't suit ${(body as any).subseason || season} — or, if unknown, a clear statement that this product could not be identified","tip":"one sentence with a specific actionable suggestion — if yes: how to best wear this shade; if neutral or no: name 1-2 specific better alternatives with real brand and shade names; if unknown: suggest checking in person or trying the photo upload with the shade name clearly visible"}]}. Products to check: ${products.map((p: {name: string; category: string}) => `${p.name} (${p.category})`).join(", ")}.`
          }],
        }),
      });
      const makeupData = await response.json() as { content: Array<{ type: string; text: string }>; error?: { message: string } };
      if (makeupData.error) return errorResponse(makeupData.error.message, 502);
      const textBlock = makeupData.content?.find((c) => c.type === "text");
      const raw = textBlock?.text || "{}";
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
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

    const isMakeupPhoto = type === "check_item" && mode === "makeup_photo";

    const systemPrompt = type === "analyse" ? ANALYSE_SYSTEM_PROMPT : isMakeupPhoto ? MAKEUP_PHOTO_CHECK_SYSTEM_PROMPT : CHECK_ITEM_SYSTEM_PROMPT;
    const messages = type === "analyse"
  ? buildAnalyseMessages(image, body.body_shape)
  : isMakeupPhoto
  ? buildMakeupPhotoMessages(body.images && body.images.length > 0 ? body.images : [image], season!, (body as any).subseason, (body as any).undertone, (body as any).depth, body.shadeHint)
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