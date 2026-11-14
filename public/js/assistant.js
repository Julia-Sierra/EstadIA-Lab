window.ESTADIA = window.ESTADIA || {};

window.ESTADIA.askAssistant = async (context) => {
  const output = document.getElementById('assistant-output');
  if (!output) return;

  output.textContent = 'Enviando tu pregunta a Gemini...';

  try {
    const response = await fetch('/api/gemini/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context)
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
