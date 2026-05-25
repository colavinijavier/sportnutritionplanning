# 🚀 Guía de deploy en Netlify — NutriPlan con IA integrada

Esta carpeta tiene todo listo para que publiques NutriPlan en Netlify y la IA funcione automáticamente para toda tu familia, sin que ellos toquen ninguna API key.

## ⚡ Resumen rápido (5 pasos, ~10 minutos)

1. Sacar API key de Anthropic
2. Arrastrar esta carpeta a Netlify Drop
3. Agregar la API key como variable de entorno en Netlify
4. Disparar redeploy
5. Compartir la URL con la familia

Detalle paso a paso abajo.

---

## 📋 Paso 1 — API key de Anthropic (5 minutos)

Anthropic Claude (el motor que va a usar la app) requiere una API key. Es la única clave del sistema entero — vos la tenés, tu familia no la ve nunca.

1. Andá a 👉 **https://console.anthropic.com**
2. Creá una cuenta (Google login o email).
3. Te dan **$5 USD de crédito gratis** para probar (suficiente para varios miles de interacciones).
4. En el panel: **API Keys** → **Create Key**.
5. Copiá la string que empieza con `sk-ant-...`. **No la pegues en ningún chat ni la subas a GitHub** — la vas a poner ahora en Netlify.

**Costo después del crédito gratis**: Claude Haiku 4.5 cuesta unos $0.25 por millón de tokens de entrada y $1.25 por millón de salida. Una interacción típica de la app son ~700 tokens en total → **~$0.0005 por uso**. Con un dólar te alcanza para 2000 swaps de comida o refinamientos de perfil. Es muy barato.

Podés además configurar un **límite de gasto mensual** en la sección Limits para no llevarte sorpresas (recomiendo $5 USD/mes max — más que suficiente).

---

## 📋 Paso 2 — Subir a Netlify (1 minuto)

1. Abrí 👉 **https://app.netlify.com/drop** (no necesita cuenta para empezar)
2. **Arrastrá toda esta carpeta** `NutriPlan_deploy/` al cuadrado de Netlify.
3. Esperá 30-60 segundos. Netlify detecta automáticamente:
   - El archivo HTML que se va a publicar
   - La función serverless `netlify/functions/ai.js` que va a ser el puente con Anthropic
   - El `netlify.toml` que orquesta todo
4. Te da una URL del tipo `https://nombre-random-12345.netlify.app`

**Importante**: a esta altura el HTML carga, pero la IA va a dar error porque falta configurar la API key. Eso lo hacés en el paso 3.

**Opcional**: cambiá el nombre del site a algo memorable
- En el dashboard de Netlify → **Site settings** → **Change site name**
- Poné por ejemplo `nutriplan-colavini` → la URL queda `https://nutriplan-colavini.netlify.app`

---

## 📋 Paso 3 — Configurar la API key en Netlify (2 minutos)

Acá está la magia: la API key vive como variable de entorno del servidor, nunca toca el HTML.

1. En el dashboard de tu site en Netlify: **Site settings** (engranaje) → en el menú izquierdo **Environment variables**
2. Botón **Add a variable** → **Add a single variable**:
   - **Key**: `ANTHROPIC_API_KEY` (exactamente así, en mayúsculas)
   - **Values**: pegá la API key que copiaste en el Paso 1 (la `sk-ant-...`)
   - **Scopes**: marcá **Functions** (el resto opcional)
3. **Create variable**

---

## 📋 Paso 4 — Redeploy para que tome la nueva variable (30 seg)

Las funciones serverless leen las env vars al desplegar, así que tenés que disparar un redeploy:

1. En el dashboard del site → solapa **Deploys**
2. Botón **Trigger deploy** → **Deploy site**
3. Esperá 30 segundos a que el nuevo deploy quede listo (verde con un check).

---

## 📋 Paso 5 — Probar y compartir

1. Abrí la URL de tu site en una pestaña nueva.
2. Andá a la solapa **Ajustes IA** y tocá **Probar conexión**.
   - Debería mostrar `✓ Conexión OK con Claude (Anthropic)` en verde.
3. Probá:
   - **🤖 Refinar con IA** en cualquier perfil de Familia
   - **🔄 Cambiar → Generar variante con IA** en cualquier comida del Menú semanal
4. Si funciona: **compartí la URL a tu familia por WhatsApp**.

Cada uno puede:
- **iPhone**: abrir en Safari → Compartir → **Añadir a pantalla de inicio** → queda como app
- **Android**: abrir en Chrome → menú (⋮) → **Instalar app**

Las preferencias de cada usuario (qué comidas tildaron, cuánta agua tomaron) se guardan localmente en su dispositivo. La IA es compartida — todos usan tu key transparentemente.

---

## 🔒 Sobre seguridad

- La API key SOLO existe en las env vars de Netlify → invisible para usuarios finales
- El HTML llama a `/.netlify/functions/ai` (una URL interna de tu site, mismo dominio)
- La función serverless usa la env var del lado del servidor para llamar a Anthropic
- Nadie puede "ver" la key inspeccionando el código en el navegador

Si en algún momento querés cambiar la key (por seguridad o por cambiar de cuenta), simplemente editás la env var en Netlify y redespliegás. El HTML no cambia.

## 🔧 Si algo no funciona

**"ANTHROPIC_API_KEY no configurada"**: No hiciste el paso 3 o no disparaste redeploy en el paso 4.

**Error 401 / "invalid API key"**: La key está mal copiada (espacios, falta carácter al inicio). Volvé al paso 3 y verificá. Anthropic API keys SIEMPRE empiezan con `sk-ant-`.

**Error 429 / "rate limit"**: Estás haciendo demasiados llamados muy rápido. Esperá un minuto. La cuenta free tiene límites bajos; comprando algo de crédito ($5) sube mucho.

**El test funciona pero algunos prompts fallan**: Puede ser timeout de la función (limit gratis Netlify = 10 segundos por función). Las respuestas de IA son rápidas (~1-2 seg) así que no debería pasar. Si pasa, decime.

**Cambios al HTML no se reflejan**: Tu navegador cachea. Forzá refresh con Ctrl+Shift+R (Mac: Cmd+Shift+R) o probá en modo incógnito.

## 💰 Control de costos

- En console.anthropic.com → **Settings** → **Limits**, configurá un **Monthly limit** (recomiendo $5 USD)
- Anthropic te avisa por email al 50%, 75%, 90% del límite
- Una vez alcanzado el límite, las llamadas dan error pero el resto de la app sigue funcionando

## 📂 Estructura de archivos en esta carpeta

```
NutriPlan_deploy/
├── NutriPlan.html                  ← La app principal
├── netlify.toml                    ← Config de Netlify
├── DEPLOY.md                       ← Esta guía
└── netlify/
    └── functions/
        └── ai.js                   ← Función serverless puente con Anthropic
```

Cuando arrastres a Netlify Drop, asegurate de arrastrar la CARPETA `NutriPlan_deploy` completa (no solo los archivos sueltos).

---

## 🆘 Si te trabás en algún paso

Volvé a la conversación de Cowork y describime exactamente en qué paso y qué mensaje viste. Lo destrabamos en minutos.
