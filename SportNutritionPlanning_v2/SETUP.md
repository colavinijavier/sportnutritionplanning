# SportNutritionPlanning — Setup completo

Esta guía te lleva de cero a un SaaS en producción con auth real (Supabase) y pagos reales (Stripe). Tiempo total estimado: **35-45 minutos**.

El sitio ya está vivo en Netlify con la API de Claude. Lo que falta agregar:

1. **Supabase** — base de datos + autenticación (15 min)
2. **Stripe** — pagos para Pro (15 min)
3. **Subir esta carpeta a Netlify** (5 min)
4. **Probar todo end-to-end** (5 min)

---

## 📋 Paso 1 — Crear proyecto Supabase

### 1.1 — Crear cuenta y proyecto

1. Andá a 👉 https://supabase.com
2. **Sign up** (con GitHub o email — recomiendo GitHub).
3. **New project**:
   - Name: `SportNutritionPlanning`
   - Database password: generá una fuerte, **guardala** (no la vas a necesitar a corto plazo pero igual)
   - Region: `South America (São Paulo)` si estás en LatAm, `US East (N. Virginia)` si estás en EEUU
   - Pricing plan: **Free** (50k usuarios activos / mes — alcanza para empezar)
4. Esperá ~2 minutos a que el proyecto se aprovisione.

### 1.2 — Ejecutar el schema SQL

1. En tu proyecto: **SQL Editor** (icono de base de datos en el menú izquierdo) → **New query**.
2. Abrí el archivo `supabase-schema.sql` de esta carpeta y copiá TODO el contenido.
3. Pegalo en el editor de Supabase → botón **Run** (esquina inferior derecha).
4. Debería decir `Success. No rows returned`. ✅

### 1.3 — Habilitar autenticación

1. **Authentication** → **Providers**.
2. **Email** ya está habilitado por defecto. ✅
3. **Google** (opcional pero recomendado):
   - Toggle **Enabled**.
   - Necesitás un Client ID y Client Secret de Google Cloud Console. La doc oficial está en https://supabase.com/docs/guides/auth/social-login/auth-google — toma 10 minutos.
   - Si querés saltearlo por ahora, dejalo deshabilitado. Los usuarios podrán igualmente registrarse con email + password o magic link.

### 1.4 — Configurar URL de redirect

1. **Authentication** → **URL Configuration**:
   - **Site URL**: `https://sportnutritionplanning.netlify.app` (o tu dominio si tenés uno propio)
   - **Redirect URLs** (Add): `https://sportnutritionplanning.netlify.app/app.html`
2. Save.

### 1.5 — Copiar las dos credenciales que necesitás

1. **Project Settings** (engranaje abajo a la izquierda) → **API**.
2. Vas a ver:
   - **Project URL**: `https://xxxxxx.supabase.co` → guardala como `SUPABASE_URL`
   - **anon public** key (string largo) → guardala como `SUPABASE_ANON_KEY`
   - **service_role secret** key (otra string larga, marcada como "secret") → guardala como `SUPABASE_SERVICE_ROLE_KEY`
3. **Importante**: la `service_role` es SECRETA. Solo va en variables de entorno del servidor (Netlify). No la compartas ni la pongas en código que llegue al navegador.

---

## 📋 Paso 2 — Crear cuenta y productos Stripe

### 2.1 — Crear cuenta

1. Andá a 👉 https://stripe.com → **Start now**.
2. Sign up con tu email. Verificá el email.
3. **Importante**: vas a empezar en modo **Test** (no necesitás verificar tu identidad para probar). Cuando quieras cobrar de verdad, completás el onboarding de Stripe (datos del país, identidad, cuenta bancaria) y activás el modo **Live**.

### 2.2 — Crear el producto Pro

1. En el dashboard, asegurate que arriba a la izquierda dice **"Test mode"** (toggle en la esquina superior derecha).
2. **Products** → **+ Add product**:
   - Name: `SportNutritionPlanning Pro`
   - Description: `Unlimited AI, family group up to 6, exports, calendar sync and more.`
3. **Pricing**:
   - **Price 1**: $6.99 USD / month — recurring, monthly billing
   - Click **Add another price** → **Price 2**: $59.00 USD / year — recurring, yearly billing
