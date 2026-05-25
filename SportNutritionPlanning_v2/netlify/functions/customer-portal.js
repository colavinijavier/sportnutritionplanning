// netlify/functions/customer-portal.js
// Opens the Stripe Customer Portal for the authenticated user.
// Looks up the user's stripe_customer_id from the Supabase `subscriptions` table.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return jsonResp(405, { error: 'Method not allowed' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supaUrl = process.env.SUPABASE_URL;
  const supaService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeKey)   return jsonResp(500, { error: 'Stripe not configured' });
  if (!supaUrl || !supaService) return jsonResp(500, { error: 'Supabase not configured' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return jsonResp(400, { error: 'Invalid JSON' }); }
  const { user_id } = body;
  if (!user_id) return jsonResp(400, { error: 'Missing user_id' });

  // Look up customer id from subscriptions table
  let customerId = null;
  try {
    const r = await fetch(`${supaUrl}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(user_id)}&select=stripe_customer_id&limit=1`, {
      headers: {
        'apikey': supaService,
        'Authorization': 'Bearer ' + supaService
      }
    });
    const arr = await r.json();
    if (Array.isArray(arr) && arr[0]) customerId = arr[0].stripe_customer_id;
  } catch (e) {}

  if (!customerId) return jsonResp(404, { error: 'No subscription found' });

  const siteUrl = process.env.SITE_URL || ('https://' + (event.headers && event.headers.host) || '');
  const params = new URLSearchParams();
  params.append('customer', customerId);
  params.append('return_url', siteUrl + '/account.html');

  try {
    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + stripeKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
    const j = await res.json();
    if (!res.ok) return jsonResp(res.status, { error: (j.error && j.error.message) || 'Stripe portal error' });
    return jsonResp(200, { url: j.url });
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
