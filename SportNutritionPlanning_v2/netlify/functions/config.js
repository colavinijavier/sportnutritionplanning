// netlify/functions/config.js
// Returns the public client-side config from Netlify env vars.
// Public-safe fields only (no secret tokens).

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };

  const mpEnabled = !!process.env.MP_ACCESS_TOKEN;
  const stripeEnabled = !!process.env.STRIPE_PUBLISHABLE_KEY && !!process.env.STRIPE_SECRET_KEY;

  return {
    statusCode: 200,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    body: JSON.stringify({
      supabase: {
        url: process.env.SUPABASE_URL || '',
        anonKey: process.env.SUPABASE_ANON_KEY || ''
      },
      mercadopago: {
        priceMonthlyARS: Number(process.env.MP_PRICE_MONTHLY_ARS || 0),
        priceYearlyARS:  Number(process.env.MP_PRICE_YEARLY_ARS  || 0)
      },
      stripe: {
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        priceMonthly: process.env.STRIPE_PRICE_MONTHLY || '',
        priceYearly:  process.env.STRIPE_PRICE_YEARLY  || ''
      },
      features: {
        authEnabled:    !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY,
        billingEnabled: mpEnabled || stripeEnabled,
        paymentProvider: mpEnabled ? 'mercadopago' : (stripeEnabled ? 'stripe' : 'none')
      }
    })
  };
};