4. **Save product**.
5. Click el producto recién creado → vas a ver los dos precios. **Copiá los Price IDs** (empiezan con `price_...`):
   - El mensual → guardalo como `STRIPE_PRICE_MONTHLY`
   - El anual → guardalo como `STRIPE_PRICE_YEARLY`

### 2.3 — Copiar las API keys

1. **Developers** → **API keys**.
2. Copiá:
   - **Publishable key** (`pk_test_...`) → `STRIPE_PUBLISHABLE_KEY`
   - **Secret key** (`sk_test_...` — click "Reveal test key") → `STRIPE_SECRET_KEY`

### 2.4 — Configurar webhook (para sincronizar suscripciones con Supabase)

1. **Developers** → **Webhooks** → **+ Add endpoint**.
2. **Endpoint URL**: `https://sportnutritionplanning.netlify.app/.netlify/functions/stripe-webhook`
3. **Select events to listen to**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. **Add endpoint**.
5. En la pantalla del endpoint, click **Reveal signing secret** (debajo del header) → copiá la string `whsec_...` como `STRIPE_WEBHOOK_SECRET`.

### 2.5 — Activar el Customer Portal

1. **Settings** → **Billing** → **Customer portal**.
2. Activá las opciones que quieras (recomiendo dejar todo lo de cancelación, actualización de método de pago y descarga de facturas).
3. **Save**.

---

## 📋 Paso 3 — Subir a Netlify y configurar variables

### 3.1 — Subir el sitio nuevo

1. Comprimí toda esta carpeta (`NutriPlan_deploy/`) en un zip.
2. En tu dashboard de Netlify → tu site `sportnutritionplanning` → **Deploys** → **Drag and drop your site folder here** → arrastrá el zip.
3. Esperá 1 minuto a que termine el deploy.

### 3.2 — Configurar todas las variables de entorno

1. Site settings → **Environment variables** → **Add a variable**.
2. Agregá una por una (las que ya tenías quedan):

   | Key                          | Value                                              | Scope     |
   | ---------------------------- | -------------------------------------------------- | --------- |
   | `ANTHROPIC_API_KEY`          | (ya existente)                                     | Functions |
   | `SUPABASE_URL`               | `https://xxxxxx.supabase.co`                       | Functions |
   | `SUPABASE_ANON_KEY`          | (anon public key)                                  | Functions |
   | `SUPABASE_SERVICE_ROLE_KEY`  | (service_role secret) — **mark as secret**         | Functions |
   | `STRIPE_PUBLISHABLE_KEY`     | `pk_test_...`                                      | Functions |
   | `STRIPE_SECRET_KEY`          | `sk_test_...` — **mark as secret**                 | Functions |
   | `STRIPE_WEBHOOK_SECRET`      | `whsec_...` — **mark as secret**                   | Functions |
   | `STRIPE_PRICE_MONTHLY`       | `price_...` (precio mensual)                       | Functions |
   | `STRIPE_PRICE_YEARLY`        | `price_...` (precio anual)                         | Functions |
   | `SITE_URL`                   | `https://sportnutritionplanning.netlify.app`       | Functions |

3. **Trigger deploy** (Deploys → Trigger deploy → Deploy site) para que las funciones tomen las nuevas variables.

---

## 📋 Paso 4 — Probar todo end-to-end

### 4.1 — Onboarding y plan generado

1. Abrí https://sportnutritionplanning.netlify.app en modo incógnito.
2. **Get started** → completá las 5 preguntas (podés inventar datos para probar).
3. Tras hacer click en **Generate my plan** debería tardar 5-10 segundos y aparecer la app con tu plan.
4. ✅ Si ves un plan semanal con comidas, macros y lista de compras → la IA + Netlify Functions están OK.

### 4.2 — Auth (Supabase)

1. Abrí `/login.html` (o link "Log in" en el nav).
2. Probá crear una cuenta con tu email + password.
3. Deberías recibir un email de Supabase con un magic link → al hacer click, te lleva a `/app.html`.
4. ✅ Si te logueás y aparece tu inicial en el avatar arriba → auth OK.

### 4.3 — Pagos (Stripe — modo Test)

