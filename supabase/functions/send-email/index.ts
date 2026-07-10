import "@supabase/functions-js/edge-runtime.d.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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
    const { type, email, name, season, password, refCode, enteredCode, seasonData } = await req.json();

    if (type === "signup") {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: false, user_metadata: { name } });
      if (createErr) return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (created.user?.id) { await supabaseAdmin.from("profiles").insert({ id: created.user.id, name, user_plan: "free", referral_code: refCode, referred_by: enteredCode ? enteredCode.toUpperCase() : null, referral_count: 0, ...(seasonData ? { season_data: seasonData } : {}) }); }
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({ type: "signup", email, password });
      if (linkErr) return new Response(JSON.stringify({ error: linkErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const confirmUrl = linkData?.properties?.action_link;
      const firstNameSignup = (name || "there").split(" ")[0];
      await sendEmail(email, "Confirm your email to get started 🌸", base(`<h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0 0 12px;">Hi ${firstNameSignup} 👋</h1><p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 16px;">Welcome to Solla. Confirm your email to unlock your colour season.</p>${btn(confirmUrl, "Verify my email and get started →")}<p style="font-size:13px;color:#888;margin:16px 0 0;">Questions? Just reply to this email, I read every one.<br/>Emma, founder of Solla</p>`));
      return new Response(JSON.stringify({ ok: true, userId: created.user?.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const firstName = (name || "there").split(" ")[0];

    if (type === "welcome") {
      await sendEmail(
        email,
        "Your colours are waiting 🌸",
        base(`
          <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0 0 12px;">Hi ${firstName} 👋</h1>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 16px;">Welcome to Solla. You're about to find out something most people never learn about themselves, your colour season.</p>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 8px;">Verify your email, take your selfie, and your full colour profile will be ready in under a minute. Your palette, your daily tip, and 5 wardrobe items to get you started, all free.</p>
          ${btn("https://solla.com.au", "Verify my email and get started →")}
          <p style="font-size:13px;color:#888;margin:16px 0 0;">Questions? Just reply to this email, I read every one.<br/>Emma, founder of Solla</p>
        `)
      );

    } else if (type === "day3") {
      await sendEmail(
        email,
        `${firstName}, your ${season} guide is ready 🎨`,
        base(`
          <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0 0 12px;">You're a ${season} 🌸</h1>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 16px;">Most ${season}s tell us the makeup guide is what changes everything. Your exact foundation undertone, blush shades and lip colours are ready, personalised to your specific colouring.</p>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 8px;">Unlock Glow to get your full colour palette, makeup guide, hair colours, jewellery guide and colour checker. Try everything free for 7 days.</p>
          ${btn("https://solla.com.au", "Unlock my full colour guide, free for 7 days →")}
          <p style="font-size:13px;color:#888;margin:16px 0 0;">Emma, founder of Solla</p>
        `)
      );

    } else if (type === "day7") {
      await sendEmail(
        email,
        `${firstName}, do you know what to wear tomorrow?`,
        base(`
          <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0 0 12px;">Finally know what to wear 👗</h1>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 16px;">As a ${season}, you have a specific set of colours that make you look alive, and a wardrobe that might be working against you without you knowing.</p>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 8px;">Luxe gives you the full picture: wardrobe builder, daily outfit suggestions, outfit creator, AI stylist and extended palette. Add your clothes once, wake up every morning knowing exactly what to wear.</p>
          ${btn("https://solla.com.au", "Try Luxe free for 7 days →")}
          <p style="font-size:13px;color:#888;margin:16px 0 0;">Emma, founder of Solla</p>
        `)
      );

    } else if (type === "trial_ending") {
      await sendEmail(
        email,
        `Your free trial ends tomorrow, ${firstName}`,
        base(`
          <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0 0 12px;">Your trial ends in 24 hours ⏰</h1>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 16px;">Your free trial ends tomorrow. After that, you'll drop back to the free plan and lose access to your full colour guide, daily outfits and AI stylist.</p>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 8px;">Keep everything you've built, your wardrobe, your outfits, your makeup kit. Continue for $6.99/mo on Glow or $14.99/mo on Luxe.</p>
          ${btn("https://solla.com.au", "Keep my colour guide →")}
          <p style="font-size:13px;color:#888;margin:16px 0 0;">Cancel anytime from the Me tab. No questions asked.<br/>Emma, founder of Solla</p>
        `)
      );

    } else if (type === "winback") {
      await sendEmail(
        email,
        `We kept your colours safe, ${firstName} 🌸`,
        base(`
          <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0 0 12px;">Your ${season} profile is still here</h1>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 16px;">You cancelled your subscription, but your colour profile and wardrobe are still saved. Whenever you're ready, everything is waiting for you exactly as you left it.</p>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 8px;">Come back anytime, your season doesn't change, and neither does your palette.</p>
          ${btn("https://solla.com.au", "Come back to Solla →")}
          <p style="font-size:13px;color:#888;margin:16px 0 0;">Emma, founder of Solla</p>
        `)
      );

    } else if (type === "wardrobe_nudge") {
      await sendEmail(
        email,
        `${firstName}, your outfit engine needs one thing`,
        base(`
          <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0 0 12px;">Add your first wardrobe item 👗</h1>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 16px;">You're on Luxe, which means your daily outfit engine is ready. It just needs your clothes.</p>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 8px;">Add even one item and Solla starts building outfits around it. Add ten and you'll never wonder what to wear again. Takes less than a minute per item.</p>
          ${btn("https://solla.com.au", "Add my first item →")}
          <p style="font-size:13px;color:#888;margin:16px 0 0;">Emma, founder of Solla</p>
        `)
      );
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});