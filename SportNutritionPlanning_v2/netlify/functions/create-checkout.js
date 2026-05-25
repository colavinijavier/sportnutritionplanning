// netlify/functions/create-checkout.js
// Creates a Stripe Checkout Session for Pro subscription.
//
// Env vars required:
//   STRIPE_SECRET_KEY        — sk_test_... or sk_live_...
//   STRIPE_PRICE_MONTHLY     — Stripe Price ID for $6.99/month
//   STRIPE_PRICE_YEARLY      — Stripe Price ID for $59/year
//   SITE_URL                 — e.g. https://sportnutritionplanning.netlify.app

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return jsonResp(405, { error: 'Method not allowed' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return jsonResp(500, { error: 'Stripe not configured' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return jsonResp(400, { error: 'Invalid JSON' }); }

  const { user_id, email, billing } = body;
  if (!user_id || !email) return jsonResp(400, { error: 'Missing user_id or email' });

  const priceId = billing === 'yearly'
    ? process.env.STRIPE_PRICE_YEARLY
    : process.env.STRIPE_PRICE_MONTHLY;
  if (!priceId) return jsonResp(500, { error: 'Price ID not configured' });

  const siteUrl = process.env.SITE_URL || ('https://' + (event.headers && event.headers.host) || '');
  const successUrl = siteUrl + '/account.html?checkout=success';
  const cancelUrl  = siteUrl + '/account.html?checkout=cancel';

  // Form-urlencoded body for Stripe API
  const params = new URLSearchParams();
  params.append('mode', 'subscription');
  params.append('payment_method_types[]', 'card');
  params.append('line_items[0][price]', priceId);
  params.append('line_items[0][quantity]', '1');
  params.append('client_reference_id', user_id);
  params.append('customer_email', email);
  params.append('subscription_data[metadata][user_id]', user_id);
  params.append('metadata[user_id]', user_id);
  params.append('allow_promotion_codes', 'true');
  params.append('success_url', successUrl);
  params.append('cancel_url', cancelUrl);

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + stripeKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
    const j = await res.json();
    if (!res.ok) return jsonResp(res.status, { error: (j.error && j.error.message) || 'Stripe error' });
    return jsonResp(200, { url: j.url, id: j.id });
  } catch (e) {
    return jsonResp(500, { error: e.message || 'Unknown error' });
  }
};

function jsonResp(statusCode, body) {
  return {
    statusCode,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}
