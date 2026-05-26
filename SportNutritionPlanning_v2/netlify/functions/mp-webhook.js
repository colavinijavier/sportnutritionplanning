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

  console.log('[mp-webhook] received', {
    method: event.httpMethod,
    qs: event.queryStringParameters,
    bodyLen: (event.body || '').length
  });

  if (!mpToken) {
    console.log('[mp-webhook] ERROR: MP_ACCESS_TOKEN missing');
    return { statusCode: 500, body: 'MP_ACCESS_TOKEN missing' };
  }
  if (!supaUrl || !supaService) {
    console.log('[mp-webhook] ERROR: Supabase env missing');
    return { statusCode: 500, body: 'Supabase env missing' };
  }

  let payload = {};
  try {
    if (event.body) payload = JSON.parse(event.body);
  } catch (e) {
    console.log('[mp-webhook] body parse failed (might be empty or query-only)');
  }
  const qs = event.queryStringParameters || {};

  const type = payload.type || payload.topic || qs.type || qs.topic;
  const dataId = (payload.data && payload.data.id) || qs.id || qs['data.id'];

  console.log('[mp-webhook] parsed', { type, dataId });

  if (!type || type !== 'payment' || !dataId) {
    console.log('[mp-webhook] ignored: not a payment notification or missing id');
    return { statusCode: 200, body: 'ignored' };
  }

  try {
    console.log('[mp-webhook] fetching payment from MP API:', dataId);
    const r = await fetch('https://api.mercadopago.com/v1/payments/' + dataId, {
      headers: { 'Authorization': 'Bearer ' + mpToken }
    });
    if (!r.ok) {
      console.log('[mp-webhook] MP API lookup failed:', r.status, await r.text());
      return { statusCode: 200, body: 'payment lookup failed' };
    }
    const payment = await r.json();
    console.log('[mp-webhook] payment fetched:', {
      id: payment.id,
      status: payment.status,
      external_reference: payment.external_reference,
      amount: payment.transaction_amount
    });

    const ext = String(payment.external_reference || '');
    const sep = ext.indexOf('|');
    const userId = sep > 0 ? ext.slice(0, sep) : ext;
    const plan = sep > 0 ? ext.slice(sep + 1) : 'monthly';
    if (!userId) {
      console.log('[mp-webhook] no user_id in external_reference, ignoring');
      return { statusCode: 200, body: 'no user_id in external_reference' };
    }

    const mpStatus = String(payment.status || '');
    let subStatus = 'inactive';
    if (mpStatus === 'approved' || mpStatus === 'authorized') subStatus = 'active';
    else if (mpStatus === 'pending' || mpStatus === 'in_process') subStatus = 'pending';
    else if (mpStatus === 'rejected' || mpStatus === 'cancelled') subStatus = 'canceled';
    else if (mpStatus === 'refunded' || mpStatus === 'charged_back') subStatus = 'refunded';

    let renewAt = null;
    if (subStatus === 'active') {
      const days = plan === 'yearly' ? 365 : 30;
      const paidAt = payment.date_approved ? new Date(payment.date_approved) : new Date();
      renewAt = new Date(paidAt.getTime() + days * 24 * 3600 * 1000).toISOString();
    }

    const row = {
      user_id: userId,
      stripe_customer_id: payment.payer && payment.payer.id ? String(payment.payer.id) : null,
      stripe_subscription_id: String(payment.id || ''),
      status: subStatus,
      price_id: plan,
      current_period_end: renewAt,
      cancel_at_period_end: false
    };

    console.log('[mp-webhook] upserting subscription row:', row);
    const upRes = await fetch(supaUrl + '/rest/v1/subscriptions?on_conflict=user_id', {
      method: 'POST',
      headers: {
        'apikey': supaService,
        'Authorization': 'Bearer ' + supaService,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(row)
    });
    if (!upRes.ok) {
      const errText = await upRes.text();
      console.log('[mp-webhook] UPSERT FAILED:', upRes.status, errText);
      return { statusCode: 200, body: 'upsert failed: ' + errText.slice(0, 200) };
    }
    console.log('[mp-webhook] upsert OK, user', userId, '-> status', subStatus);

    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    console.log('[mp-webhook] handler error:', e.message);
    return { statusCode: 500, body: 'handler error: ' + (e.message || e) };
  }
};
