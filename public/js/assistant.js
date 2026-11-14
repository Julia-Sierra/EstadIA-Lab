window.ESTADIA = window.ESTADIA || {};

window.ESTADIA.askAssistant = async (context) => {
  const output = document.getElementById('assistant-output');
  if (!output) return;

  output.textContent = 'Enviando tu pregunta a Gemini...';

  try {
    const prompt = [
      'Responde directamente a la pregunta, en español y de forma concisa. Usa el contexto sin inventar datos.',
      `Pregunta: ${context.question || 'No especificada'}`,
      `Enunciado: ${context.enunciado || 'No disponible'}`,
      `Distribución: ${context.distribution || 'No identificada'}`,
      `Parámetros: ${JSON.stringify(context.params || {})}`,
      `Operación: ${context.operation || 'No especificada'}`,
      `Fórmula: ${context.formula || 'No especificada'}`,
      `Resultados: ${context.result || 'No disponibles'}`
    ].join('\n\n');
    const response = await fetch(window.ESTADIA.apiUrl('gemini'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || 'No se pudo generar la respuesta con Gemini.');
    }
    output.textContent = payload.explanation || 'Gemini no devolvió una respuesta.';
  } catch (error) {
    output.textContent = error.message || 'No se pudo conectar con Gemini.';
  }
};
