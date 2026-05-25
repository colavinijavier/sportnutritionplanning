// netlify/functions/mp-webhook.js
// Receives MercadoPago IPN/webhook notifications, validates them against MP API,
// and syncs subscription status to Supabase.
//
// Env vars required:
//   MP_ACCESS_TOKEN
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

exports.handler = async (event) => {
  const mpToken = process.env.MP_ACCESS_TOKEN;
  const supaUrl = process.env.SUPABASE_URL;
  const supaService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!mpToken) return { statusCode: 500, body: 'MP_ACCESS_TOKEN missing' };
  if (!supaUrl || !supaService) return { statusCode: 500, body: 'Supabase env missing' };

  // MP sends notifications as POST with body, or as GET with query params.
  // The most reliable payload field is `data.id` (payment id) and `type` ("payment").
  let payload = {};
  try {
    if (event.body) payload = JSON.parse(event.body);
  } catch (e) { /* ignore */ }
  const qs = event.queryStringParameters || {};

  // MP sends three kinds of notifications: payment, merchant_order, etc. We only care about payment.
  const type = payload.type || payload.topic || qs.type || qs.topic;
  const dataId = (payload.data && payload.data.id) || qs.id || qs['data.id'];

  if (!type || type !== 'payment' || !dataId) {
    return { statusCode: 200, body: 'ignored' };
  }

  try {
    // Fetch the payment details to validate authenticity
    const r = await fetch('https://api.mercadopago.com/v1/payments/' + dataId, {
      headers: { 'Authorization': 'Bearer ' + mpToken }
    });
    if (!r.ok) return { statusCode: 200, body: 'payment lookup failed' };
    const payment = await r.json();

    // Extract user_id and plan from external_reference: "uuid|monthly" or "uuid|yearly"
    const ext = String(payment.external_reference || '');
    const sep = ext.indexOf('|');
    const userId = sep > 0 ? ext.slice(0, sep) : ext;
    const plan = sep > 0 ? ext.slice(sep + 1) : 'monthly';
    if (!userId) return { statusCode: 200, body: 'no user_id in external_reference' };

    // Map MP payment status to our subscription status
    const mpStatus = String(payment.status || ''); // approved, pending, authorized, in_process, rejected, refunded, cancelled, charged_back
    let subStatus = 'inactive';
    if (mpStatus === 'approved' || mpStatus === 'authorized') subStatus = 'active';
    else if (mpStatus === 'pending' || mpStatus === 'in_process') subStatus = 'pending';
    else if (mpStatus === 'rejected' || mpStatus === 'cancelled') subStatus = 'canceled';
    else if (mpStatus === 'refunded' || mpStatus === 'charged_back') subStatus = 'refunded';

    // Compute renewal date: monthly = +30d, yearly = +365d (only for active)
    let renewAt = null;
    if (subStatus === 'active') {
      const days = plan === 'yearly' ? 365 : 30;
      const paidAt = payment.date_approved ? new Date(payment.date_approved) : new Date();
      renewAt = new Date(paidAt.getTime() + days * 24 * 3600 * 1000).toISOString();
    }

    await upsertSub(supaUrl, supaService, {
      user_id: userId,
      stripe_customer_id: payment.payer && payment.payer.id ? String(payment.payer.id) : null,
      stripe_subscription_id: String(payment.id || ''),
      status: subStatus,
      price_id: plan,
      current_period_end: renewAt,
      cancel_at_period_end: false
    });

    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    return { statusCode: 500, body: 'handler error: ' + (e.message || e) };
  }
};

async function upsertSub(supaUrl, supaKey, row) {
  await fetch(supaUrl + '/rest/v1/subscriptions?on_conflict=user_id', {
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
