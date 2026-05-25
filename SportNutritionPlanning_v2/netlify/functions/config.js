// netlify/functions/config.js
// Returns the public client-side config (Supabase URL+anon key, Stripe publishable key,
// Stripe price IDs) from Netlify environment variables.
// These values are PUBLIC by design — they're shipped to browsers anyway.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };

  return {
    statusCode: 200,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    body: JSON.stringify({
      supabase: {
        url: process.env.SUPABASE_URL || '',
        anonKey: process.env.SUPABASE_ANON_KEY || ''
      },
      stripe: {
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        priceMonthly: process.env.STRIPE_PRICE_MONTHLY || '',
        priceYearly:  process.env.STRIPE_PRICE_YEARLY  || ''
      },
      features: {
        authEnabled:    !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY,
        billingEnabled: !!process.env.STRIPE_PUBLISHABLE_KEY && !!process.env.STRIPE_SECRET_KEY
      }
    })
  };
};
