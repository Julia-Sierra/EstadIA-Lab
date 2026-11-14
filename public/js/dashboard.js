document.addEventListener('DOMContentLoaded', async () => {
  const listNode = document.getElementById('exercise-list');
  const analysisButton = document.getElementById('analyze-button');
  const analysisInput = document.getElementById('analysis-input');
  const analysisResult = document.getElementById('analysis-result');

  try {
    const response = await fetch(window.ESTADIA.apiUrl('exercises'));
    const data = await response.json();
    const exercises = data.exercises || [];

    listNode.innerHTML = exercises
      .map(
        (exercise) => `
          <a class="exercise-card" href="/exercises?exercise=${exercise.id}">
            <h3>Ejercicio ${exercise.id}</h3>
            <p>${exercise.title}</p>
            <span class="chip">${exercise.distribution}</span>
          </a>
        `
      )
      .join('');
  } catch (error) {
    listNode.innerHTML = '<p>No se pudieron cargar los ejercicios.</p>';
  }

  analysisButton.addEventListener('click', async () => {
    const text = analysisInput.value.trim();
    if (!text) {
      analysisResult.textContent = 'Escribe un enunciado estadístico para analizarlo.';
      return;
    }

    analysisResult.textContent = 'Analizando el texto e identificando la distribución...';

    try {
      const response = await fetch(window.ESTADIA.apiUrl('solve-problem'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const payload = await response.json();
      const analysis = payload.analysis || {};
      const result = payload.result;

      analysisResult.innerHTML = `
        <strong>Distribución sugerida:</strong> ${analysis.label || 'No identificada'}<br>
        <strong>Confianza:</strong> ${(analysis.confidence || 0) * 100}%<br>
        <strong>Ambigua:</strong> ${analysis.ambiguous ? 'Sí' : 'No'}<br>
        <strong>Operación estimada:</strong> ${payload.operation || 'No disponible'}<br>
        <strong>Resultado aproximado:</strong> ${result ? Number(result).toFixed(6) : 'Sin cálculo'}<br>
        <strong>Interpretación:</strong> ${payload.interpretation || 'Sin interpretación disponible'}<br><br>
        <strong>Paso a paso:</strong><br>
        ${((payload.steps || []).map((step) => `• ${step}`).join('<br>')) || 'Sin pasos disponibles'}
      `;
    } catch (error) {
      analysisResult.textContent = 'Ocurrió un error al analizar el texto.';
    }
  });
});
