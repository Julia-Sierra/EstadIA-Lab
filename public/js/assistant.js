window.ESTADIA = window.ESTADIA || {};

window.ESTADIA.askAssistant = async (context) => {
  const output = document.getElementById('assistant-output');
  if (!output) return;

  output.textContent = 'Enviando tu pregunta a Gemini...';

  try {
    const response = await fetch(window.ESTADIA.apiUrl('gemini'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.message || `El servidor respondió con HTTP ${response.status}.`);
    }
    output.textContent = payload.explanation || 'Gemini no devolvió una respuesta.';
  } catch (error) {
    console.error('No se pudo enviar la pregunta a Gemini:', error);
    output.textContent = error instanceof TypeError
      ? 'No se pudo conectar con la API de Gemini. Verifica el dominio del backend y la configuración CORS.'
      : error.message || 'No se pudo conectar con Gemini.';
  }
};
