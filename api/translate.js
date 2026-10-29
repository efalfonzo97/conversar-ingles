// Función serverless de Vercel: traduce y arma la pronunciación.
// Motor principal: API de Claude (si existe ANTHROPIC_API_KEY).
// Respaldo gratuito: MyMemory (solo traducción, sin pronunciación ni sugerencias).

const PHON_RULES = `Reglas para "phonetic":
- Escribí cómo suena para un argentino, sílabas separadas con guion dentro de cada palabra y espacios entre palabras.
- La sílaba tónica de cada palabra de más de una sílaba va en MAYÚSCULAS y con tilde (ej.: "FÁ-der", "me-CÁ-nic"). Las palabras de una sílaba van en minúsculas.
- Usá "j" para la h inglesa suave, "d" para la th de "the/this", "ai", "ei", "ou" para diptongos; vocales largas con letra doble ("ii", "uu").
- Uní palabras solo si en el habla es muy natural (ej.: "is a" → "i-sa").`;

const promptToEn = (text, ctx) => `Sos un profesor de inglés para un hispanohablante de Argentina con nivel básico (A1) que se prepara para viajar por Europa.
Traducí al inglés lo que escribió. Usá inglés natural, simple y correcto, como lo diría una persona en la vida real. Si ya está en inglés, corregilo si hace falta.
${ctx ? `Es su respuesta dentro de esta charla (usala solo como contexto, no la traduzcas):\n${ctx}\n` : ''}
Devolvé SOLO un objeto JSON con esta forma exacta:
{"en": "traducción al inglés",
 "phonetic": "la frase en inglés escrita como suena, con ortografía del castellano",
 "words": [{"en": "palabra", "phonetic": "como suena", "es": "significado"}],
 "note": "un consejo corto en castellano (máx. 20 palabras) útil para esta frase, o cadena vacía"}

${PHON_RULES}

Reglas para "words": palabras con contenido (sustantivos, verbos, adjetivos), máximo 5, sin repetir, sin artículos ni pronombres simples.

Texto: """${text}"""`;

const promptToEs = (text, ctx) => `Sos un profesor de inglés para un hispanohablante de Argentina con nivel básico (A1). Está en una clase o charla y escuchó esto en inglés (viene de un reconocimiento de voz, puede tener errores: interpretá lo más probable).
${ctx ? `Charla hasta ahora (solo contexto):\n${ctx}\n` : ''}
Devolvé SOLO un objeto JSON con esta forma exacta:
{"es": "traducción natural al castellano rioplatense",
 "words": [{"en": "palabra o expresión clave", "es": "significado"}],
 "reply_es": "una respuesta corta y simple que él podría dar, escrita en castellano, en primera persona"}

Reglas: "words" con máximo 4 palabras o expresiones útiles de la frase. Si es una pregunta, "reply_es" la responde de forma genérica y simple; si no, "reply_es" es una reacción natural corta.

Texto en inglés: """${text}"""`;

function extractJson(s) {
  try { return JSON.parse(s); } catch {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch {} }
  return null;
}

// Traduce el error de Claude a algo accionable para mostrar en la app
function explain(msg) {
  const m = String(msg || '');
  if (/credit balance|billing/i.test(m)) return 'Tu cuenta de la API de Claude no tiene saldo. Cargá crédito en console.anthropic.com → Billing.';
  if (/ 401/.test(m) || /authentication|invalid x-api-key/i.test(m)) return 'La clave de Claude es inválida. Revisá ANTHROPIC_API_KEY en Vercel y hacé Redeploy.';
  if (/ 404/.test(m) || /not_found|model/i.test(m)) return 'El modelo de Claude no existe para tu cuenta. Probá poner CLAUDE_MODEL = claude-sonnet-5-5 en Vercel.';
  if (/ 429/.test(m)) return 'Claude recibió demasiados pedidos seguidos. Esperá unos segundos.';
  if (/ 529| 5\d\d/.test(m)) return 'Claude está saturado en este momento. Probá de nuevo en un rato.';
  return 'Claude no respondió: ' + m.slice(0, 160);
}

async function withClaude(mode, text, context, key) {
  const prompt = mode === 'toEs' ? promptToEs(text, context) : promptToEn(text, context);
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || 'claude-haiku-5-5',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!r.ok) throw new Error(`Claude respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  const out = extractJson((data.content || []).map(c => c.text || '').join(''));
  if (!out) throw new Error('Claude no devolvió un JSON válido');
  return { engine: 'claude', ...out };
}

async function withMyMemory(mode, text) {
  const pair = mode === 'toEs' ? 'en|es' : 'es|en';
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text.slice(0, 480));
  url.searchParams.set('langpair', pair);
  if (process.env.MYMEMORY_EMAIL) url.searchParams.set('de', process.env.MYMEMORY_EMAIL);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`MyMemory respondió ${r.status}`);
  const data = await r.json();
  const t = data?.responseData?.translatedText || '';
  if (!t) throw new Error('MyMemory no devolvió traducción');
  return mode === 'toEs'
    ? { engine: 'mymemory', es: t, words: [], reply_es: '' }
    : { engine: 'mymemory', en: t, phonetic: '', words: [], note: '' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usá POST' });

  const code = process.env.ACCESS_CODE;
  if (code && req.headers['x-access-code'] !== code) {
    return res.status(401).json({ error: 'Código de acceso incorrecto' });
  }

  const { mode, text, context } = req.body || {};
  if (!['toEs', 'toEn'].includes(mode) || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Faltan datos: mode (toEs | toEn) y text' });
  }
  const clean = text.trim().slice(0, 2000);
  const ctx = typeof context === 'string' ? context.slice(0, 3000) : '';

  try {
    const key = process.env.ANTHROPIC_API_KEY;
    let notice = 'Falta cargar ANTHROPIC_API_KEY en Vercel (Settings → Environment Variables) y hacer Redeploy.';
    if (key) {
      try { return res.status(200).json(await withClaude(mode, clean, ctx, key)); }
      catch (e) { console.error(e.message); notice = explain(e.message); /* si falla Claude, pasa al respaldo */ }
    }
    return res.status(200).json({ ...(await withMyMemory(mode, clean)), notice });
  } catch (e) {
    console.error(e.message);
    return res.status(502).json({ error: 'No se pudo traducir. Probá de nuevo en unos segundos.' });
  }
}
