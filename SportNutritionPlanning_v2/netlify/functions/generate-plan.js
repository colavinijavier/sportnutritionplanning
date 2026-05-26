// netlify/functions/generate-plan.js
// Optimized with explicit per-meal kcal allocations + restriction-aware macros.

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
  const restrictions = Array.isArray(input.restrictions) ? input.restrictions : [];
  const primary = computeTargets({
    age: input.age, sex: input.sex, height: input.height, weight: input.weight,
    trains: input.trains === 'yes', days: input.days || 0,
    intensity: input.intensity || 'mid', goal: input.goal || 'health',
    restrictions
  });

  const members = (input.household === 'family' && Array.isArray(input.members))
    ? input.members.map(m => ({
        name: m.name || '-', age: m.age, sex: m.sex || 'male', sport: m.sport || '',
        targets: computeTargets({
          age: m.age || 30, sex: m.sex || 'male',
          height: estimateHeight(m.age, m.sex), weight: estimateWeight(m.age, m.sex),
          trains: !!m.sport, days: m.sport ? 3 : 0, intensity: 'mid', goal: 'health',
          restrictions
        })
      })) : [];

  const prompt = buildPrompt({ profile: input, primary, members, lang });

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 6500,
        system: lang === 'es'
          ? 'Sos un nutricionista deportivo experto. Respondes SOLO con JSON compacto valido (sin markdown). CRITICO: cada dia debe sumar EXACTAMENTE el target kcal (margen +/- 3%) y respetar carbs/proteina/grasa target. Usa las allocaciones explicitas por tipo de dia.'
          : 'You are an expert sports nutritionist. Respond ONLY with compact valid JSON (no markdown). CRITICAL: each day must sum to EXACTLY the daily kcal target (within +/-3%) and respect carb/protein/fat targets. Use the explicit per-meal allocations.',
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
    const stopReason = (data && data.stop_reason) || 'unknown';
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
    }

    // Robust JSON extraction: tolerate prefix/suffix prose around the JSON object.
    function tryParseJson(s) {
      try { return JSON.parse(s); } catch (e) { return null; }
    }
    let plan = tryParseJson(text);
    if (!plan) {
      // Slice from first '{' to the last '}' that balances braces.
      const first = text.indexOf('{');
      if (first >= 0) {
        let depth = 0, end = -1, inStr = false, esc = false;
        for (let i = first; i < text.length; i++) {
          const ch = text[i];
          if (esc) { esc = false; continue; }
          if (ch === '\\') { esc = true; continue; }
          if (ch === '"') { inStr = !inStr; continue; }
          if (inStr) continue;
          if (ch === '{') depth++;
          else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end > first) plan = tryParseJson(text.slice(first, end + 1));
      }
    }
    if (!plan) {
      console.error('[generate-plan] JSON parse failed. stop_reason=' + stopReason + ' len=' + text.length + ' tail=' + text.slice(-200));
      const friendly = stopReason === 'max_tokens'
        ? 'El plan generado fue demasiado largo. Probá con menos miembros familiares o reintentá.'
        : 'No pudimos generar el plan. Reintentá en un momento.';
      return jsonResp(500, { error: friendly, stop_reason: stopReason, raw: text.slice(0, 400) });
    }

    const validation = validatePlan(plan, primary);

    plan.targets = primary;
    plan.profile_snapshot = {
      name: input.name, age: input.age, sex: input.sex,
      height: input.height, weight: input.weight, country: input.country,
      sport: input.sport || null, goal: input.goal || null,
      restrictions, household: input.household,
      members: members.map(m => ({ name: m.name, age: m.age, sex: m.sex, targets: m.targets }))
    };
    plan.validation = validation;
    plan.generated_at = new Date().toISOString();
    plan.lang = lang;
    plan.version = 3;

    return jsonResp(200, { plan, usage: data.usage });
  } catch (e) {
    return jsonResp(500, { error: e.message || 'Unknown error' });
  }
};

