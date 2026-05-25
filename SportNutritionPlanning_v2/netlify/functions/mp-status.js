// netlify/functions/mp-status.js
// Lets the client check subscription status from Supabase (server-side, bypasses RLS).
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'GET') return jsonResp(405, { error: 'Method not allowed' });

  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !supaKey) return jsonResp(500, { error: 'Supabase env missing' });

  const userId = event.queryStringParameters && event.queryStringParameters.user_id;
  if (!userId) return jsonResp(400, { error: 'Missing user_id' });

  try {
    const r = await fetch(
      supaUrl + '/rest/v1/subscriptions?user_id=eq.' + encodeURIComponent(userId) + '&select=*&limit=1',
      { headers: { 'apikey': supaKey, 'Authorization': 'Bearer ' + supaKey } }
    );
    const arr = await r.json();
    const sub = Array.isArray(arr) && arr[0] ? arr[0] : null;
    return jsonResp(200, {
      isPro: !!sub && sub.status === 'active',
      status: sub ? sub.status : 'none',
      plan: sub ? sub.price_id : null,
      renews_at: sub ? sub.current_period_end : null
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
