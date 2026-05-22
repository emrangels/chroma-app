import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!signature || !webhookSecret) {
      return new Response("Missing signature or secret", { status: 400 });
    }
    const body = await req.text();
    const encoder = new TextEncoder();
    const parts = signature.split(",");
    let timestamp = "";
    let sigHash = "";
    for (const part of parts) {
      if (part.startsWith("t=")) timestamp = part.slice(2);
      if (part.startsWith("v1=")) sigHash = part.slice(3);
    }
    const signedPayload = `${timestamp}.${body}`;
    const key = await crypto.subtle.importKey("raw", encoder.encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
    const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
    if (expectedSig !== sigHash) {
      return new Response("Invalid signature", { status: 400 });
    }
    const event = JSON.parse(body);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const plan = session.metadata?.plan;
      const billing = session.metadata?.billing;
      if (userId && plan) {
        const customerId = session.customer;
        await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "apikey": serviceRoleKey!, "Authorization": `Bearer ${serviceRoleKey}`, "Prefer": "return=minimal" },
          body: JSON.stringify({ user_plan: plan, user_billing: billing || "monthly", stripe_customer_id: customerId, stripe_status: "active" }),
        });
      }
    }
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      const res = await fetch(`${supabaseUrl}/rest/v1/profiles?stripe_customer_id=eq.${customerId}`, {
        headers: { "apikey": serviceRoleKey!, "Authorization": `Bearer ${serviceRoleKey}` },
      });
      const profiles = await res.json();
      if (profiles?.[0]?.id) {
        await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${profiles[0].id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "apikey": serviceRoleKey!, "Authorization": `Bearer ${serviceRoleKey}`, "Prefer": "return=minimal" },
          body: JSON.stringify({ user_plan: "free" }),
        });
      }
    }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Webhook error", { status: 500 });
  }
});
