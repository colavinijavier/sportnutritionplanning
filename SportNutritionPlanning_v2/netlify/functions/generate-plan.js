// netlify/functions/generate-plan.js
// Receives onboarding data and produces a complete weekly plan via Claude.
// Optimized for sub-25s response with EXPLICIT daily kcal targets per meal.

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
        max_tokens: 4096,
        system: lang === 'es'
          ? 'Sos un nutricionista deportivo experto. Respondes SOLO con JSON compacto valido (sin markdown). CRITICO: las kcal de las comidas de cada dia DEBEN sumar EXACTAMENTE el target diario (margen +/- 3%). Sin excepciones.'
          : 'You are an expert sports nutritionist. Respond ONLY with compact valid JSON (no markdown). CRITICAL: the sum of meal kcal each day MUST EQUAL the daily target (within +/-3%). No exceptions.',
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

    // Server-side validation: compute daily kcal sums and flag deviations
    const validation = validatePlan(plan, primary);

    plan.targets = primary;
    plan.profile_snapshot = {
      name: input.name, age: input.age, sex: input.sex,
      height: input.height, weight: input.weight, country: input.country,
      sport: input.sport || null, goal: input.goal || null,
      restrictions: input.restrictions || [], household: input.household,
      members: members.map(m => ({ name: m.name, age: m.age, sex: m.sex, targets: m.targets }))
    };
    plan.validation = validation;
    plan.generated_at = new Date().toISOString();
    plan.lang = lang;
    plan.version = 1;

    return jsonResp(200, { plan, usage: data.usage });
  } catch (e) {
    return jsonResp(500, { error: e.message || 'Unknown error' });
  }
};

function validatePlan(plan, targets) {
  const target = targets.kcal;
  const lower = target * 0.92;
  const upper = target * 1.08;
  const days = (plan.days || []).map(d => {
    const sums = (d.meals || []).reduce((a, m) => {
      const x = m.macros || {};
      a.kcal += x.kcal || 0;
      a.protein_g += x.protein_g || 0;
      a.carbs_g += x.carbs_g || 0;
      a.fat_g += x.fat_g || 0;
      return a;
    }, { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
    return {
      name: d.name,
      sums,
      kcal_pct_of_target: target ? Math.round(sums.kcal / target * 100) : 0,
      in_range: sums.kcal >= lower && sums.kcal <= upper
    };
  });
  const all_ok = days.every(d => d.in_range);
  return { target_kcal: target, days, all_ok };
}

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
  const trains = profile.trains === 'yes';
  const trainingLine = trains
    ? profile.sport + ' ' + profile.days + 'd/wk ' + profile.intensity
    : (lang === 'es' ? 'sedentario' : 'sedentary');

  const memberSummary = members.length > 0
    ? members.map(m => m.name + '(' + m.sex[0] + ',' + m.age + ',' + m.targets.kcal + 'kcal)').join('; ')
    : '';

  const familyHint = members.length > 0
    ? '\nHOUSEHOLD(' + (members.length+1) + '): primary ' + primary.kcal + 'kcal + ' + memberSummary + '. Each meal title/ingredients serves the WHOLE household; macros shown are PER-PERSON for the primary user.'
    : '';

  // Per-meal kcal targets (explicit allocation)
  const K = primary.kcal;
  const dist = trains
    ? { breakfast: 0.22, lunch: 0.28, snack: 0.08, preworkout: 0.12, dinner: 0.30 }
    : { breakfast: 0.25, lunch: 0.35, snack: 0.10, dinner: 0.30 };
  const allocLines = Object.entries(dist).map(([slot, pct]) =>
    '  ' + slot + ': ~' + Math.round(K * pct) + ' kcal'
  ).join('\n');

  // Per-meal protein targets
  const P = primary.protein_g;
  const proteinDist = trains
    ? { breakfast: 0.25, lunch: 0.28, snack: 0.10, preworkout: 0.05, dinner: 0.32 }
    : { breakfast: 0.25, lunch: 0.32, snack: 0.10, dinner: 0.33 };
  const protLines = Object.entries(proteinDist).map(([slot, pct]) =>
    '  ' + slot + ': ~' + Math.round(P * pct) + 'g'
  ).join('\n');

  const isES = lang === 'es';
  const langName = isES ? 'spanish (Argentina-friendly)' : 'english';
  const dayNames = isES ? 'Lunes,Martes,Miercoles,Jueves,Viernes,Sabado,Domingo' : 'Mon,Tue,Wed,Thu,Fri,Sat,Sun';

  const schema = '{"welcome":"<one sentence, ' + langName + '>","tips":["t1","t2","t3"],"days":[{"name":"<day>","is_training_day":<bool>,"meals":[{"slot":"breakfast","time":"07:30","title":"<name>","ingredients":["100g oats","1 banana","30g whey"],"macros":{"kcal":N,"protein_g":N,"carbs_g":N,"fat_g":N}}]}],"shopping_list":{"Proteins":[{"item":"x","quantity":"500g"}],"Vegetables":[],"Fruits":[],"Grains":[],"Dairy":[],"Pantry":[],"Other":[]}}';

  const intro = isES
    ? 'Genera plan nutricional semanal. JSON compacto sin espacios extra.'
    : 'Generate weekly nutrition plan. Compact JSON, no extra whitespace.';

  const trainingDays = trains
    ? '\nTRAINING DAYS (Mon, Wed, Fri, Sat for sport ' + profile.sport + '): set is_training_day=true, INCLUDE a 5th preworkout meal.'
    : '\nNO TRAINING DAYS: is_training_day=false for all days, only 4 meals per day.';

  return intro + '\n\nPROFILE: ' + profile.name + ',' + profile.age + 'y,' + profile.sex + ',' + profile.height + 'cm,' + profile.weight + 'kg,' + (profile.country||'-') + ',' + trainingLine + ',goal=' + (profile.goal||'health') + ',restr=' + restrictions + ',dislikes=' + (dislikes||'none') + familyHint + '\n\nDAILY TARGETS (MUST hit ±3% each day):\n  TOTAL: ' + K + ' kcal | ' + P + 'g protein | ' + primary.carbs_g + 'g carbs | ' + primary.fat_g + 'g fat\n\nKCAL PER MEAL (use these as guideline, total each day = ' + K + ' kcal):\n' + allocLines + '\n\nPROTEIN PER MEAL (use these as guideline, total each day = ' + P + 'g):\n' + protLines + trainingDays + '\n\nRULES:\n1. Generate ALL 7 days (' + dayNames + ').\n2. Each meal: 3-5 ingredients with quantities (e.g., "150g chicken breast","200g sweet potato").\n3. CRITICAL: sum of meal kcal each day MUST = ' + K + ' kcal ±3%. Adjust portion sizes (e.g., "200g rice" not "100g") to reach the target.\n4. Respect ALL restrictions strictly. NEVER use forbidden ingredients.\n5. Vary ingredients across the week. Each day should feel different.\n6. Shopping list: consolidate WEEKLY totals per category. Realistic units (kg, g, L, ml, u). Cover ALL ingredients used.\n7. Tips: 3 short actionable tips tailored to this profile.\n8. Output COMPACT JSON, no markdown.\n\nSCHEMA (follow exactly):\n' + schema;
}

function jsonResp(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...cors, 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}
