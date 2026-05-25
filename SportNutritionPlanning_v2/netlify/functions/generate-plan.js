// netlify/functions/generate-plan.js
// Receives onboarding data and produces a complete weekly plan via Claude.
// Server-side computes BMR/TDEE/macro targets so the AI works with validated numbers.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return jsonResp(405, { error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return jsonResp(500, { error: 'ANTHROPIC_API_KEY not configured' });

  let input;
  try { input = JSON.parse(event.body); } catch (e) { return jsonResp(400, { error: 'Invalid JSON' }); }

  if (!input.name || !input.age || !input.sex || !input.height || !input.weight) {
    return jsonResp(400, { error: 'Missing required profile fields (name, age, sex, height, weight).' });
  }

  const lang = (input.lang === 'es') ? 'es' : 'en';
  const primary = computeTargets({
    age: input.age, sex: input.sex, height: input.height, weight: input.weight,
    trains: input.trains === 'yes', days: input.days || 0,
    intensity: input.intensity || 'mid', goal: input.goal || 'health'
  });

  const members = (input.household === 'family' && Array.isArray(input.members))
    ? input.members.map(m => ({
        name: m.name || '—', age: m.age, sex: m.sex || 'male', sport: m.sport || '',
        targets: computeTargets({
          age: m.age || 30, sex: m.sex || 'male',
          height: estimateHeight(m.age, m.sex), weight: estimateWeight(m.age, m.sex),
          trains: !!m.sport, days: m.sport ? 3 : 0, intensity: 'mid', goal: 'health'
        })
      })) : [];

  const prompt = buildPrompt({ profile: input, primary, members, lang });

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8192,
        system: lang === 'es'
          ? 'Sos un nutricionista deportivo experto. Respondés UNICAMENTE con JSON puro válido (sin markdown, sin code fences, sin texto extra). Empezás directo con { y terminás con }. Seguís EXACTAMENTE la estructura indicada en el prompt.'
          : 'You are an expert sports nutritionist. You respond ONLY with valid raw JSON (no markdown, no code fences, no extra text). You start directly with { and end with }. You follow EXACTLY the structure indicated in the prompt.',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      let errMsg = 'Anthropic API error ' + claudeRes.status;
      try { const j = JSON.parse(errText); if (j.error && j.error.message) errMsg = j.error.message; } catch(e){}
      return jsonResp(claudeRes.status, { error: errMsg.slice(0, 400) });
    }

    const data = await claudeRes.json();
    let text = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text.trim() : '';
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
    }

    let plan;
    try { plan = JSON.parse(text); }
    catch (e) {
      return jsonResp(500, { error: 'Claude returned invalid JSON. Try again.', raw: text.slice(0, 600) });
    }

    plan.targets = primary;
    plan.profile_snapshot = {
      name: input.name, age: input.age, sex: input.sex,
      height: input.height, weight: input.weight, country: input.country,
      sport: input.sport || null, goal: input.goal || null,
      restrictions: input.restrictions || [], household: input.household,
      members: members.map(m => ({ name: m.name, age: m.age, sex: m.sex, targets: m.targets }))
    };
    plan.generated_at = new Date().toISOString();
    plan.lang = lang;
    plan.version = 1;

    return jsonResp(200, { plan, usage: data.usage });
  } catch (e) {
    return jsonResp(500, { error: e.message || 'Unknown function error' });
  }
};

function computeTargets(p) {
  const bmr = (10 * p.weight) + (6.25 * p.height) - (5 * p.age) + (p.sex === 'male' ? 5 : -161);
  let factor = 1.2;
  if (p.trains && p.days > 0) {
    if (p.days <= 2) factor = 1.375;
    else if (p.days <= 4) factor = 1.55;
    else if (p.days <= 6) factor = 1.725;
    else factor = 1.9;
    if (p.intensity === 'low') factor -= 0.075;
    if (p.intensity === 'high') factor += 0.075;
  }
  let tdee = bmr * factor;
  if (p.goal === 'lose') tdee *= 0.82;
  else if (p.goal === 'gain') tdee *= 1.12;
  else if (p.goal === 'recomp') tdee *= 0.95;

  const kcal = Math.round(tdee);
  let pPerKg = 1.6;
  if (p.trains) {
    if (p.intensity === 'high') pPerKg = 2.0;
    else if (p.intensity === 'mid') pPerKg = 1.8;
    else pPerKg = 1.6;
    if (p.goal === 'gain') pPerKg += 0.2;
    if (p.goal === 'lose') pPerKg += 0.2;
  }
  const protein_g = Math.round(p.weight * pPerKg);
  const fat_g = Math.round(kcal * 0.27 / 9);
  const carbs_g = Math.round((kcal - protein_g * 4 - fat_g * 9) / 4);
  const fiber_g = Math.round(kcal / 1000 * 14);
  const water_ml = Math.round(p.weight * 35);

  return { bmr: Math.round(bmr), tdee: kcal, kcal, protein_g, carbs_g, fat_g, fiber_g, water_ml, activity_factor: Number(factor.toFixed(2)) };
}

