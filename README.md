# Decilo en inglés · Conversar

App para seguir una clase o una llamada en inglés:

- **Lo que escucho:** con Meet, Zoom o Teams en altavoz, el micrófono transcribe en vivo lo que dice tu teacher y lo traduce al castellano, con palabras clave y una respuesta sugerida.
- **Lo que respondo:** escribís en castellano y te devuelve el inglés, la pronunciación escrita a la española y el audio.
- **La charla:** queda todo guardado en orden y lo podés descargar como .txt.

## Estructura

```
index.html          ← la app (HTML + CSS + JS, sin dependencias)
api/translate.js    ← función serverless que traduce (Claude o MyMemory)
package.json
```

## Subirla a Vercel

1. Subí la carpeta a un repo de GitHub e importalo en Vercel, o desde la carpeta corré `npx vercel`.
2. En **Project → Settings → Environment Variables** cargá:

| Variable | ¿Obligatoria? | Para qué |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Recomendada | Activa la traducción con Claude: pronunciación, consejos y respuestas sugeridas. Sin ella, la app usa MyMemory (solo traducción). |
| `ACCESS_CODE` | Recomendada si cargás la clave | Un código que la app pide una vez, para que nadie más use tu clave si encuentra la URL. |
| `CLAUDE_MODEL` | No | Modelo a usar. Por defecto `claude-haiku-5-5` (rápido y barato). |
| `MYMEMORY_EMAIL` | No | Tu email: sube el límite gratuito de MyMemory de ~5.000 a ~50.000 caracteres por día. |

3. Volvé a desplegar (**Redeploy**) para que tome las variables.

La clave de Claude se crea en [console.anthropic.com](https://console.anthropic.com). Nunca va en el HTML: solo la lee la función del servidor.

## Probarla en tu compu

```
npx vercel dev
```

Abrí `http://localhost:3000`. El micrófono funciona en `localhost` y en `https`, no abriendo el archivo con doble clic.

## Cómo usarla en clase

- Usá **Chrome o Edge** en la computadora. Firefox y Safari no tienen el reconocimiento de voz que usa la app.
- Llamada en **altavoz**, no con auriculares: el micrófono tiene que escuchar a tu teacher.
- La primera vez el navegador pide permiso de micrófono: aceptalo.
- **Pausá la escucha cuando hables vos**, así no se mezcla tu voz. Al tocar "Escuchar" en una respuesta, la app pausa el micrófono sola y lo retoma al terminar el audio.
- El reconocimiento de voz del navegador manda el audio a Google (Chrome) o a Microsoft (Edge) para transcribirlo.
