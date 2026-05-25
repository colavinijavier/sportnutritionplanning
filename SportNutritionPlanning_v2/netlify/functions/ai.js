// netlify/functions/ai.js
// Puente entre el NutriPlan HTML y la API de Anthropic Claude.
// La API key se guarda en variables de entorno de Netlify (NUNCA en el HTML cliente).

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResp(500, { error: 'ANTHROPIC_API_KEY no configurada. En Netlify: Site settings -> Environment variables -> Add a variable.' });
  }

  let body;
  try { body = JSON.parse(event.body); } catch (e) { return jsonResp(400, { error: 'JSON invalido en el request' }); }

  const prompt = body.prompt;
  const maxTokens = body.maxTokens || 1024;
  const system = body.system;
  if (!prompt || typeof prompt !== 'string') return jsonResp(400, { error: 'Falta el campo prompt (string)' });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: Math.min(maxTokens, 2048),
        system: system || 'Sos un asistente nutricional argentino. CRITICO: respondes UNICAMENTE con un objeto JSON puro (raw JSON, sin markdown, sin code fences, sin comentarios, sin explicaciones). Empezas directo con { y terminas con }. Seguis EXACTAMENTE la estructura JSON que se te pida en el prompt del usuario.',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      let errMsg = 'Anthropic API error ' + res.status;
      try {
        const j = JSON.parse(errText);
        if (j.error && j.error.message) errMsg = j.error.message;
      } catch (e) {}
      return jsonResp(res.status, { error: errMsg.slice(0, 400) });
    }

    const data = await res.json();
    let text = '';
    if (data.content && data.content[0] && data.content[0].text) text = data.content[0].text;
    text = text.trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
    }
    return jsonResp(200, { text: text, model: data.model, usage: data.usage });
  } catch (e) {
    return jsonResp(500, { error: e.message || 'Error desconocido en la funcion' });
  }
};

function jsonResp(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}
