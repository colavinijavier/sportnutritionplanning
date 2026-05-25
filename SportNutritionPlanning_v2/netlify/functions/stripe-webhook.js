// netlify/functions/stripe-webhook.js
// Receives Stripe webhook events and syncs the user's subscription state to Supabase.
//
// Env vars required:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET    — whsec_... (from Stripe webhook endpoint config)
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

const crypto = require('crypto');

exports.handler = async (event) => {
  const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supaUrl = process.env.SUPABASE_URL;
  const supaService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeSecret || !stripeKey) return { statusCode: 500, body: 'Stripe not configured' };
  if (!supaUrl || !supaService) return { statusCode: 500, body: 'Supabase not configured' };

  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  const raw = event.body || '';

  // Verify signature manually (Stripe scheme `t=...,v1=...`)
  if (!verifyStripeSignature(raw, sig, stripeSecret)) {
    return { statusCode: 400, body: 'Bad signature' };
  }

  let payload;
  try { payload = JSON.parse(raw); }
  catch (e) { return { statusCode: 400, body: 'Bad JSON' }; }

  try {
    switch (payload.type) {
      case 'checkout.session.completed': {
        const s = payload.data.object;
        const userId = (s.metadata && s.metadata.user_id) || s.client_reference_id;
        if (userId && s.subscription) {
          // Pull subscription details
          const sub = await stripeFetch('/v1/subscriptions/' + s.subscription, stripeKey);
          await upsertSub(supaUrl, supaService, {
            user_id: userId,
            stripe_customer_id: s.customer,
            stripe_subscription_id: sub.id,
            status: sub.status,
            price_id: (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].price && sub.items.data[0].price.id) || null,
            current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
            cancel_at_period_end: !!sub.cancel_at_period_end
          });
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.created': {
        const sub = payload.data.object;
        const userId = (sub.metadata && sub.metadata.user_id);
        if (userId) {
          await upsertSub(supaUrl, supaService, {
            user_id: userId,
            stripe_customer_id: sub.customer,
            stripe_subscription_id: sub.id,
            status: sub.status,
            price_id: (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].price && sub.items.data[0].price.id) || null,
            current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
            cancel_at_period_end: !!sub.cancel_at_period_end
          });
        }
        break;
      }
      default:
        // ignore other events
        break;
    }
    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    return { statusCode: 500, body: 'handler error: ' + (e.message || e) };
  }
};

function verifyStripeSignature(payload, header, secret) {
  if (!header) return false;
  const parts = header.split(',').reduce((acc, p) => {
    const [k, v] = p.split('=');
    acc[k] = v;
    return acc;
  }, {});
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const signed = `${t}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  // Tolerance check: 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(t)) > 300) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch (e) { return false; }
}

async function stripeFetch(path, key) {
  const r = await fetch('https://api.stripe.com' + path, {
    headers: { 'Authorization': 'Bearer ' + key }
  });
  return r.json();
}

async function upsertSub(supaUrl, supaKey, row) {
  await fetch(`${supaUrl}/rest/v1/subscriptions?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      'apikey': supaKey,
      'Authorization': 'Bearer ' + supaKey,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(row)
  });
}