1. Andá a `/account.html` → **Go Pro**.
2. Stripe Checkout se abre. Usá la tarjeta de prueba: **4242 4242 4242 4242**, fecha futura, CVC cualquiera, ZIP cualquiera.
3. Tras pagar, te redirige a `/account.html?checkout=success`.
4. Refrescá la página. El tile debería decir **Pro · Renews [fecha]** y aparecer botón **Manage subscription**.
5. ✅ Si todo eso funciona, el webhook está sincronizando bien con Supabase. Verificá en Supabase → Table editor → `subscriptions` que hay una fila con tu `user_id` y `status=active`.

### 4.4 — Customer Portal

1. En `/account.html` → **Manage subscription** → te lleva al portal de Stripe.
2. Podés cancelar, descargar facturas, actualizar método de pago, etc.

---

## 🎯 Cuando estés listo para cobrar de verdad

1. **Stripe**: completá el onboarding (datos personales, dirección, cuenta bancaria). Una vez activo, **toggle a Live mode**.
2. En Live mode, **repetí los pasos 2.2 a 2.4** (crear producto + webhook con keys `sk_live_...` y nuevo `whsec_...`).
3. Reemplazá las env vars de Netlify por las versiones Live.
4. Trigger deploy.

**Importante**: la URL de webhook en modo Live es la misma, pero el signing secret es diferente. Mantené ambas keys si querés seguir probando en Test.

---

## 🔐 Seguridad — qué es secreto y qué no

| Variable                       | Privada / pública | Por qué                              |
| ------------------------------ | ----------------- | ------------------------------------ |
| `ANTHROPIC_API_KEY`            | **PRIVADA**       | Tu key de Claude — no debe leakearse |
| `SUPABASE_URL`                 | Pública           | Va en el cliente igual               |
| `SUPABASE_ANON_KEY`            | Pública           | Diseñada para ir al cliente, las RLS policies son las que protegen |
| `SUPABASE_SERVICE_ROLE_KEY`    | **SECRETA**       | Bypasea RLS, solo server-side        |
| `STRIPE_PUBLISHABLE_KEY`       | Pública           | Diseñada para ir al cliente          |
| `STRIPE_SECRET_KEY`            | **SECRETA**       | Permite cobrar — protegela           |
| `STRIPE_WEBHOOK_SECRET`        | **SECRETA**       | Valida que un webhook es legítimo    |

Netlify protege las env vars "secretas" para que no aparezcan en logs ni se filtren al cliente. Marcalas como secretas en su UI.

---

## 🆘 Troubleshooting

**"Auth not configured" en login.html**
→ Te falta agregar `SUPABASE_URL` o `SUPABASE_ANON_KEY` en Netlify, o no disparaste redeploy después de agregarlas.

**Stripe Checkout no abre / botón se queda cargando**
→ Te falta `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY` o `STRIPE_PRICE_YEARLY`. Mirá los logs en Netlify → Functions → create-checkout para ver el error exacto.

**Webhook llega pero `subscriptions` queda vacía**
→ El service_role key está mal. O las RLS policies bloquean la inserción (la service_role debería bypasearlas pero verificá que está bien copiada, sin espacios).

**El plan se genera pero queda dando vueltas**
→ Mirá Netlify → Functions → generate-plan → ver logs. Probablemente la respuesta de Claude no es JSON válido (poco común con el system prompt actual).

**Mi familia ya estaba usando NutriPlan.html y ahora no funciona**
→ Lo dejé como redirect a `/app.html` (que pide onboarding la primera vez). Si querés mantener la vieja app viva sin onboarding, decime y la separamos.

---

## 📈 Próximos pasos sugeridos (post-launch)

1. **Dominio propio** (`sportnutritionplanning.com` por ej.) — en Netlify es 1 click si ya lo comprás.
2. **Analytics** — Plausible o PostHog (gratuitos y respetuosos con la privacidad).
3. **Email transaccional** — bienvenida personalizada al registrarse (Postmark / Resend).
4. **Strava / Garmin integration** — feature Pro de alto valor para deportistas.
5. **Mobile app wrapper** — Capacitor para empaquetar como app nativa iOS/Android.
6. **MercadoPago** — para usuarios de LatAm que no usan tarjeta internacional.

---

¿Te trabás en algún paso? Volvé al chat de Cowork y decime exactamente qué viste — lo destrabamos en minutos.