function estimateHeight(age, sex) {
  if (!age) return 170;
  if (age < 3) return 90;
  if (age < 10) return 90 + (age - 3) * 6;
  if (age < 18) return sex === 'female' ? 130 + (age - 10) * 4 : 130 + (age - 10) * 5;
  return sex === 'female' ? 163 : 175;
}
function estimateWeight(age, sex) {
  if (!age) return 70;
  if (age < 3) return 12;
  if (age < 10) return 12 + (age - 3) * 3;
  if (age < 18) return sex === 'female' ? 35 + (age - 10) * 4 : 35 + (age - 10) * 5;
  return sex === 'female' ? 62 : 75;
}

function buildPrompt({ profile, primary, members, lang }) {
  const isFamily = members.length > 0;
  const restrictions = (profile.restrictions || []).join(', ') || (lang === 'es' ? 'ninguna' : 'none');
  const dislikes = (profile.dislikes || '').slice(0, 200) || (lang === 'es' ? 'ninguno' : 'none');
  const trainingLine = (profile.trains === 'yes')
    ? `${profile.sport} ${profile.days}x/week ${profile.intensity} intensity in the ${profile.timing}`
    : (lang === 'es' ? 'no entrena regularmente' : 'does not train regularly');

  const memberSummary = members.map((m, i) => (
    `  - ${m.name || '#'+(i+1)} (${m.sex}, ${m.age}y${m.sport ? ', '+m.sport : ''}) -> ${m.targets.kcal} kcal, ${m.targets.protein_g}g P`
  )).join('\n');

  const familyBlock = isFamily ? `\nHOUSEHOLD (${members.length + 1} people total):\n  - ${profile.name} (primary, ${profile.sex}, ${profile.age}y) -> ${primary.kcal} kcal\n${memberSummary}\n` : `\nSOLO USER\n`;

  const intro = lang === 'es'
    ? 'Genera un plan nutricional semanal completo. Usa las cantidades objetivo calculadas. Cantidades realistas y practicas.'
    : 'Generate a complete weekly nutrition plan. Use the calculated targets. Realistic per-meal quantities.';

  const structure = lang === 'es' ? STRUCTURE_ES : STRUCTURE_EN;

  return `${intro}

USER:
- Name: ${profile.name}, Age: ${profile.age}, Sex: ${profile.sex}
- Height: ${profile.height}cm, Weight: ${profile.weight}kg
- Country: ${profile.country || '-'} ${profile.city || ''}
- Training: ${trainingLine}
- Goal: ${profile.goal || 'health'}
- Restrictions: ${restrictions}
- Dislikes: ${dislikes}
- Output language: ${lang === 'es' ? 'Spanish' : 'English'}

DAILY TARGETS: ${primary.kcal} kcal, ${primary.protein_g}g P, ${primary.carbs_g}g C, ${primary.fat_g}g F, ${primary.fiber_g}g fiber
${familyBlock}

RULES:
1. 7 days (Mon-Sun). Each day: breakfast, lunch, snack, dinner. Training days add 5th peri-workout meal.
2. Hit daily targets within +/-5%. Per-meal macros sum to daily total.
3. Respect ALL restrictions strictly.
4. Training days have more carbs around training time.
5. Vary ingredients across the week.
6. Shopping list: consolidate quantities, group by category.
7. Welcome message (3 lines max) and 3 tips for this profile.

RESPOND WITH EXACTLY THIS JSON (no markdown, no extra text):
${structure}`;
}

const STRUCTURE_EN = `{
  "welcome": "Short personalized welcome.",
  "tips": ["Tip 1", "Tip 2", "Tip 3"],
  "weekly_macros_avg": { "kcal": 2400, "protein_g": 150, "carbs_g": 270, "fat_g": 75 },
  "days": [
    {
      "name": "Monday",
      "is_training_day": true,
      "meals": [
        { "slot": "breakfast", "time": "07:30", "title": "Meal name", "ingredients": ["100g oats", "1 banana"], "macros": { "kcal": 520, "protein_g": 38, "carbs_g": 72, "fat_g": 10 }, "notes": "" }
      ]
    }
  ],
  "shopping_list": {
    "Proteins": [{ "item": "Chicken breast", "quantity": "1.4 kg" }],
    "Vegetables": [], "Fruits": [], "Grains": [], "Dairy": [], "Pantry": [], "Other": []
  }
}`;

const STRUCTURE_ES = `{
  "welcome": "Mensaje de bienvenida breve.",
  "tips": ["Tip 1", "Tip 2", "Tip 3"],
  "weekly_macros_avg": { "kcal": 2400, "protein_g": 150, "carbs_g": 270, "fat_g": 75 },
  "days": [
    {
      "name": "Lunes",
      "is_training_day": true,
      "meals": [
        { "slot": "breakfast", "time": "07:30", "title": "Nombre", "ingredients": ["100g avena", "1 banana"], "macros": { "kcal": 520, "protein_g": 38, "carbs_g": 72, "fat_g": 10 }, "notes": "" }
      ]
    }
  ],
  "shopping_list": {
    "Proteinas": [{ "item": "Pechuga de pollo", "quantity": "1.4 kg" }],
    "Verduras": [], "Frutas": [], "Cereales": [], "Lacteos": [], "Almacen": [], "Otros": []
  }
}`;

function jsonResp(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...cors, 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}
