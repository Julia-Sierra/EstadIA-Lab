document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const exerciseId = params.get('exercise');
  const titleNode = document.getElementById('exercise-title');
  const enunciadoNode = document.getElementById('exercise-enunciado');
  const distributionNode = document.getElementById('exercise-distribution');
  const parametersNode = document.getElementById('exercise-params');
  const operationsNode = document.getElementById('exercise-operations');
  const selectNode = document.getElementById('exercise-select');
  const resultBox = document.getElementById('result-box');
  const calculateButton = document.getElementById('calculate-button');
  const assistantButton = document.getElementById('assistant-button');
  const assistantForm = document.getElementById('assistant-form');
  const assistantQuestion = document.getElementById('assistant-question');
  const assistantOutput = document.getElementById('assistant-output');
  const problemStatement = document.getElementById('problem-statement');
  const problemQuestion1 = document.getElementById('problem-question-1');
  const problemQuestion2 = document.getElementById('problem-question-2');
  const problemQuestion3 = document.getElementById('problem-question-3');
  const problemQuestion4 = document.getElementById('problem-question-4');
  const problemQuestion5 = document.getElementById('problem-question-5');
  const analyzeProblemButton = document.getElementById('analyze-problem-button');
  const resetProblemButton = document.getElementById('reset-problem-button');
  const problemAnalysis = document.getElementById('problem-analysis');

  let currentExercise = null;
  let activeOperation = null;
  let latestSolution = null;

  const customOperationsByDistribution = {
    binomial: [
      { key: 'exacta', label: 'P(X = x)', description: 'Probabilidad exacta' },
      { key: 'acumulada_inferior', label: 'P(X <= x)', description: 'Acumulada inferior' },
      { key: 'acumulada_superior', label: 'P(X >= x)', description: 'Acumulada superior' }
    ],
    negativebinomial: [
      { key: 'k_ensayo', label: 'P(X = k)', description: 'Probabilidad en el intento k' },
      { key: 'max_k', label: 'P(X <= k)', description: 'Máximo de intentos' },
      { key: 'al_menos_k', label: 'P(X >= k)', description: 'Probabilidad complementaria' }
    ],
    poisson: [
      { key: 'exacta_poisson', label: 'P(X = x)', description: 'Probabilidad exacta' },
      { key: 'max_poisson', label: 'P(X <= x)', description: 'Como máximo' },
      { key: 'mas_de_poisson', label: 'P(X > x)', description: 'Más de x' }
    ],
    exponential: [
      { key: 'antes_t', label: 'P(T < t)', description: 'Antes de un tiempo' },
      { key: 'despues_t', label: 'P(T > t)', description: 'Más de un tiempo' },
      { key: 'entre_t', label: 'P(a < T < b)', description: 'Entre dos tiempos' }
    ],
    normal: [
      { key: 'inferior', label: 'P(X < x)', description: 'Probabilidad inferior' },
      { key: 'superior', label: 'P(X > x)', description: 'Probabilidad superior' },
      { key: 'intervalo', label: 'P(a < X < b)', description: 'Entre dos valores' }
    ]
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }

  function renderOperationChoices(items) {
    operationsNode.innerHTML = (items || [])
      .map((operation) => `
        <div class="operation-item" data-key="${operation.key}">
          <strong>${operation.label}</strong>
          <span>${operation.description}</span>
        </div>
      `)
      .join('');

    selectNode.innerHTML = (items || [])
      .map((operation) => `<option value="${operation.key}">${operation.label}</option>`)
      .join('');

    const operationItems = document.querySelectorAll('.operation-item');
    operationItems.forEach((item) => {
      item.addEventListener('click', () => {
        const key = item.dataset.key;
        selectNode.value = key;
        activeOperation = key;
        if (currentExercise) {
          calculateSelectedOperation();
        }
      });
    });

    activeOperation = items?.[0]?.key || null;
    if (items?.length) {
      selectNode.value = activeOperation;
    }
  }

  function getQuestionInputs() {
    return [problemQuestion1, problemQuestion2, problemQuestion3, problemQuestion4, problemQuestion5]
      .map((input) => (input ? input.value.trim() : ''))
      .filter(Boolean);
  }

  function blankExerciseState() {
    titleNode.textContent = 'Sin ejercicio cargado';
    enunciadoNode.textContent = 'Escribe un problema para identificar la distribución y obtener una estimación inicial de resolución.';
    distributionNode.textContent = 'Distribución: pendiente';
    parametersNode.innerHTML = '<div class="param-item">Introduce el enunciado del problema para extraer parámetros.</div>';
    operationsNode.innerHTML = '<div class="operation-item"><strong>Lista vacía</strong><span>El sistema mostrará operaciones una vez que detecte la distribución.</span></div>';
    selectNode.innerHTML = '<option value="">Selecciona una operación</option>';
    resultBox.innerHTML = 'Aún no hay un cálculo. Introduce un problema para analizarlo.';
    problemAnalysis.textContent = 'La distribución se detectará aquí tras analizar el texto ingresado.';
  }

  async function fetchExercise(id) {
    const response = await fetch(window.ESTADIA.apiUrl(`exercises/${encodeURIComponent(id)}`));
    const payload = await response.json();
    currentExercise = payload.exercise;
    renderExercise(currentExercise);
    await fetchAnalysis(currentExercise.enunciado);
    await calculateSelectedOperation();
  }

  function renderExercise(exercise) {
    titleNode.textContent = `Ejercicio ${exercise.id}: ${exercise.title}`;
    enunciadoNode.textContent = exercise.enunciado;
    distributionNode.textContent = `Distribución: ${exercise.distribution}`;
    parametersNode.innerHTML = window.ESTADIA.renderParamList(exercise.params);
    renderOperationChoices(exercise.operations || []);
  }

  async function fetchAnalysis(text) {
    const response = await fetch(window.ESTADIA.apiUrl('analyze'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const payload = await response.json();
    const analysis = payload.analysis || {};
    const output = document.getElementById('problem-analysis');
    if (output) {
      output.innerHTML = `
        <strong>Distribución sugerida:</strong> ${analysis.label || 'No identificada'}<br>
        <strong>Confianza:</strong> ${(analysis.confidence || 0) * 100}%<br>
        <strong>Explicación:</strong> ${analysis.explanation || 'Sin explicación'}
      `;
    }
  }

  async function calculateSelectedOperation() {
    if (!currentExercise || !activeOperation) return;
    const selected = currentExercise.operations.find((item) => item.key === activeOperation) || currentExercise.operations[0];
    const response = await fetch(window.ESTADIA.apiUrl('calculate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exerciseId: currentExercise.id,
        operationKey: selected.key,
        params: currentExercise.params
      })
    });
    const payload = await response.json();
    const data = payload.result;
    const isExpectedCount = selected.key.startsWith('mean_');
    const resultSummary = isExpectedCount
      ? `<p>Cantidad promedio esperada: <strong>${Number(data.result).toFixed(2)}</strong></p>`
      : `<p>La probabilidad es: <strong>${Number(data.result).toFixed(5)}</strong> (${Number(data.percentage).toFixed(2)}%)</p>`;
    parametersNode.innerHTML = window.ESTADIA.renderParamList(data.params || currentExercise.params);

    resultBox.innerHTML = `
      <div class="answer-result">
        <h3>Resultado</h3>
        ${resultSummary}
        <div class="answer-formula">${escapeHtml(data.formula || selected.formula)}</div>
      </div>
    `;

    if (currentExercise && currentExercise.distribution === 'normal') {
      const chartLabels = ['Teórica', 'Experimental'];
      const chartValues = [Number(data.result), Math.min(Number(data.result) + 0.1, 1)];
      if (window.ESTADIA.createComparisonChart) {
        window.ESTADIA.createComparisonChart(document.getElementById('result-chart'), chartLabels, chartValues);
      }
    }
  }

  async function analyzeProblemText() {
    const statement = problemStatement.value.trim();
    const questions = getQuestionInputs();
    const text = statement || questions.join(' ');

    if (!text) {
      problemAnalysis.textContent = 'Escribe un planteamiento y, si aplica, al menos una pregunta para analizarlo.';
      blankExerciseState();
      return;
    }

    problemAnalysis.textContent = 'Analizando el problema y detectando la distribución...';

    try {
      const response = await fetch(window.ESTADIA.apiUrl('solve-problem'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statement, questions })
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload.analysis) {
        problemAnalysis.textContent = payload?.message || `El servidor respondió con HTTP ${response.status}.`;
        return;
      }

      const analysis = payload.analysis;
      latestSolution = payload;
      const distributionLabel = analysis.label || 'No identificada';
      const distributionKey = (analysis.distribution || 'binomial').toLowerCase();
      const availableOperations = customOperationsByDistribution[distributionKey] || customOperationsByDistribution.binomial;

      titleNode.textContent = `Problema personalizado: ${distributionLabel}`;
      enunciadoNode.textContent = statement || questions.join(' ');
      distributionNode.textContent = `Distribución: ${distributionLabel}`;
      parametersNode.innerHTML = window.ESTADIA.renderParamList(payload.params || {});
      renderOperationChoices(availableOperations);

      const results = Array.isArray(payload.answers) && payload.answers.length ? payload.answers : [payload];
      resultBox.innerHTML = results
        .map((item, index) => {
          const questionText = item.question || `Pregunta ${index + 1}`;
          const resultNumber = Number(item.result ?? payload.result ?? 0);
          const percentageNumber = Number(item.percentage ?? payload.percentage ?? 0);
          const formula = item.formula || payload.formula || 'No disponible';
          const operation = item.operation || payload.operation || '';
          const isExpectedCount = operation.startsWith('E[X]');
          const adjustedLambda = item.params?.lambdaAjustado;
          const lambdaSummary = Number.isFinite(adjustedLambda)
            ? `<p>λ ajustado: <strong>${Number(adjustedLambda).toPrecision(6)}</strong> para ${escapeHtml(String(item.params.intervaloPregunta))} ${escapeHtml(item.params.unidadPregunta)}</p>`
            : '';
          const resultSummary = isExpectedCount
            ? `<p>Cantidad promedio esperada: <strong>${resultNumber.toFixed(2)}</strong></p>`
            : `<p>La probabilidad es: <strong>${resultNumber.toFixed(5)}</strong> (${percentageNumber.toFixed(2)}%)</p>`;
          return `
            <div class="multi-answer">
              <span class="answer-question">Pregunta ${index + 1}: ${escapeHtml(questionText)}</span>
              ${lambdaSummary}
              ${resultSummary}
              <div class="answer-formula">${escapeHtml(formula)}</div>
            </div>
          `;
        })
        .join('');

      problemAnalysis.innerHTML = `
        <strong>Distribución sugerida:</strong> ${distributionLabel}<br>
        <strong>Confianza:</strong> ${(analysis.confidence || 0) * 100}%<br>
        <strong>Ambigua:</strong> ${analysis.ambiguous ? 'Sí' : 'No'}<br>
        <strong>Explicación:</strong> ${analysis.explanation || 'Sin detalle'}
      `;

      if (analysis.label === 'Normal' && window.ESTADIA.createComparisonChart) {
        const primaryValue = Number((results[0] && results[0].result) ?? payload.result ?? 0);
        const chartLabels = ['Resultado estimado', 'Referencia'];
        const chartValues = [primaryValue, Math.min(primaryValue + 0.05, 1)];
        window.ESTADIA.createComparisonChart(document.getElementById('result-chart'), chartLabels, chartValues);
      }

      currentExercise = null;
      activeOperation = null;
    } catch (error) {
      console.error('No se pudo analizar el problema:', error);
      problemAnalysis.textContent = error instanceof TypeError
        ? 'No se pudo conectar con la API. Verifica el dominio del backend y la configuración CORS.'
        : error.message || 'Ocurrió un error al analizar el problema.';
    }
  }

  selectNode.addEventListener('change', (event) => {
    activeOperation = event.target.value;
    if (currentExercise) {
      calculateSelectedOperation();
    }
  });

  calculateButton.addEventListener('click', async () => {
    if (currentExercise) {
      await calculateSelectedOperation();
      return;
    }
    await analyzeProblemText();
  });

  assistantForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const question = assistantQuestion.value.trim();
    if (!question) {
      assistantOutput.textContent = 'Escribe tu pregunta para enviarla a Gemini.';
      assistantQuestion.focus();
      return;
    }

    const customAnswers = latestSolution?.answers || [];
    const selectedExerciseOperation = currentExercise?.operations
      .find((item) => item.key === activeOperation);
    const context = {
      question,
      enunciado: problemStatement.value.trim() || currentExercise?.enunciado || enunciadoNode.textContent,
      distribution: latestSolution?.analysis?.label || currentExercise?.distribution || 'No identificada',
      keywords: latestSolution?.analysis?.keywords || [],
      params: latestSolution?.params || currentExercise?.params || {},
      answers: latestSolution?.answers || [],
      operation: customAnswers.map((answer) => answer.operation).filter(Boolean).join('; ')
        || selectedExerciseOperation?.label
        || 'No especificada',
      formula: customAnswers.map((answer) => answer.formula).filter(Boolean).join('; ')
        || selectedExerciseOperation?.formula
        || 'No especificada',
      result: resultBox.textContent.trim() || 'Aún no hay resultados calculados.'
    };

    assistantButton.disabled = true;
    try {
      await window.ESTADIA.askAssistant(context);
    } finally {
      assistantButton.disabled = false;
    }
  });

  analyzeProblemButton.addEventListener('click', analyzeProblemText);
  resetProblemButton.addEventListener('click', () => {
    problemStatement.value = '';
    [problemQuestion1, problemQuestion2, problemQuestion3, problemQuestion4, problemQuestion5]
      .forEach((input) => { input.value = ''; });
    problemAnalysis.textContent = 'La distribución se detectará aquí tras analizar el texto ingresado.';
    blankExerciseState();
    currentExercise = null;
    activeOperation = null;
    latestSolution = null;
    assistantOutput.textContent = 'La respuesta de Gemini aparecerá aquí.';
  });

  if (exerciseId) {
    await fetchExercise(exerciseId);
  } else {
    blankExerciseState();
  }
});
