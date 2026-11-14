const PRIMARY_MODEL = 'gemini-3.5-flash-lite';
const FALLBACK_MODEL = 'gemini-3.6-flash';
const INTERACTIONS_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const MAX_PROMPT_CHARS = 12000;

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function requestModel(prompt, model, apiKey) {
  const response = await fetch(INTERACTIONS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
      'Api-Revision': '2026-05-20'
    },
    body: JSON.stringify({
      model,
      input: prompt,
      store: false,
      generation_config: {
        thinking_level: 'low',
        max_output_tokens: 300
      }
    })
  });

  if (!response.ok) {
    const details = await response.text();
    const error = createError(`Gemini respondió con HTTP ${response.status}: ${details}`, 502);
    error.upstreamHttpStatus = response.status;
    throw error;
  }

  const data = await response.json();
  const explanation = data?.steps
    ?.filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content || [])
    .filter((content) => content.type === 'text' && typeof content.text === 'string')
    .map((content) => content.text)
    .join('')
    .trim();
  if (!explanation) {
    throw createError('Gemini no devolvió una respuesta de texto.', 502);
  }

  return { source: 'gemini', model, explanation };
}

async function generateGeminiResponse(prompt) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw createError('Escribe una pregunta para Gemini.', 400);
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    throw createError(`La pregunta supera el límite de ${MAX_PROMPT_CHARS} caracteres.`, 413);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw createError('Configura GEMINI_API_KEY como variable secreta del servidor.', 503);
  }

  try {
    return await requestModel(prompt.trim(), PRIMARY_MODEL, apiKey);
  } catch (error) {
    if (!Number.isInteger(error.upstreamHttpStatus)) throw error;
  }

  try {
    return await requestModel(prompt.trim(), FALLBACK_MODEL, apiKey);
  } catch (error) {
    if (error.upstreamHttpStatus === 503) {
      throw createError('Los modelos de Gemini están temporalmente saturados. Intenta de nuevo más tarde.', 503);
    }
    throw error;
  }
}

function buildExplanationPrompt({ enunciado, distribution, keywords = [], params = {}, operation, formula, result, question }) {
  return `Eres un asistente académico de estadística. Responde en español, de forma clara y concisa. Contesta la pregunta concreta que aparece abajo; empieza con la respuesta directa y no la sustituyas por una explicación de por qué se eligió la distribución. Si preguntan si se cumple un requisito o criterio, compara explícitamente el valor calculado con el umbral exigido y responde sí o no. Usa el enunciado y los resultados proporcionados; no inventes valores. Si falta información, dilo claramente y solicita el dato necesario. No des una solución paso a paso a menos que se solicite.

PREGUNTA QUE DEBES RESPONDER: ${question || ''}

Enunciado: ${enunciado || 'Sin enunciado'}
Distribución detectada: ${distribution || 'No identificada'}
Palabras clave: ${keywords.join(', ') || 'Ninguna'}
Parámetros: ${JSON.stringify(params, null, 2)}
Operación solicitada: ${operation || 'No especificada'}
Fórmula aplicada: ${formula || 'No especificada'}
Resultados calculados: ${result ?? 'No disponibles'}`;
}

function generateExplanation(context) {
  return generateGeminiResponse(context.prompt || buildExplanationPrompt(context));
}

module.exports = {
  generateExplanation,
  generateGeminiResponse
};
