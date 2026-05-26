// netlify/functions/mp-create-preference.js
// Creates a MercadoPago Checkout Pro preference for Pro subscription.
//
// Env vars required:
//   MP_ACCESS_TOKEN          — TEST-... or APP_USR-... (server-side token)
//   MP_PRICE_MONTHLY_ARS     — e.g. 6999
//   MP_PRICE_YEARLY_ARS      — e.g. 59000
//   SITE_URL                 — https://sportnutritionplanning.netlify.app

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return jsonResp(405, { error: 'Method not allowed' });

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return jsonResp(500, { error: 'MP_ACCESS_TOKEN not configured' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return jsonResp(400, { error: 'Invalid JSON' }); }
  const { user_id, email, plan } = body;
  if (!user_id || !email) return jsonResp(400, { error: 'Missing user_id or email' });

  const isYearly = plan === 'yearly';
  const priceARS = Number(isYearly
    ? (process.env.MP_PRICE_YEARLY_ARS || 59000)
    : (process.env.MP_PRICE_MONTHLY_ARS || 6999));
  const titleES = isYearly ? 'SportNutritionPlanning Pro — Anual' : 'SportNutritionPlanning Pro — Mensual';

  const siteUrl = process.env.SITE_URL || ('https://' + ((event.headers && event.headers.host) || 'sportnutritionplanning.netlify.app'));

  const preference = {
    items: [{
      id: isYearly ? 'snp_pro_yearly' : 'snp_pro_monthly',
      title: titleES,
      description: 'Suscripción Pro para planificación nutricional con IA',
      quantity: 1,
      currency_id: 'ARS',
      unit_price: priceARS,
      category_id: 'services'
    }],
    payer: { email: email },
    back_urls: {
      success: siteUrl + '/account.html?mp=success',
      failure: siteUrl + '/account.html?mp=failure',
      pending: siteUrl + '/account.html?mp=pending'
    },
    auto_return: 'approved',
    external_reference: user_id + '|' + (isYearly ? 'yearly' : 'monthly'),
    notification_url: siteUrl + '/.netlify/functions/mp-webhook',
    metadata: { user_id: user_id, plan: isYearly ? 'yearly' : 'monthly' },
    statement_descriptor: 'SNPPLANNING',
    binary_mode: false
  };

  try {
    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preference)
    });
    const j = await res.json();
    if (!res.ok) return jsonResp(res.status, { error: (j.message || j.error || 'MercadoPago API error') });

    // Detect test mode from the access token: the productivo app id for
    // SportNutritionPlanning is 6058049026022185. Any other app id is a
    // TESTUSER's app (e.g. when MP_ACCESS_TOKEN is set to a test credential).
    // In that case the productivo init_point won't work for the buyer; only
    // the sandbox URL handles test users + sandbox cards.
    const PROD_APP_ID = '6058049026022185';
    const tokenAppId = (accessToken.split('-')[1]) || '';
    const isTestMode = tokenAppId !== PROD_APP_ID;
    const redirectUrl = isTestMode ? (j.sandbox_init_point || j.init_point) : j.init_point;

    return jsonResp(200, {
      id: j.id,
      init_point: redirectUrl,
      sandbox_init_point: j.sandbox_init_point,
      test_mode: isTestMode
    });
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
