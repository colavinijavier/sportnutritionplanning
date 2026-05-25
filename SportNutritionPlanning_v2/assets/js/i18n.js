// SportNutritionPlanning — i18n module
// Auto-detects browser language, defaults to English. Persists choice in localStorage.

(function (global) {
  const DICT = {
    en: {
      // Nav
      'nav.features':  'Features',
      'nav.howit':     'How it works',
      'nav.pricing':   'Pricing',
      'nav.faq':       'FAQ',
      'nav.login':     'Log in',
      'nav.signup':    'Get started',
      'nav.account':   'My account',
      'nav.app':       'Open app',

      // Hero
      'hero.badge':    'AI-powered nutrition for athletes & families',
      'hero.title':    'Your weekly nutrition plan, tuned to your sport and your family.',
      'hero.lead':     'Answer five questions and our AI builds a complete weekly meal plan, shopping list, and macro tracker — for you alone or for your whole family. Train smarter. Eat better. Spend less time planning.',
      'hero.cta_primary':  'Build my plan — free',
      'hero.cta_secondary':'How it works',
      'hero.meta':     'No credit card required · 24 nutrients tracked · Built for athletes & families',

      // Features
      'features.title':    'Everything you need to eat for performance',
      'features.subtitle': 'From a quick weekly menu to deep training-day periodization. Free covers the basics, Pro unlocks the deep stuff.',
      'features.f1.title': 'Sport-first',
      'features.f1.desc':  'Tell us your sport, training days and intensity. Your plan adapts the macros, the calories and the meal timing around your sessions.',
      'features.f2.title': 'Family-friendly',
      'features.f2.desc':  'One plan for the whole house. Each member gets the right portion based on age, gender, weight and activity. The shopping list scales automatically.',
      'features.f3.title': 'AI you can talk to',
      'features.f3.desc':  'Don\'t like an meal? Swap it. Need more protein on training days? Ask. Vegetarian on Wednesdays only? Done.',
      'features.f4.title': '24-nutrient tracker',
      'features.f4.desc':  'Not just protein, carbs and fats — we track 24 micronutrients vs. official daily reference intakes for your age and gender.',
      'features.f5.title': 'Smart shopping list',
      'features.f5.desc':  'A consolidated weekly cart, sorted by aisle, with quantities scaled to your family. Pro: direct deep-links to your local supermarket.',
      'features.f6.title': 'Sync with your calendar',
      'features.f6.desc':  'Pro: meals show up in Google or Apple Calendar — breakfast, lunch, dinner — so the whole house gets a reminder.',

      // How it works
      'how.title':     'Three steps. Five minutes.',
      'how.s1.title':  '1. Tell us about you',
      'how.s1.desc':   'Age, sex, weight, sport, training schedule, food restrictions. Five short questions.',
      'how.s2.title':  '2. AI builds your plan',
      'how.s2.desc':   'Claude generates a balanced weekly menu, hits your macro targets, and respects your restrictions.',
      'how.s3.title':  '3. Refine & cook',
      'how.s3.desc':   'Swap any meal, scale the shopping list, sync to your calendar, and track adherence as you go.',

      // Pricing
      'pricing.title':    'Simple pricing. No surprises.',
      'pricing.subtitle': 'Free forever for individuals. Go Pro when you\'re ready for advanced features.',
      'pricing.free.name': 'Free',
      'pricing.free.price': '$0',
      'pricing.free.period': '/ forever',
      'pricing.free.cta': 'Start free',
      'pricing.free.f1': '1 personal profile',
      'pricing.free.f2': 'AI-generated weekly meal plan (up to 4 regenerations / month)',
      'pricing.free.f3': 'Weekly shopping list',
      'pricing.free.f4': '24-nutrient daily tracker',
      'pricing.free.f5': 'Manual meal editing',
      'pricing.free.f6': 'Bilingual (EN/ES)',

      'pricing.pro.name': 'Pro',
      'pricing.pro.price': '$6.99',
      'pricing.pro.period': '/ month',
      'pricing.pro.yearly': 'or $59/year — save 30%',
      'pricing.pro.cta': 'Go Pro',
      'pricing.pro.ribbon': 'Most popular',
      'pricing.pro.f1': 'Everything in Free',
      'pricing.pro.f2': 'Family group: up to 6 linked members',
      'pricing.pro.f3': 'Unlimited AI regenerations + chat with your nutrition coach',
      'pricing.pro.f4': 'Sport mode: peri-workout meals, carb cycling, periodization',
      'pricing.pro.f5': 'Export to Excel & PDF',
      'pricing.pro.f6': 'Google & Apple Calendar sync',
      'pricing.pro.f7': 'Progress dashboard (adherence, macro evolution)',
      'pricing.pro.f8': 'Supermarket deep-links (Coto, Carrefour, Whole Foods, more)',
      'pricing.pro.f9': 'Recipe book with step-by-step prep',
      'pricing.pro.f10':'4-week ahead planning',
      'pricing.pro.f11':'Priority support',

      // FAQ
      'faq.title':     'Frequently asked',
      'faq.q1':        'Is this really free?',
      'faq.a1':        'Yes. The Free tier is generous and we keep it that way forever. We only charge for advanced features like family groups, unlimited AI refinement, exports and calendar sync.',
      'faq.q2':        'How does the AI know what to recommend?',
      'faq.a2':        'We use Claude (by Anthropic), a state-of-the-art language model, plus our own nutrient database and validated daily reference intake tables by age and gender.',
      'faq.q3':        'Can I trust an AI with my nutrition?',
      'faq.a3':        'The AI generates a starting point based on widely accepted nutritional guidelines. We always recommend reviewing your plan with a registered dietitian for clinical conditions or competitive sport.',
      'faq.q4':        'What about food restrictions?',
      'faq.a4':        'We support vegetarian, vegan, gluten-free, lactose-free, nut allergies, kosher, halal, and custom restrictions. Just tell us during onboarding.',
      'faq.q5':        'Can I cancel anytime?',
      'faq.a5':        'Yes, no contracts. Cancel from your account page and you keep Pro access until the end of the billing period.',

      // CTA
      'cta.title':     'Ready to eat for performance?',
      'cta.subtitle':  'Build your first weekly plan in 5 minutes. Free, no credit card.',
      'cta.button':    'Build my plan',

      // Footer
      'footer.product':  'Product',
      'footer.company':  'Company',
      'footer.legal':    'Legal',
      'footer.about':    'About',
      'footer.contact':  'Contact',
      'footer.privacy':  'Privacy',
      'footer.terms':    'Terms',
      'footer.tagline':  'AI nutrition planning for athletes and families.',
      'footer.copy':     '© 2026 SportNutritionPlanning. All rights reserved.',

      // Onboarding
      'onb.step_of':   'Step {n} of {total}',
      'onb.next':      'Continue',
      'onb.back':      'Back',
      'onb.finish':    'Generate my plan',
      'onb.generating':'Generating your plan...',

      'onb.s1.title':  'Tell us about you',
      'onb.s1.lead':   'These basics let us calculate your daily energy and macro needs.',
      'onb.s1.name':   'Your name',
      'onb.s1.age':    'Age',
      'onb.s1.sex':    'Biological sex',
      'onb.s1.male':   'Male',
      'onb.s1.female': 'Female',
      'onb.s1.height': 'Height (cm)',
      'onb.s1.weight': 'Weight (kg)',

      'onb.s2.title':  'Where do you live?',
      'onb.s2.lead':   'We use this to localize meal suggestions and supermarkets.',
      'onb.s2.country':'Country',
      'onb.s2.city':   'City (optional)',
      'onb.s2.units':  'Measurement units',
      'onb.s2.metric': 'Metric (kg, cm, g, ml)',
      'onb.s2.imperial':'Imperial (lb, in, oz, cup)',

      'onb.s3.title':  'Sport & activity',
      'onb.s3.lead':   'This is the magic ingredient. Be precise about your training.',
      'onb.s3.does':   'Do you train regularly?',
      'onb.s3.yes':    'Yes',
      'onb.s3.no':     'Not really',
      'onb.s3.type':   'Main sport / activity',
      'onb.s3.days':   'Training days per week',
      'onb.s3.intensity':'Intensity',
      'onb.s3.int_low':'Light (recreational)',
      'onb.s3.int_mid':'Moderate (consistent training)',
      'onb.s3.int_high':'High (competitive / intense)',
      'onb.s3.timing': 'Usual training time',
      'onb.s3.t_morning':'Morning',
      'onb.s3.t_noon':   'Midday',
      'onb.s3.t_afternoon':'Afternoon',
      'onb.s3.t_evening':'Evening',
      'onb.s3.goal':   'Main goal',
      'onb.s3.g_lose': 'Lose body fat',
      'onb.s3.g_gain': 'Gain muscle',
      'onb.s3.g_recomp':'Body recomposition',
      'onb.s3.g_perf': 'Sport performance',
      'onb.s3.g_health':'General health',

      'onb.s4.title':  'Food restrictions & preferences',
      'onb.s4.lead':   'Pick anything that applies. We never include forbidden ingredients.',
      'onb.s4.veg':    'Vegetarian',
      'onb.s4.vegan':  'Vegan',
      'onb.s4.gf':     'Gluten-free',
      'onb.s4.lf':     'Lactose-free',
      'onb.s4.nut':    'Nut allergy',
      'onb.s4.shell':  'Shellfish allergy',
      'onb.s4.egg':    'Egg allergy',
      'onb.s4.kosher': 'Kosher',
      'onb.s4.halal':  'Halal',
      'onb.s4.lowcarb':'Low carb',
      'onb.s4.dislikes':'Anything else you don\'t like? (optional)',
      'onb.s4.dislikes_ph':'Mushrooms, cilantro, blue cheese...',

      'onb.s5.title':  'Just you, or the whole family?',
      'onb.s5.lead':   'Add household members and we\'ll scale every meal. Pro lets you link them as real accounts later.',
      'onb.s5.solo':   'Just me',
      'onb.s5.family': 'Family / household',
      'onb.s5.add':    'Add a member',
      'onb.s5.member_name': 'Name',
      'onb.s5.member_age':  'Age',
      'onb.s5.member_sex':  'Sex',
      'onb.s5.member_sport':'Sport (optional)',
      'onb.s5.upsell': 'Linking up to 6 family accounts is a Pro feature — you can still add members manually now and link them later.',
      'onb.s5.remove': 'Remove',

      // Auth
      'auth.signin':   'Sign in',
      'auth.signup':   'Create your account',
      'auth.email':    'Email',
      'auth.password': 'Password',
      'auth.magic':    'Email me a magic link',
      'auth.google':   'Continue with Google',
      'auth.or':       'or',
      'auth.have_account':'Already have an account?',
      'auth.no_account':  'New here?',
      'auth.sent':     'Check your inbox — we sent you a sign-in link.',
      'auth.terms':    'By continuing you agree to our Terms and Privacy Policy.',

      // Account
      'acc.title':     'My account',
      'acc.plan':      'Plan',
      'acc.free':      'Free',
      'acc.pro':       'Pro',
      'acc.upgrade':   'Upgrade to Pro',
      'acc.manage':    'Manage subscription',
      'acc.profile':   'Profile',
      'acc.family':    'Family',
      'acc.invite':    'Invite a member',
      'acc.signout':   'Sign out',
      'acc.delete':    'Delete account',
    },

    es: {
      // Nav
      'nav.features':  'Características',
      'nav.howit':     'Cómo funciona',
      'nav.pricing':   'Precios',
      'nav.faq':       'Preguntas',
      'nav.login':     'Iniciar sesión',
      'nav.signup':    'Empezar',
      'nav.account':   'Mi cuenta',
      'nav.app':       'Abrir app',

      // Hero
      'hero.badge':    'Nutrición con IA para deportistas y familias',
      'hero.title':    'Tu plan semanal de comidas, ajustado a tu deporte y tu familia.',
      'hero.lead':     'Respondé cinco preguntas y nuestra IA arma un plan semanal completo con menú, lista de compras y tracker de macros — para vos solo o toda tu familia. Entrená más inteligente. Comé mejor. Perdé menos tiempo planificando.',
      'hero.cta_primary':  'Armá mi plan — gratis',
      'hero.cta_secondary':'Cómo funciona',
      'hero.meta':     'Sin tarjeta de crédito · 24 nutrientes monitoreados · Pensado para atletas y familias',

      // Features
      'features.title':    'Todo lo que necesitás para comer para rendir',
      'features.subtitle': 'Desde un menú semanal rápido hasta periodización por día de entrenamiento. Free cubre lo básico, Pro abre la parte avanzada.',
      'features.f1.title': 'Primero el deporte',
      'features.f1.desc':  'Contanos tu deporte, días e intensidad de entrenamiento. Tu plan adapta los macros, calorías y horarios de comida alrededor de tus sesiones.',
      'features.f2.title': 'Pensado para familias',
      'features.f2.desc':  'Un plan para toda la casa. Cada miembro recibe la porción correcta según edad, sexo, peso y actividad. La lista de compras se escala sola.',
      'features.f3.title': 'IA con la que podés hablar',
      'features.f3.desc':  '¿No te gusta una comida? Cambiala. ¿Más proteína los días de entrenamiento? Pedila. ¿Vegetariano solo los miércoles? Listo.',
      'features.f4.title': 'Tracker de 24 nutrientes',
      'features.f4.desc':  'No solo proteína, carbohidratos y grasas — seguimos 24 micronutrientes vs. los valores diarios de referencia para tu edad y sexo.',
      'features.f5.title': 'Lista de compras inteligente',
      'features.f5.desc':  'Carrito semanal consolidado, ordenado por góndola, con cantidades escaladas a tu familia. Pro: deep-links a tu súper local.',
      'features.f6.title': 'Sincronizá tu calendario',
      'features.f6.desc':  'Pro: las comidas aparecen en Google o Apple Calendar — desayuno, almuerzo, cena — para que toda la casa reciba el aviso.',

      // How it works
      'how.title':     'Tres pasos. Cinco minutos.',
      'how.s1.title':  '1. Contanos sobre vos',
      'how.s1.desc':   'Edad, sexo, peso, deporte, días de entrenamiento, restricciones. Cinco preguntas cortas.',
      'how.s2.title':  '2. La IA arma tu plan',
      'how.s2.desc':   'Claude genera un menú semanal balanceado, alcanza tus objetivos de macros y respeta tus restricciones.',
      'how.s3.title':  '3. Refiná y cociná',
      'how.s3.desc':   'Cambiá cualquier comida, escalá la lista de compras, sincronizá tu calendario y trackeá tu adherencia.',

      // Pricing
      'pricing.title':    'Precios simples. Sin sorpresas.',
      'pricing.subtitle': 'Gratis para siempre para uso individual. Pasate a Pro cuando quieras desbloquear lo avanzado.',
      'pricing.free.name': 'Gratis',
      'pricing.free.price': '$0',
      'pricing.free.period': '/ para siempre',
      'pricing.free.cta': 'Empezar gratis',
      'pricing.free.f1': '1 perfil personal',
      'pricing.free.f2': 'Plan semanal generado por IA (hasta 4 regeneraciones por mes)',
      'pricing.free.f3': 'Lista de compras semanal',
      'pricing.free.f4': 'Tracker diario de 24 nutrientes',
      'pricing.free.f5': 'Edición manual de comidas',
      'pricing.free.f6': 'Bilingüe (EN/ES)',

      'pricing.pro.name': 'Pro',
      'pricing.pro.price': 'USD 6,99',
      'pricing.pro.period': '/ mes',
      'pricing.pro.yearly': 'o USD 59 / año — ahorrás 30%',
      'pricing.pro.cta': 'Pasarme a Pro',
      'pricing.pro.ribbon': 'Más popular',
      'pricing.pro.f1': 'Todo lo del plan gratis',
      'pricing.pro.f2': 'Grupo familiar: hasta 6 miembros con cuentas linkeadas',
      'pricing.pro.f3': 'Regeneraciones IA ilimitadas + chat con tu coach nutricional',
      'pricing.pro.f4': 'Modo deportivo: peri-workout, carb cycling, periodización',
      'pricing.pro.f5': 'Exportar a Excel y PDF',
      'pricing.pro.f6': 'Sincro con Google y Apple Calendar',
      'pricing.pro.f7': 'Dashboard de progreso (adherencia, evolución de macros)',
      'pricing.pro.f8': 'Deep-links a supermercados (Coto, Carrefour, Whole Foods y más)',
      'pricing.pro.f9': 'Recetario con paso a paso',
      'pricing.pro.f10':'Planificación 4 semanas adelantadas',
      'pricing.pro.f11':'Soporte prioritario',

      // FAQ
      'faq.title':     'Preguntas frecuentes',
      'faq.q1':        '¿Es realmente gratis?',
      'faq.a1':        'Sí. El plan gratis es generoso y lo mantenemos así para siempre. Solo cobramos por features avanzadas como grupos familiares, regeneración ilimitada con IA, exports y sincro de calendario.',
      'faq.q2':        '¿Cómo sabe la IA qué recomendar?',
      'faq.a2':        'Usamos Claude (de Anthropic), un modelo de lenguaje de última generación, sumado a nuestra base de nutrientes propia y tablas validadas de ingestas diarias de referencia por edad y sexo.',
      'faq.q3':        '¿Puedo confiar en una IA con mi nutrición?',
      'faq.a3':        'La IA genera un punto de partida basado en lineamientos nutricionales ampliamente aceptados. Siempre recomendamos revisar el plan con un nutricionista matriculado si tenés condiciones clínicas o deporte competitivo.',
      'faq.q4':        '¿Y las restricciones alimentarias?',
      'faq.a4':        'Soportamos vegetariano, vegano, sin gluten, sin lactosa, alergia a frutos secos, kosher, halal y restricciones personalizadas. Solo tenés que contarnos durante el onboarding.',
      'faq.q5':        '¿Puedo cancelar cuando quiera?',
      'faq.a5':        'Sí, sin contratos. Cancelás desde tu página de cuenta y mantenés Pro hasta el final del período facturado.',

      // CTA
      'cta.title':     '¿Listo para comer para rendir?',
      'cta.subtitle':  'Armá tu primer plan semanal en 5 minutos. Gratis, sin tarjeta.',
      'cta.button':    'Armá mi plan',

      // Footer
      'footer.product':  'Producto',
      'footer.company':  'Empresa',
      'footer.legal':    'Legal',
      'footer.about':    'Nosotros',
      'footer.contact':  'Contacto',
      'footer.privacy':  'Privacidad',
      'footer.terms':    'Términos',
      'footer.tagline':  'Planificación nutricional con IA para deportistas y familias.',
      'footer.copy':     '© 2026 SportNutritionPlanning. Todos los derechos reservados.',

      // Onboarding
      'onb.step_of':   'Paso {n} de {total}',
      'onb.next':      'Continuar',
      'onb.back':      'Atrás',
      'onb.finish':    'Generar mi plan',
      'onb.generating':'Generando tu plan...',

      'onb.s1.title':  'Contanos sobre vos',
      'onb.s1.lead':   'Estos datos básicos nos permiten calcular tu energía diaria y necesidades de macros.',
      'onb.s1.name':   'Tu nombre',
      'onb.s1.age':    'Edad',
      'onb.s1.sex':    'Sexo biológico',
      'onb.s1.male':   'Masculino',
      'onb.s1.female': 'Femenino',
      'onb.s1.height': 'Altura (cm)',
      'onb.s1.weight': 'Peso (kg)',

      'onb.s2.title':  '¿Dónde vivís?',
      'onb.s2.lead':   'Usamos esto para localizar sugerencias de comidas y supermercados.',
      'onb.s2.country':'País',
      'onb.s2.city':   'Ciudad (opcional)',
      'onb.s2.units':  'Unidades de medida',
      'onb.s2.metric': 'Métrico (kg, cm, g, ml)',
      'onb.s2.imperial':'Imperial (lb, in, oz, cup)',

      'onb.s3.title':  'Deporte y actividad',
      'onb.s3.lead':   'Este es el ingrediente mágico. Sé preciso con tu entrenamiento.',
      'onb.s3.does':   '¿Entrenás regularmente?',
      'onb.s3.yes':    'Sí',
      'onb.s3.no':     'No realmente',
      'onb.s3.type':   'Deporte / actividad principal',
      'onb.s3.days':   'Días de entrenamiento por semana',
      'onb.s3.intensity':'Intensidad',
      'onb.s3.int_low':'Suave (recreativo)',
      'onb.s3.int_mid':'Moderada (entreno consistente)',
      'onb.s3.int_high':'Alta (competitivo / intenso)',
      'onb.s3.timing': 'Horario habitual de entrenamiento',
      'onb.s3.t_morning':'Mañana',
      'onb.s3.t_noon':   'Mediodía',
      'onb.s3.t_afternoon':'Tarde',
      'onb.s3.t_evening':'Noche',
      'onb.s3.goal':   'Objetivo principal',
      'onb.s3.g_lose': 'Bajar grasa corporal',
      'onb.s3.g_gain': 'Ganar masa muscular',
      'onb.s3.g_recomp':'Recomposición corporal',
      'onb.s3.g_perf': 'Performance deportiva',
      'onb.s3.g_health':'Salud general',

      'onb.s4.title':  'Restricciones y preferencias',
      'onb.s4.lead':   'Marcá todo lo que aplique. Nunca incluimos ingredientes prohibidos.',
      'onb.s4.veg':    'Vegetariano',
      'onb.s4.vegan':  'Vegano',
      'onb.s4.gf':     'Sin gluten',
      'onb.s4.lf':     'Sin lactosa',
      'onb.s4.nut':    'Alergia a frutos secos',
      'onb.s4.shell':  'Alergia a mariscos',
      'onb.s4.egg':    'Alergia al huevo',
      'onb.s4.kosher': 'Kosher',
      'onb.s4.halal':  'Halal',
      'onb.s4.lowcarb':'Bajo en carbohidratos',
      'onb.s4.dislikes':'¿Algo más que no te guste? (opcional)',
      'onb.s4.dislikes_ph':'Hongos, cilantro, queso azul...',

      'onb.s5.title':  '¿Solo vos o toda la familia?',
      'onb.s5.lead':   'Agregá miembros del hogar y escalamos cada comida. Pro te permite linkearlos como cuentas reales más adelante.',
      'onb.s5.solo':   'Solo yo',
      'onb.s5.family': 'Familia / hogar',
      'onb.s5.add':    'Agregar miembro',
      'onb.s5.member_name': 'Nombre',
      'onb.s5.member_age':  'Edad',
      'onb.s5.member_sex':  'Sexo',
      'onb.s5.member_sport':'Deporte (opcional)',
      'onb.s5.upsell': 'Linkear hasta 6 cuentas familiares es una feature Pro — podés agregar miembros manualmente ahora y linkearlos después.',
      'onb.s5.remove': 'Quitar',

      // Auth
      'auth.signin':   'Iniciá sesión',
      'auth.signup':   'Creá tu cuenta',
      'auth.email':    'Email',
      'auth.password': 'Contraseña',
      'auth.magic':    'Enviame un magic link',
      'auth.google':   'Continuar con Google',
      'auth.or':       'o',
      'auth.have_account':'¿Ya tenés cuenta?',
      'auth.no_account':  '¿Sos nuevo acá?',
      'auth.sent':     'Revisá tu inbox — te enviamos un link para iniciar sesión.',
      'auth.terms':    'Al continuar aceptás nuestros Términos y Política de Privacidad.',

      // Account
      'acc.title':     'Mi cuenta',
      'acc.plan':      'Plan',
      'acc.free':      'Gratis',
      'acc.pro':       'Pro',
      'acc.upgrade':   'Pasarme a Pro',
      'acc.manage':    'Gestionar suscripción',
      'acc.profile':   'Perfil',
      'acc.family':    'Familia',
      'acc.invite':    'Invitar miembro',
      'acc.signout':   'Cerrar sesión',
      'acc.delete':    'Eliminar cuenta',
    }
  };

  function detectInitialLang() {
    const stored = localStorage.getItem('snp.lang');
    if (stored && DICT[stored]) return stored;
    const nav = (navigator.language || 'en').toLowerCase();
    if (nav.startsWith('es')) return 'es';
    return 'en';
  }

  const state = { lang: detectInitialLang() };

  function t(key, vars) {
    const dict = DICT[state.lang] || DICT.en;
    let s = dict[key] || DICT.en[key] || key;
    if (vars) for (const k in vars) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
    return s;
  }

  function setLang(l) {
    if (!DICT[l]) return;
    state.lang = l;
    localStorage.setItem('snp.lang', l);
    document.documentElement.lang = l;
    apply();
    document.dispatchEvent(new CustomEvent('snp:langchange', { detail: { lang: l } }));
  }

  function apply(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    root.querySelectorAll('[data-i18n-html]').forEach(el => {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    root.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    // Update lang-toggle UI
    root.querySelectorAll('.lang-toggle button[data-lang]').forEach(btn => {
      btn.classList.toggle('is-active', btn.getAttribute('data-lang') === state.lang);
    });
  }

  function init() {
    document.documentElement.lang = state.lang;
    apply();
    // Wire any lang toggle buttons
    document.querySelectorAll('.lang-toggle button[data-lang]').forEach(btn => {
      btn.addEventListener('click', () => setLang(btn.getAttribute('data-lang')));
    });
  }

  global.SNP = global.SNP || {};
  global.SNP.i18n = { t, setLang, apply, get lang() { return state.lang; }, init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
