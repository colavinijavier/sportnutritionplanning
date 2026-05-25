// netlify/functions/generate-plan.js
// Receives onboarding data and produces a complete weekly plan via Claude.
// Optimized for sub-25s response: compact prompt + capped tokens.

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
    return jsonResp(400, { error: 'Missing required profile fields' });
  }

  const lang = (input.lang === 'es') ? 'es' : 'en';
  const primary = computeTargets({
    age: input.age, sex: input.sex, height: input.height, weight: input.weight,
    trains: input.trains === 'yes', days: input.days || 0,
    intensity: input.intensity || 'mid', goal: input.goal || 'health'
  });

  const members = (input.household === 'family' && Array.isArray(input.members))
    ? input.members.map(m => ({
        name: m.name || '-', age: m.age, sex: m.sex || 'male', sport: m.sport || '',
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
        max_tokens: 3500,
        system: lang === 'es'
          ? 'Sos un nutricionista deportivo. Respondes UNICAMENTE con JSON COMPACTO valido (sin markdown, sin espacios extra, sin saltos de linea innecesarios). Empezas con { y terminas con }.'
          : 'You are a sports nutritionist. Respond ONLY with COMPACT valid JSON (no markdown, no extra whitespace, no unnecessary newlines). Start with { and end with }.',
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
      return jsonResp(500, { error: 'Claude returned invalid JSON', raw: text.slice(0, 400) });
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
    return jsonResp(500, { error: e.message || 'Unknown error' });
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
  const restrictions = (profile.restrictions || []).join(', ') || (lang === 'es' ? 'ninguna' : 'none');
  const dislikes = (profile.dislikes || '').slice(0, 150);
  const trainingLine = (profile.trains === 'yes')
    ? profile.sport + ' ' + profile.days + 'd/wk ' + profile.intensity
    : (lang === 'es' ? 'sedentario' : 'sedentary');

  const memberSummary = members.length > 0
    ? members.map(m => m.name + '(' + m.sex[0] + ',' + m.age + ',' + m.targets.kcal + 'kcal)').join('; ')
    : '';

  const familyHint = members.length > 0
    ? '\nFAMILIA(' + (members.length+1) + '): primary ' + primary.kcal + 'kcal + ' + memberSummary
    : '';

  const isES = lang === 'es';
  const langName = isES ? 'spanish' : 'english';
  const dayNames = isES ? 'Lunes,Martes,Miercoles,Jueves,Viernes,Sabado,Domingo' : 'Mon,Tue,Wed,Thu,Fri,Sat,Sun';

  const schema = '{"welcome":"<one sentence, ' + langName + '>","tips":["t1","t2","t3"],"days":[{"name":"<day>","is_training_day":<bool>,"meals":[{"slot":"breakfast","time":"07:30","title":"<name>","ingredients":["i1","i2","i3"],"macros":{"kcal":N,"protein_g":N,"carbs_g":N,"fat_g":N}}]}],"shopping_list":{"Proteins":[{"item":"x","quantity":"500g"}],"Vegetables":[],"Fruits":[],"Grains":[],"Dairy":[],"Pantry":[],"Other":[]}}';

  const intro = isES
    ? 'Genera plan nutricional semanal compacto. JSON sin espacios extra.'
    : 'Generate compact weekly nutrition plan. JSON with no extra whitespace.';

  return intro + '\n\nPROFILE: ' + profile.name + ',' + profile.age + 'y,' + profile.sex + ',' + profile.height + 'cm,' + profile.weight + 'kg,' + (profile.country||'-') + ',' + trainingLine + ',goal=' + (profile.goal||'health') + ',restr=' + restrictions + ',dislikes=' + (dislikes||'none') + '\nTARGETS: ' + primary.kcal + 'kcal P' + primary.protein_g + ' C' + primary.carbs_g + ' F' + primary.fat_g + familyHint + '\n\nRULES:\n- 7 days (' + dayNames + '). Each day: breakfast,lunch,snack,dinner. Training days: add pre-workout meal.\n- Each meal: 2-4 ingredients max. NO notes field.\n- macros per meal must sum to daily target +/-5%.\n- Respect restrictions strictly.\n- Shopping list: consolidate weekly totals per category. Use realistic units (kg, g, L, ml, u).\n- Output COMPACT JSON (minify), no markdown.\n\nSCHEMA (follow exactly, fill arrays with all 7 days and all categories):\n' + schema;
}

function jsonResp(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...cors, 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}