function validatePlan(plan, targets) {
  const target = targets.kcal;
  const targetC = targets.carbs_g;
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
      carbs_pct_of_target: targetC ? Math.round(sums.carbs_g / targetC * 100) : 0,
      in_range: sums.kcal >= lower && sums.kcal <= upper
    };
  });
  const all_ok = days.every(d => d.in_range);
  const weekly = days.reduce((a, d) => {
    a.kcal += d.sums.kcal;
    a.protein_g += d.sums.protein_g;
    a.carbs_g += d.sums.carbs_g;
    a.fat_g += d.sums.fat_g;
    return a;
  }, { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  weekly.kcal_avg = Math.round(weekly.kcal / (days.length || 1));
  weekly.protein_avg = Math.round(weekly.protein_g / (days.length || 1));
  weekly.carbs_avg = Math.round(weekly.carbs_g / (days.length || 1));
  weekly.fat_avg = Math.round(weekly.fat_g / (days.length || 1));
  return { target_kcal: target, target_carbs: targetC, days, all_ok, weekly };
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

  // Restriction-aware macro distribution
  const restr = Array.isArray(p.restrictions) ? p.restrictions : [];
  const isLowCarb = restr.indexOf('low_carb') !== -1;
  const isKeto = restr.indexOf('keto') !== -1;

  // Protein per kg
  let pPerKg = 1.6;
  if (p.trains) {
    if (p.intensity === 'high') pPerKg = 2.0;
    else if (p.intensity === 'mid') pPerKg = 1.8;
    else pPerKg = 1.6;
    if (p.goal === 'gain') pPerKg += 0.2;
    if (p.goal === 'lose') pPerKg += 0.2;
  }
  // For keto bump protein a bit, but keep it moderate so fat dominates
  if (isKeto) pPerKg = Math.min(pPerKg + 0.1, 2.0);
  const protein_g = Math.round(p.weight * pPerKg);

  // Carb allocation by restriction
  // Default: ~50% kcal from carbs
  // Low carb: ~20% kcal from carbs
  // Keto: ~5% kcal from carbs
  let carbPct = 0.50;
  if (isKeto) carbPct = 0.05;
  else if (isLowCarb) carbPct = 0.20;
  let carbs_g = Math.round(kcal * carbPct / 4);

  // Floor: never less than ~50g/day for low_carb (minimum for brain function in non-keto)
  if (!isKeto && carbs_g < 50) carbs_g = 50;
  if (isKeto && carbs_g > 30) carbs_g = 30; // ceiling for keto

  // Fat = remaining kcal
  const fat_g = Math.max(20, Math.round((kcal - protein_g * 4 - carbs_g * 4) / 9));

  const fiber_g = Math.round(kcal / 1000 * 14);
  const water_ml = Math.round(p.weight * 35);
  return {
    bmr: Math.round(bmr), tdee: kcal, kcal,
    protein_g, carbs_g, fat_g, fiber_g, water_ml,
    activity_factor: Number(factor.toFixed(2)),
    macro_mode: isKeto ? 'keto' : isLowCarb ? 'low_carb' : 'standard'
  };
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

  const K = primary.kcal;
  const P = primary.protein_g;
  const C = primary.carbs_g;
  const F = primary.fat_g;

  // TRAINING day allocation (5 meals)
  const tB = Math.round(K * 0.22), tL = Math.round(K * 0.28), tS = Math.round(K * 0.08), tPW = Math.round(K * 0.12), tD = Math.round(K * 0.30);
  const tBp = Math.round(P * 0.25), tLp = Math.round(P * 0.28), tSp = Math.round(P * 0.10), tPWp = Math.round(P * 0.05), tDp = Math.round(P * 0.32);
  const tSum = tB + tL + tS + tPW + tD;
  // REST day allocation (4 meals)
  const rB = Math.round(K * 0.25), rL = Math.round(K * 0.35), rS = Math.round(K * 0.10), rD = Math.round(K * 0.30);
  const rBp = Math.round(P * 0.25), rLp = Math.round(P * 0.32), rSp = Math.round(P * 0.10), rDp = Math.round(P * 0.33);
  const rSum = rB + rL + rS + rD;

  const isES = lang === 'es';
  const langName = isES ? 'spanish (Argentina-friendly)' : 'english';
  const dayNames = isES ? 'Lunes,Martes,Miercoles,Jueves,Viernes,Sabado,Domingo' : 'Mon,Tue,Wed,Thu,Fri,Sat,Sun';

  const schema = '{"welcome":"<one sentence, ' + langName + '>","tips":["t1","t2","t3"],"days":[{"name":"<day>","is_training_day":<bool>,"meals":[{"slot":"breakfast","time":"07:30","title":"<name>","ingredients":["100g oats","1 banana","30g whey"],"macros":{"kcal":N,"protein_g":N,"carbs_g":N,"fat_g":N}}]}],"shopping_list":{"Proteins":[{"item":"x","quantity":"500g"}],"Vegetables":[],"Fruits":[],"Grains":[],"Dairy":[],"Pantry":[],"Other":[]}}';

  const intro = isES
    ? 'Genera plan nutricional semanal. JSON compacto sin espacios extra.'
    : 'Generate weekly nutrition plan. Compact JSON, no extra whitespace.';

  // Diet mode guidance
  let dietNote = '';
  if (primary.macro_mode === 'keto') {
    dietNote = '\n\nDIET MODE: KETOGENIC. STRICTLY <30g carbs/day. NO bread, pasta, rice, potato, sugar, most fruits. USE: fatty fish, avocado, olive oil, nuts, eggs, cheese, leafy greens, berries (small). High fat is ESSENTIAL.';
  } else if (primary.macro_mode === 'low_carb') {
    dietNote = '\n\nDIET MODE: LOW CARB. Target ~' + C + 'g carbs/day total (NOT more). AVOID: bread/pasta/rice/potato as main carb. USE: vegetables, berries, legumes (small), nuts, dairy. Carb sources should be vegetables and small whole grains only.';
  }

  let dayPlan;
  if (trains && profile.days > 0) {
    const trainingSchedules = {
      1: ['Wed'], 2: ['Mon','Thu'], 3: ['Mon','Wed','Fri'],
      4: ['Mon','Wed','Fri','Sat'], 5: ['Mon','Tue','Wed','Fri','Sat'],
      6: ['Mon','Tue','Wed','Thu','Fri','Sat'], 7: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    };
    const trainAbbr = trainingSchedules[profile.days] || trainingSchedules[3];
    const allAbbr = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const allNames = isES ? ['Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo'] : allAbbr;
    dayPlan = allAbbr.map((d, i) => allNames[i] + (trainAbbr.includes(d) ? ' [TRAINING]' : ' [REST]')).join(', ');
  } else {
    dayPlan = 'all 7 days REST (no training)';
  }

  const allocBlock = trains
    ? 'TRAINING DAY ALLOCATION (5 meals, MUST sum to ' + tSum + ' kcal):\n' +
      '  breakfast: ' + tB + ' kcal, ' + tBp + 'g protein\n' +
      '  lunch: ' + tL + ' kcal, ' + tLp + 'g protein\n' +
      '  snack: ' + tS + ' kcal, ' + tSp + 'g protein\n' +
      '  preworkout: ' + tPW + ' kcal, ' + tPWp + 'g protein (carb-rich, before training)\n' +
      '  dinner: ' + tD + ' kcal, ' + tDp + 'g protein\n\n' +
      'REST DAY ALLOCATION (4 meals, MUST sum to ' + rSum + ' kcal — LARGER portions than training-day meals to compensate for missing preworkout):\n' +
      '  breakfast: ' + rB + ' kcal, ' + rBp + 'g protein\n' +
      '  lunch: ' + rL + ' kcal, ' + rLp + 'g protein\n' +
      '  snack: ' + rS + ' kcal, ' + rSp + 'g protein\n' +
      '  dinner: ' + rD + ' kcal, ' + rDp + 'g protein'
    : 'DAILY ALLOCATION (4 meals, MUST sum to ' + rSum + ' kcal):\n' +
      '  breakfast: ' + rB + ' kcal, ' + rBp + 'g protein\n' +
      '  lunch: ' + rL + ' kcal, ' + rLp + 'g protein\n' +
      '  snack: ' + rS + ' kcal, ' + rSp + 'g protein\n' +
      '  dinner: ' + rD + ' kcal, ' + rDp + 'g protein';

  return intro + '\n\nPROFILE: ' + profile.name + ',' + profile.age + 'y,' + profile.sex + ',' + profile.height + 'cm,' + profile.weight + 'kg,' + (profile.country||'-') + ',' + trainingLine + ',goal=' + (profile.goal||'health') + ',restr=' + restrictions + ',dislikes=' + (dislikes||'none') + familyHint + dietNote + '\n\nDAILY TARGET (HIT EXACTLY): ' + K + ' kcal | ' + P + 'g protein | ' + C + 'g carbs | ' + F + 'g fat\n\n' + allocBlock + '\n\nDAY SCHEDULE: ' + dayPlan + '\n\nRULES:\n1. Generate EXACTLY 7 days using these names: ' + dayNames + '.\n2. Each meal: 3-5 ingredients WITH quantities (e.g., "150g chicken breast","200g sweet potato").\n3. **CRITICAL**: each day MUST sum to ' + K + ' kcal ±3% AND ~' + C + 'g carbs (NOT more for low-carb/keto).\n4. Respect ALL restrictions strictly. NEVER use forbidden ingredients.\n5. Vary ingredients across the week.\n6. Shopping list: consolidate WEEKLY totals per category. Realistic units (kg, g, L, ml, u).\n7. Tips: 3 short actionable tips for this profile.\n8. Output COMPACT JSON, no markdown.\n\nSCHEMA:\n' + schema;
}

function jsonResp(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...cors, 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}
