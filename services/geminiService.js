async function generateExplanation({ enunciado, distribution, keywords = [], params = {}, operation, formula, result, question }) {
  if (!String(question || '').trim()) {
    throw new Error('Escribe una pregunta para Gemini.');
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini requiere conexión a internet y una GEMINI_API_KEY válida configurada en el archivo .env.');
  }

  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const apiKey = process.env.GEMINI_API_KEY;
  const payload = {
    contents: [
      {
        parts: [
          { text: `Eres un asistente académico de estadística. Responde en español, de forma clara y concisa. Contesta la pregunta concreta que aparece abajo; empieza con la respuesta directa y no la sustituyas por una explicación de por qué se eligió la distribución. Si preguntan si se cumple un requisito o criterio, compara explícitamente el valor calculado con el umbral exigido y responde sí o no. Usa el enunciado y los resultados proporcionados; no inventes valores. Si falta información, dilo claramente y solicita el dato necesario. No des una solución paso a paso a menos que se solicite.\n\nPREGUNTA QUE DEBES RESPONDER: ${question.trim()}\n\nEnunciado: ${enunciado || 'Sin enunciado'}\nDistribución detectada: ${distribution || 'No identificada'}\nPalabras clave: ${keywords.join(', ') || 'Ninguna'}\nParámetros: ${JSON.stringify(params, null, 2)}\nOperación solicitada: ${operation || 'No especificada'}\nFórmula aplicada: ${formula || 'No especificada'}\nResultados calculados: ${result ?? 'No disponibles'}` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      topK: 30,
      maxOutputTokens: 500
    }
  };

  let data;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${baseUrl}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      data = await response.json();
      break;
    }

    const details = await response.text();
    if (response.status === 503 && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
      continue;
    }

    const error = response.status === 503
      ? new Error('Gemini está temporalmente saturado. Intenta enviar tu pregunta nuevamente en un momento.')
      : new Error(`Gemini no respondió correctamente: ${details}`);
    error.statusCode = response.status === 503 ? 503 : 502;
    throw error;
  }

  const explanation = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Gemini no devolvió un texto válido.';

  return {
    source: 'gemini',
    model,
    explanation
  };
}

module.exports = {
  generateExplanation
};
