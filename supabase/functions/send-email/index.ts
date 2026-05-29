import "@supabase/functions-js/edge-runtime.d.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = "Solla <hello@solla.com.au>";

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const { type, email, name, season } = await req.json();

    if (type === "welcome") {
      await sendEmail(email, "Welcome to Solla ✨", `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;color:#1a1a2e;"><h1 style="font-size:24px;font-weight:700;margin-bottom:8px;">Hi ${name} 🌸</h1><p style="font-size:15px;color:#555;line-height:1.6;margin-bottom:24px;">Welcome to Solla — your personal colour guide and daily outfit engine. You've taken the first step to never asking "what do I wear?" again.</p><p style="font-size:15px;color:#555;line-height:1.6;margin-bottom:24px;">Start by completing your colour analysis — one selfie is all it takes.</p><a href="https://solla.com.au" style="display:inline-block;background:#7C6FCD;color:white;padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;text-decoration:none;margin-bottom:32px;">Find my colour season →</a><p style="font-size:13px;color:#999;">© 2026 Solla™ · <a href="https://solla.com.au" style="color:#999;">Unsubscribe</a></p></div>`);

    } else if (type === "day3") {
      await sendEmail(email, `${name}, your ${season} colour guide is waiting 🎨`, `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;color:#1a1a2e;"><h1 style="font-size:24px;font-weight:700;margin-bottom:8px;">You're a ${season} 🌸</h1><p style="font-size:15px;color:#555;line-height:1.6;margin-bottom:24px;">Now that you know your season, unlock the full picture — your subseason, complete colour palette, makeup guide, hair colours and jewellery guide.</p><p style="font-size:15px;color:#555;line-height:1.6;margin-bottom:24px;">Glow members also get the colour checker — photograph any item and instantly know if it works for your season.</p><a href="https://solla.com.au" style="display:inline-block;background:#7C6FCD;color:white;padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;text-decoration:none;margin-bottom:32px;">Unlock my full colour guide →</a><p style="font-size:13px;color:#999;">© 2026 Solla™ · <a href="https://solla.com.au" style="color:#999;">Unsubscribe</a></p></div>`);

    } else if (type === "day7") {
      await sendEmail(email, `Stop asking "what do I wear?" — Solla has the answer`, `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;color:#1a1a2e;"><h1 style="font-size:24px;font-weight:700;margin-bottom:8px;">Your daily outfit engine is ready, ${name}</h1><p style="font-size:15px;color:#555;line-height:1.6;margin-bottom:24px;">As a ${season}, you have a specific set of colours that make you look alive — and a wardrobe full of items that may be working against you.</p><p style="font-size:15px;color:#555;line-height:1.6;margin-bottom:24px;">Luxe members can build their entire wardrobe, create colour-approved outfits, and ask their AI stylist what to wear for any occasion. Never stare at your wardrobe again.</p><a href="https://solla.com.au" style="display:inline-block;background:#7C6FCD;color:white;padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;text-decoration:none;margin-bottom:32px;">Build my outfit engine →</a><p style="font-size:13px;color:#999;">© 2026 Solla™ · <a href="https://solla.com.au" style="color:#999;">Unsubscribe</a></p></div>`);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});