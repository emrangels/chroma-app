import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_Solla");
const SUPABASE_URL = "https://hnbpasabtwafnlxzlppr.supabase.co";
const SUPABASE_SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? "";

const PRICE_IDS: Record<string, string> = {
  glow_monthly: "price_1TSqBqLI9o0IfbutkydfU57E",
  glow_annual: "price_1TSqEKLI9o0Ifbut2IR35xVF",
  luxe_monthly: "price_1TSqFILI9o0Ifbutm8DfH87j",
  luxe_annual: "price_1TSqGOLI9o0IfbutZQ9jiLKb",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { type, plan, billing, user_id, email, return_url } = body;

    if (type === "create_checkout") {
      if (!plan || !billing || !user_id || !email || !return_url) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const priceId = PRICE_IDS[`${plan}_${billing}`];
      if (!priceId) {
        return new Response(JSON.stringify({ error: "Invalid plan or billing" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const customerRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ email, "metadata[supabase_user_id]": user_id }).toString(),
      });
      const customer = await customerRes.json();

      if (!customer.id) {
        return new Response(JSON.stringify({ error: "Failed to create customer: " + JSON.stringify(customer) }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          customer: customer.id,
          mode: "subscription",
          "line_items[0][price]": priceId,
          "line_items[0][quantity]": "1",
          "subscription_data[trial_period_days]": "7",
          "subscription_data[metadata][supabase_user_id]": user_id,
          "subscription_data[metadata][plan]": plan,
          "subscription_data[metadata][billing]": billing,
          success_url: `${return_url}?checkout=success&plan=${plan}&billing=${billing}`,
          cancel_url: `${return_url}?checkout=cancelled`,
          allow_promotion_codes: "true",
        }).toString(),
      });
      const session = await sessionRes.json();

      if (!session.url) {
        return new Response(JSON.stringify({ error: "No URL: " + JSON.stringify(session) }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ url: session.url }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "cancel_subscription") {
      if (!user_id) {
        return new Response(JSON.stringify({ error: "Missing user_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user_id}&select=stripe_customer_id`, {
        headers: {
          "apikey": SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      });
      const profiles = await profileRes.json();
      const stripeCustomerId = profiles?.[0]?.stripe_customer_id;

      if (!stripeCustomerId) {
        return new Response(JSON.stringify({ error: "No subscription found. Please email hello@solla.com.au to cancel." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const subsRes = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${stripeCustomerId}&status=active`, {
        headers: { "Authorization": `Bearer ${stripeKey}` },
      });
      const subs = await subsRes.json();
      let subscriptionId = subs?.data?.[0]?.id;

      if (!subscriptionId) {
        const trialRes = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${stripeCustomerId}&status=trialing`, {
          headers: { "Authorization": `Bearer ${stripeKey}` },
        });
        const trialSubs = await trialRes.json();
        subscriptionId = trialSubs?.data?.[0]?.id;
      }

      if (!subscriptionId) {
        return new Response(JSON.stringify({ error: "No active subscription found." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ cancel_at_period_end: "true" }).toString(),
      });

      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user_id}`, {
        method: "PATCH",
        headers: {
          "apikey": SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ stripe_status: "cancelled" }),
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});