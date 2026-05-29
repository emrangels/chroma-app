import "@supabase/functions-js/edge-runtime.d.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = "Emma at Solla <hello@solla.com.au>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

const base = (content: string) => `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:0;background:#ffffff;"><div style="background:#7C6FCD;padding:24px 32px;border-radius:16px 16px 0 0;"><span style="color:white;font-size:20px;font-weight:700;letter-spacing:-0.5px;">Solla™</span></div><div style="padding:32px;border:1px solid #ede9ff;border-top:none;border-radius:0 0 16px 16px;">${content}<hr style="border:none;border-top:1px solid #f0eeff;margin:28px 0;"/><p style="font-size:12px;color:#aaa;line-height:1.6;margin:0;">You're receiving this because you signed up at <a href="https://solla.com.au" style="color:#aaa;">solla.com.au</a><br/>© 2026 Solla™ · Brighton SA 5048 · <a href="https://solla.com.au" style="color:#aaa;">Unsubscribe</a></p></div></div>`;

const btn = (url: string, label: string) => `<a href="${url}" style="display:inline-block;background:#7C6FCD;color:white;padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;text-decoration:none;margin:20px 0 8px;">${label}</a>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { type, email, name, season } = await req.json();
    const firstName = (name || "there").split(" ")[0];

    if (type === "welcome") {
      await sendEmail(
        email,
        "You're one selfie away from knowing your colours 🌸",
        base(`
          <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0 0 12px;">Hi ${firstName} 👋</h1>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 16px;">Welcome to Solla — the app that tells you exactly what colours to wear and helps you stop staring at your wardrobe every morning.</p>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 8px;">To get started, verify your email and then take your first selfie. Your full colour guide will be ready in under a minute.</p>
          ${btn("https://solla.com.au", "Verify my email & get started →")}
          <p style="font-size:13px;color:#888;margin:16px 0 0;">Questions? Just reply to this email — I read every one.<br/>— Emma, founder of Solla</p>
        `)
      );

    } else if (type === "day3") {
      await sendEmail(
        email,
        `${firstName}, there's more to your ${season} season than you think 🎨`,
        base(`
          <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0 0 12px;">You're a ${season} 🌸</h1>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 16px;">Now you know your season — but that's just the beginning. Your subseason tells you exactly which shades within ${season} work best for your specific colouring.</p>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 8px;">Unlock Glow to get your full colour palette, makeup guide, hair colours, jewellery guide — and the colour checker so you can photograph any item and instantly know if it works.</p>
          ${btn("https://solla.com.au", "Unlock my full colour guide →")}
          <p style="font-size:13px;color:#888;margin:16px 0 0;">— Emma, founder of Solla</p>
        `)
      );

    } else if (type === "day7") {
      await sendEmail(
        email,
        `Still asking "what do I wear?" — here's the answer, ${firstName}`,
        base(`
          <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0 0 12px;">Your daily outfit engine is waiting 👗</h1>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 16px;">As a ${season}, you have a specific set of colours that make you look alive — and a wardrobe that might be working against you without you knowing.</p>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 8px;">Luxe gives you the full picture: wardrobe builder, outfit creator, AI stylist, and daily outfit suggestions based on your season. Add your clothes once, never wonder what to wear again.</p>
          ${btn("https://solla.com.au", "Build my outfit engine →")}
          <p style="font-size:13px;color:#888;margin:16px 0 0;">— Emma, founder of Solla</p>
        `)
      );
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});