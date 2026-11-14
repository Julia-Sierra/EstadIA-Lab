const { getExerciseById } = require('../models/exerciseModel');
const KeywordModel = require('../models/keywordModel');
const {
  binomialExact,
  binomialCdf,
  negativeBinomialP,
  negativeBinomialCdf,
  poissonProbability,
  poissonCdf,
  exponentialCdf,
  exponentialPercentile,
  exponentialBetween,
  normalCdf,
  normalPercentile
} = require('../models/distributionModels');

const keywordModel = new KeywordModel();

function parseNumeric(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function extractNumberFromText(text, fallback) {
  const match = (text || '').match(/(\d+(?:[.,]\d+)?)/);
  return match ? Number(match[1].replace(',', '.')) : fallback;
}

function findQuestionTargetByKeyword(text, fallback = 0) {
  const normalizedText = (text || '').toLowerCase();
  const patterns = [
    /(?:exactamente|igual a|igual(?:mente)?|es de)\s*(\d+(?:[.,]\d+)?)/i,
    /(?:como máximo|a lo sumo|no supere|maximo)\s*(\d+(?:[.,]\d+)?)/i,
    /(?:al menos|por lo menos|mas de|más de|supera|mayor que)\s*(\d+(?:[.,]\d+)?)/i,
    /(?:menos de|inferior a)\s*(\d+(?:[.,]\d+)?)/i,
    /(?:<=|≤|<|>=|≥|>)\s*(\d+(?:[.,]\d+)?)/i,
    /(?:entre\s*)(\d+(?:[.,]\d+)?)(?:\s*(?:y|e)\s*)(\d+(?:[.,]\d+)?)/i
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      if (match[2]) return Number(match[2].replace(',', '.'));
      return Number(match[1].replace(',', '.'));
    }
  }

  const explicitThreshold = /(?:mas de|más de|supera|alerta cuando recibe|excede|por encima de|mayor que)\s*(\d+(?:[.,]\d+)?)/i.exec(normalizedText);
  if (explicitThreshold) {
    return Number(explicitThreshold[1].replace(',', '.'));
  }

  return fallback;
}

const TIME_UNIT_SECONDS = {
  milisegundos: 0.001,
  segundos: 1,
  minutos: 60,
  horas: 3600,
  dias: 86400,
  semanas: 604800
};

function normalizePoissonText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeTimeUnit(unit) {
  const normalizedUnit = normalizePoissonText(unit).replace(/\./g, '');
  if (/^(?:ms|millisecond|milisegundo)/.test(normalizedUnit)) return 'milisegundos';
  if (/^(?:s|sec|second|seg)/.test(normalizedUnit)) return 'segundos';
  if (/^(?:m|min|minute|minuto)/.test(normalizedUnit)) return 'minutos';
  if (/^(?:h|hour|hora)/.test(normalizedUnit)) return 'horas';
  if (/^(?:d|day|dia)/.test(normalizedUnit)) return 'dias';
  if (/^(?:w|week|sem)/.test(normalizedUnit)) return 'semanas';
  return null;
}

function intervalToSeconds(value, unit) {
  const normalizedUnit = normalizeTimeUnit(unit);
  return normalizedUnit ? value * TIME_UNIT_SECONDS[normalizedUnit] : 0;
}

function extractPoissonBaseRate(text) {
  const normalizedText = normalizePoissonText(text);

  const rateMatch = /([0-9]+(?:[.,][0-9]+)?)\s*(?:solicitud(?:es)?|alertas?|llegadas?|eventos?|requests?|events?|arrivals?|calls?)\s*(?:cada|por|en|every|per)\s*(\d+(?:[.,]\d+)?)\s*(milisegundos?|milliseconds?|ms|segundos?|seconds?|seg|sec|s|minutos?|minutes?|min|m|horas?|hours?|h|dias?|days?|d|semanas?|weeks?|sem|w)\b/i.exec(normalizedText);
  if (rateMatch) {
    const lambdaBase = Number(rateMatch[1].replace(',', '.'));
    const intervaloBase = Number(rateMatch[2].replace(',', '.'));
    const unidadBase = normalizeTimeUnit(rateMatch[3]);
    const tiempoBaseSegundos = intervalToSeconds(intervaloBase, unidadBase);
    if (tiempoBaseSegundos > 0) {
      return { lambdaBase, intervaloBase, unidadBase, tiempoBaseSegundos };
    }
  }

  const averageMatch = /(?:en promedio|promedio)\s*([0-9]+(?:[.,]\d+)?)\s*(?:solicitud(?:es)?|alertas?|llegadas?|eventos?)/i.exec(normalizedText);
  const lambdaBase = averageMatch ? Number(averageMatch[1].replace(',', '.')) : 6;
  return {
    lambdaBase,
    intervaloBase: 1,
    unidadBase: 'minutos',
    tiempoBaseSegundos: TIME_UNIT_SECONDS.minutos
  };
}

function extractPoissonQuestionInterval(questionText) {
  const normalizedText = normalizePoissonText(questionText);
  const match = /\b(un|una|uno|medio|media|\d+(?:[.,]\d+)?)\s*(milisegundos?|milliseconds?|ms|segundos?|seconds?|seg|sec|s|minutos?|minutes?|min|m|horas?|hours?|h|dias?|days?|d|semanas?|weeks?|sem|w)\b/i.exec(normalizedText);
  if (!match) return null;

  const intervaloPregunta = /^(?:un|una|uno)$/i.test(match[1])
    ? 1
    : /^(?:medio|media)$/i.test(match[1])
      ? 0.5
      : Number(match[1].replace(',', '.'));
  const unidadPregunta = normalizeTimeUnit(match[2]);
  const tiempoPreguntaSegundos = intervalToSeconds(intervaloPregunta, unidadPregunta);
  if (tiempoPreguntaSegundos <= 0) return null;

  return { intervaloPregunta, unidadPregunta, tiempoPreguntaSegundos };
}

function extractPoissonAlertInterval(text) {
  const normalizedText = normalizePoissonText(text);
  const alertMatches = [...normalizedText.matchAll(/\b(?:alertas?|alarmas?)\b/g)];
  for (let index = alertMatches.length - 1; index >= 0; index -= 1) {
    const alertStart = alertMatches[index].index;
    const interval = extractPoissonQuestionInterval(normalizedText.slice(alertStart, alertStart + 180));
    if (interval) return interval;
  }
  return null;
}

function formatPoissonLambda(params) {
  const formatValue = (value) => Number(value.toPrecision(6)).toString();
  const unitLabels = { milisegundos: 'milisegundo', segundos: 'segundo', minutos: 'minuto', horas: 'hora', dias: 'día', semanas: 'semana' };
  const intervalUnit = params.intervaloPregunta === 1
    ? unitLabels[params.unidadPregunta]
    : params.unidadPregunta;
  return `λ ajustado = ${formatValue(params.lambdaBase)} × (${formatValue(params.tiempoPreguntaSegundos)} / ${formatValue(params.tiempoBaseSegundos)}) = ${formatValue(params.lambdaAjustado)} para ${formatValue(params.intervaloPregunta)} ${intervalUnit}`;
}

function setPoissonIntervalParams(params, lambdaBase, intervaloBase, unidadBase, intervaloPregunta, unidadPregunta) {
  const tiempoBaseSegundos = intervalToSeconds(intervaloBase, unidadBase);
  const tiempoPreguntaSegundos = intervalToSeconds(intervaloPregunta, unidadPregunta);
  const lambdaAjustado = lambdaBase * (tiempoPreguntaSegundos / tiempoBaseSegundos);
  Object.assign(params, {
    lambdaBase,
    intervaloBase,
    unidadBase: normalizeTimeUnit(unidadBase),
    tiempoBaseSegundos,
    lambdaAjustado,
    intervaloPregunta,
    unidadPregunta: normalizeTimeUnit(unidadPregunta),
    tiempoPreguntaSegundos
  });
  return lambdaAjustado;
}

function inferParamsByDistribution(distribution, text, questionText = text, inheritedPoissonInterval = null) {
  const normalizedText = (text || '').toLowerCase();

  if (distribution === 'binomial') {
    const pPercent = /([0-9]+(?:[.,][0-9]+)?)\s*%/.exec(normalizedText);
    const pValue = pPercent ? Number(pPercent[1]) / 100 : 0.12;
    const nValue = /\b(\d+)\s*(componentes|ensayos|intentos|elementos|servidores)\b/.exec(normalizedText);
    const n = nValue ? Number(nValue[1]) : 12;
    const normalizedQuestion = String(questionText || '').toLowerCase();
    const xValue = findQuestionTargetByKeyword(
      normalizedQuestion,
      /exactamente\s*(\d+)/.exec(normalizedQuestion)?.[1]
        || /\b(\d+)\s*(exitos|vulnerabilidades|fallas|servidores)\b/.exec(normalizedQuestion)?.[1]
    );
    return { n, p: pValue, x: xValue == null ? 3 : Number(xValue) };
  }

  if (distribution === 'negativeBinomial') {
    const pPercent = /([0-9]+(?:[.,][0-9]+)?)\s*%/.exec(normalizedText);
    const p = pPercent ? Number(pPercent[1]) / 100 : 0.75;
    const r = /\b(\d+)\s*(exitos|retransmisiones|pruebas)\b/.exec(normalizedText) || /\b(\d+)\s*(retransmision|prueba)\b/.exec(normalizedText);
    const k = /\b(en\s+el\s+|exactamente\s+en\s+)?(\d+)\s*(intento|intentos)\b/.exec(normalizedText);
    return { r: r ? Number(r[1]) : 5, p, k: k ? Number(k[2]) : 7 };
  }

  if (distribution === 'poisson') {
    const baseRate = extractPoissonBaseRate(normalizedText);
    const alertInterval = /alerta|alarma/i.test(questionText || '')
      ? extractPoissonAlertInterval(text)
      : null;
    const questionInterval = extractPoissonQuestionInterval(questionText)
      || alertInterval
      || inheritedPoissonInterval
      || {
      intervaloPregunta: baseRate.intervaloBase,
      unidadPregunta: baseRate.unidadBase,
      tiempoPreguntaSegundos: baseRate.tiempoBaseSegundos
      };
    const poissonParams = { ...baseRate };
    const lambdaAjustado = setPoissonIntervalParams(
      poissonParams,
      baseRate.lambdaBase,
      baseRate.intervaloBase,
      baseRate.unidadBase,
      questionInterval.intervaloPregunta,
      questionInterval.unidadPregunta
    );
    const isZeroEvent = /ningun[oa]?|cero|no\s+(?:se\s+)?(?:reciba|llegue|lleguen)/i.test(questionText || '');
    const questionTarget = findQuestionTargetByKeyword(questionText, null);
    const contextTarget = findQuestionTargetByKeyword(normalizedText, null);
    const x = isZeroEvent ? 0 : questionTarget ?? contextTarget ?? 8;
    return {
      ...poissonParams,
      lambdaAjustado,
      x
    };
  }

  if (distribution === 'exponential') {
    const rateMatch = /\b(\d+(?:[.,]\d+)?)\s*(mensajes|eventos|llegadas)\s*\b.*?\b(minuto|minuto|segundo|segundos)\b/.exec(normalizedText);
    const rateValue = rateMatch ? Number(rateMatch[1]) : 12;
    const lambda = /\bminuto\b/.test(normalizedText) ? rateValue / 60 : rateValue;
    return { lambda, t: 4 };
  }

  if (distribution === 'normal') {
    const mean = /media\s*(?:de\s*)?(\d+(?:[.,]\d+)?)/.exec(normalizedText) || /promedio\s*(?:de\s*)?(\d+(?:[.,]\d+)?)/.exec(normalizedText);
    const sd = /desviacion\s*(?:estandar|estándar)?\s*(?:de\s*)?(\d+(?:[.,]\d+)?)/.exec(normalizedText) || /\b(\d+(?:[.,]\d+)?)\s*ms\b/.exec(normalizedText);
    return {
      mean: mean ? Number(mean[1].replace(',', '.')) : 240,
      sd: sd ? Number(sd[1].replace(',', '.')) : 35,
      x: 300
    };
  }

  return {};
}

function exerciseLookup(exerciseId) {
  const exercise = getExerciseById(exerciseId);
  if (!exercise) {
    throw new Error('Ejercicio no encontrado.');
  }
  return exercise;
}

function analyzeText(inputText) {
  return keywordModel.analyze(inputText || '');
}

function inferQuestionText(text = '') {
  const normalized = text.toLowerCase();
  if (normalized.includes('exactamente')) return 'La probabilidad de que el evento ocurra exactamente en la cantidad indicada';
  if (normalized.includes('como máximo') || normalized.includes('a lo sumo') || normalized.includes('no supere') || normalized.includes('como maximo')) return 'La probabilidad de que el evento no supere el máximo indicado';
  if (normalized.includes('al menos') || normalized.includes('por lo menos')) return 'La probabilidad de que el evento ocurra al menos en la cantidad indicada';
  if (normalized.includes('mas de') || normalized.includes('más de') || normalized.includes('supera') || normalized.includes('mayor que')) return 'La probabilidad de que el evento supere la cantidad indicada';
  if (normalized.includes('entre')) return 'La probabilidad de que el evento ocurra dentro del intervalo indicado';
  if (normalized.includes('menos de') || normalized.includes('inferior a')) return 'La probabilidad de que el evento sea menor que el valor indicado';
  if (normalized.includes('alerta') || normalized.includes('activar la alerta')) return 'La probabilidad de que el sistema active la alerta por superar el umbral indicado';
  return 'La probabilidad del evento solicitado en el enunciado';
}

function normalizeQuestionInputs(input) {
  if (typeof input === 'string') {
    const matchQuestions = [...input.matchAll(/[^?]+\?/g)].map((match) => match[0].trim()).filter(Boolean);
    return {
      statement: input,
      questions: matchQuestions.length ? matchQuestions : [input]
    };
  }

  const statement = (input && (input.statement || input.text || '')) || '';
  const rawQuestions = Array.isArray(input && input.questions) ? input.questions : [];
  const questions = rawQuestions
    .map((question) => String(question || '').trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    statement,
    questions: questions.length ? questions : (statement ? [statement] : [])
  };
}

function computeDistributionResult(distribution, params, questionText = '', contextText = '') {
  let result;
  let formula = 'Fórmula estimada según la distribución detectada.';
  let operation = 'determinación general';
  const richQuestion = (questionText || '').toLowerCase();
  const contextLower = (contextText || questionText || '').toLowerCase();

  if (distribution === 'binomial') {
    const n = parseNumeric(params.n, 10);
    const p = parseNumeric(params.p, 0.5);
    const x = parseNumeric(params.x, 3);

    if (richQuestion.includes('como máximo') || richQuestion.includes('a lo sumo') || richQuestion.includes('no supere')) {
      operation = 'P(X <= x)';
      formula = `P(X <= ${x}) = Σ_{i=0}^{${x}} C(${n}, i) * ${p}^{i} * (1 - ${p})^(${n} - i)`;
      result = binomialCdf(n, p, x);
    } else if (richQuestion.includes('exactamente') || richQuestion.includes('igual a') || richQuestion.includes('igualmente')) {
      operation = 'P(X = x)';
      formula = `C(${n}, ${x}) * ${p}^{${x}} * (1 - ${p})^(${n} - ${x})`;
      result = binomialExact(n, p, x);
    } else if (richQuestion.includes('al menos') || richQuestion.includes('por lo menos')) {
      const lowerTailLimit = Math.ceil(x) - 1;
      const minimumSuccesses = lowerTailLimit + 1;
      operation = `P(X >= ${minimumSuccesses})`;
      formula = `P(X >= ${minimumSuccesses}) = 1 - P(X <= ${lowerTailLimit})`;
      result = 1 - binomialCdf(n, p, lowerTailLimit);
    } else if (richQuestion.includes('mas de') || richQuestion.includes('más de') || richQuestion.includes('supera')) {
      operation = `P(X > ${x})`;
      formula = `P(X > ${x}) = 1 - P(X <= ${x})`;
      result = 1 - binomialCdf(n, p, x);
    } else if (contextLower.includes('al menos') || contextLower.includes('por lo menos')) {
      const lowerTailLimit = Math.ceil(x) - 1;
      const minimumSuccesses = lowerTailLimit + 1;
      operation = `P(X >= ${minimumSuccesses})`;
      formula = `P(X >= ${minimumSuccesses}) = 1 - P(X <= ${lowerTailLimit})`;
      result = 1 - binomialCdf(n, p, lowerTailLimit);
    } else if (contextLower.includes('mas de') || contextLower.includes('más de') || contextLower.includes('supera')) {
      operation = `P(X > ${x})`;
      formula = `P(X > ${x}) = 1 - P(X <= ${x})`;
      result = 1 - binomialCdf(n, p, x);
    } else {
      operation = 'P(X = x)';
      formula = `C(${n}, ${x}) * ${p}^{${x}} * (1 - ${p})^(${n} - ${x})`;
      result = binomialExact(n, p, x);
    }
  }

  if (distribution === 'negativeBinomial') {
    const r = parseNumeric(params.r, 5);
    const p = parseNumeric(params.p, 0.75);
    const k = parseNumeric(params.k, 7);
    operation = 'P(X = k)';
    formula = `C(${k} - 1, ${r} - 1) * ${p}^{${r}} * (1 - ${p})^(${k} - ${r})`;
    result = negativeBinomialP(k, r, p);
  }

  if (distribution === 'poisson') {
    const lambda = parseNumeric(params.lambdaAjustado ?? params.lambda, 6);
    const x = parseNumeric(params.x, 8);
    const lambdaText = Number(lambda.toPrecision(6)).toString();
    const normalizedQuestion = normalizePoissonText(richQuestion);
    const normalizedContext = normalizePoissonText(contextLower);
    const lambdaConversion = Number.isFinite(params.tiempoBaseSegundos)
      && Number.isFinite(params.tiempoPreguntaSegundos)
      ? formatPoissonLambda(params)
      : `λ ajustado = ${lambdaText}`;
    const asksForMean = /promedio|valor esperado|cantidad esperada|media de|λ|lambda/.test(normalizedQuestion);
    const asksForZero = /ningun[oa]?|cero|no\s+(?:se\s+)?(?:reciba|llegue|lleguen)/.test(normalizedQuestion);
    const asksForAlert = /alerta|alarma|activar/.test(normalizedQuestion);
    const poissonEventType = (text) => {
      const normalized = normalizePoissonText(text);
      if (/(?:<=|≤|como maximo|a lo sumo|no supere|no mas de)/.test(normalized)) return 'lessOrEqual';
      if (/(?:<(?!=)|menos de|inferior a|menor que)/.test(normalized)) return 'less';
      if (/(?:>=|≥|al menos|por lo menos|como minimo|mayor o igual)/.test(normalized)) return 'greaterOrEqual';
      if (/(?:>|mas de|supera|mayor que|excede|por encima de)/.test(normalized)) return 'greater';
      return null;
    };
    const eventType = poissonEventType(questionText)
      || (asksForAlert ? poissonEventType(contextText) : null);

    if (asksForMean) {
      operation = 'E[X]';
      formula = `${lambdaConversion}; E[X] = ${lambdaText} solicitudes`;
      result = lambda;
    } else if (asksForZero) {
      operation = 'P(X = 0)';
      formula = `${lambdaConversion}; P(X = 0) = e^(-${lambdaText})`;
      result = poissonProbability(lambda, 0);
    } else if (eventType === 'lessOrEqual') {
      operation = `P(X <= ${x})`;
      formula = `${lambdaConversion}; P(X <= ${x}) = Σ_{k=0}^{${x}} (e^(-λ) * λ^k) / k!`;
      result = poissonCdf(lambda, x);
    } else if (eventType === 'less') {
      const upperLimit = Math.ceil(x) - 1;
      operation = `P(X < ${x})`;
      formula = `${lambdaConversion}; P(X < ${x}) = P(X <= ${upperLimit})`;
      result = poissonCdf(lambda, upperLimit);
    } else if (eventType === 'greaterOrEqual') {
      const lowerLimit = Math.ceil(x) - 1;
      operation = `P(X >= ${x})`;
      formula = `${lambdaConversion}; P(X >= ${x}) = 1 - P(X <= ${lowerLimit})`;
      result = 1 - poissonCdf(lambda, lowerLimit);
    } else if (eventType === 'greater') {
      operation = `P(X > ${x})`;
      formula = `${lambdaConversion}; P(X > ${x}) = 1 - Σ_{k=0}^{${x}} (e^(-${lambdaText}) * ${lambdaText}^k) / k!`;
      result = 1 - poissonCdf(lambda, x);
    } else if (/exactamente|igual a|igualmente|p\s*\(\s*x\s*=/.test(normalizedQuestion)) {
      operation = `P(X = ${x})`;
      formula = `${lambdaConversion}; P(X = ${x}) = (e^(-${lambdaText}) * ${lambdaText}^${x}) / ${x}!`;
      result = poissonProbability(lambda, x);
    } else {
      operation = `P(X = ${x})`;
      formula = `${lambdaConversion}; P(X = ${x}) = (e^(-${lambdaText}) * ${lambdaText}^${x}) / ${x}!`;
      result = poissonProbability(lambda, x);
    }
  }

  if (distribution === 'exponential') {
    const lambda = parseNumeric(params.lambda, 0.2);
    const t = parseNumeric(params.t, 4);
    operation = 'P(T < t)';
    formula = `1 - e^(-${lambda} * ${t})`;
    result = exponentialCdf(lambda, t);
  }

  if (distribution === 'normal') {
    const mean = parseNumeric(params.mean, 240);
    const sd = parseNumeric(params.sd, 35);
    const x = parseNumeric(params.x, 300);
    operation = 'P(X > x)';
    formula = `1 - Φ((x - μ)/σ) = 1 - Φ((${x} - ${mean}) / ${sd})`;
    result = 1 - normalCdf(x, mean, sd);
  }

  return { result, formula, operation };
}

function buildInterpretation({ text, distribution, operation, formula, result, params }) {
  const questionText = inferQuestionText(text);
  const paramText = Object.entries(params || {})
    .map(([key, value]) => `${key} = ${value}`)
    .join(', ');

  if (String(operation).startsWith('E[X]')) {
    return `${questionText}: la cantidad promedio esperada es ${Number(result).toFixed(4)} eventos durante el intervalo solicitado. Se obtiene con ${formula}.`;
  }

  const percentage = result <= 1 ? Number((result * 100).toFixed(4)) : Number(result.toFixed(4));
  const isUncommonEvent = result < 0.05;
  const isModerateEvent = result >= 0.05 && result < 0.25;
  const eventDescriptor = isUncommonEvent ? 'es poco probable' : isModerateEvent ? 'es moderadamente probable' : 'es bastante probable';

  return `${questionText} tiene un valor de ${Number(result).toFixed(6)} (${percentage}%). Esto se obtiene al evaluar la operación ${operation} con los parámetros ${paramText || 'no definidos explícitamente'} y la fórmula ${formula}. En términos estadísticos, ${eventDescriptor} bajo las condiciones del problema, por lo que la conclusión práctica es que el suceso analizado ${result < 0.5 ? 'no ocurre con frecuencia' : 'ocurre con una frecuencia relevante'} dentro del contexto del enunciado.`;
}

function solveProblem(input) {
  const { statement, questions } = normalizeQuestionInputs(input);
  const questionList = questions
    .map((question) => String(question || '').trim())
    .filter(Boolean)
    .slice(0, 5);
  const statementText = String(statement || '').trim();
  const baseText = [statementText, ...questionList].filter(Boolean).join(' ');
  const analysis = analyzeText(baseText);
  const distribution = analysis.distribution;

  if (analysis.distribution === 'poisson' && statementText && questionList.length >= 1 && !/solicitudes|alertas|llegadas|eventos/i.test(statementText)) {
    analysis.distribution = 'poisson';
    analysis.label = 'Poisson';
    analysis.confidence = Math.max(analysis.confidence || 0, 0.7);
  }

  if (!distribution) {
    return {
      ok: false,
      analysis,
      message: 'No se pudo identificar una distribución estadística con suficiente confianza. Intenta describir el problema con más detalle.',
      result: null
    };
  }

  const params = inferParamsByDistribution(distribution, baseText, questionList[0] || statement);

  if (questionList.length > 1) {
    let inheritedPoissonInterval = null;
    const answers = questionList.map((questionText, index) => {
      const questionContext = [statement, questionText].filter(Boolean).join(' ');
      const questionParams = inferParamsByDistribution(
        distribution,
        questionContext,
        questionText,
        inheritedPoissonInterval
      );
      if (distribution === 'poisson') {
        inheritedPoissonInterval = {
          intervaloPregunta: questionParams.intervaloPregunta,
          unidadPregunta: questionParams.unidadPregunta,
          tiempoPreguntaSegundos: questionParams.tiempoPreguntaSegundos
        };
      }
      const questionResult = computeDistributionResult(distribution, questionParams, questionText, questionContext);
      const numericResult = Number(questionResult.result.toFixed(10));
      const interpretation = buildInterpretation({
        text: questionContext,
        distribution,
        operation: questionResult.operation,
        formula: questionResult.formula,
        result: numericResult,
        params: questionParams
      });

      return {
        question: questionText,
        index: index + 1,
        params: questionParams,
        ...questionResult,
        result: numericResult,
        percentage: questionResult.operation === 'E[X]'
          ? null
          : Number((questionResult.result <= 1 ? questionResult.result * 100 : questionResult.result).toFixed(4)),
        interpretation
      };
    });

    return {
      ok: true,
      analysis,
      distribution,
      params,
      answers,
      message: `Se detectó una mayor coincidencia con ${analysis.label}. Se respondieron ${answers.length} preguntas del planteamiento.`
    };
  }

  const questionText = questionList[0] || statement || 'La probabilidad del evento solicitado en el enunciado';
  const computed = computeDistributionResult(distribution, params, questionText, [statement, questionText].filter(Boolean).join(' '));
  const numericResult = Number(computed.result.toFixed(10));
  const interpretation = buildInterpretation({
    text: [statement, questionText].filter(Boolean).join(' '),
    distribution,
    operation: computed.operation,
    formula: computed.formula,
    result: numericResult,
    params
  });

  return {
    ok: true,
    analysis,
    distribution,
    params,
    operation: computed.operation,
    formula: computed.formula,
    result: numericResult,
    percentage: computed.operation === 'E[X]'
      ? null
      : Number((computed.result <= 1 ? computed.result * 100 : computed.result).toFixed(4)),
    interpretation,
    message: `Se detectó una mayor coincidencia con ${analysis.label}. El problema parece seguir la distribución ${analysis.label}.`
  };
}

function calculateExercise(exerciseId, operationKey, customParams = {}) {
  const exercise = exerciseLookup(exerciseId);
  const params = { ...exercise.params, ...customParams };
  let result;
  let formula;

  switch (exercise.id) {
    case 1: {
      const n = parseNumeric(params.n, 18);
      const p = parseNumeric(params.p, 0.12);
      const x = parseNumeric(params.x ?? 3, 3);
      if (operationKey === 'exacta_3') result = binomialExact(n, p, x);
      if (operationKey === 'max_2') result = binomialCdf(n, p, parseNumeric(params.x ?? 2, 2));
      if (operationKey === 'suspension') result = 1 - binomialCdf(n, p, parseNumeric(params.threshold ?? 3, 3));
      if (operationKey === 'at_least_1') result = 1 - binomialExact(n, p, 0);
      break;
    }
    case 2: {
      const r = parseNumeric(params.r, 5);
      const p = parseNumeric(params.p, 0.75);
      if (operationKey === 'exacta_7') result = negativeBinomialP(7, r, p);
      if (operationKey === 'max_8') result = negativeBinomialCdf(parseNumeric(params.maxAttempts ?? 8, 8), r, p);
      if (operationKey === 'at_least_9') result = 1 - negativeBinomialCdf(parseNumeric(params.maxAttempts ?? 8, 8), r, p);
      if (operationKey === 'exacta_5') result = negativeBinomialP(5, r, p);
      break;
    }
    case 3: {
      const ratePer15 = parseNumeric(params.ratePer15, 9);
      const interval = operationKey === 'max_3_5min'
        ? parseNumeric(params.alternativeMinutes ?? 5, 5)
        : parseNumeric(params.intervalMinutes ?? 20, 20);
      const lambda = setPoissonIntervalParams(params, ratePer15, 15, 'minutos', interval, 'minutos');
      const lambdaText = Number(lambda.toPrecision(6)).toString();
      const lambdaFormula = formatPoissonLambda(params);
      if (operationKey === 'mean_20') {
        result = lambda;
        formula = `${lambdaFormula}; E[X] = ${lambdaText} alertas`;
      }
      if (operationKey === 'exacta_12') {
        result = poissonProbability(lambda, 12);
        formula = `${lambdaFormula}; P(X = 12) = (e^(-${lambdaText}) * ${lambdaText}^12) / 12!`;
      }
      if (operationKey === 'risk_20') {
        const threshold = parseNumeric(params.threshold ?? 15, 15);
        result = 1 - poissonCdf(lambda, threshold);
        formula = `${lambdaFormula}; P(X > ${threshold}) = 1 - P(X <= ${threshold})`;
      }
      if (operationKey === 'max_3_5min') {
        result = poissonCdf(lambda, 3);
        formula = `${lambdaFormula}; P(X <= 3) = Σ_{k=0}^{3} (e^(-λ) * λ^k) / k!`;
      }
      break;
    }
    case 4: {
      const n = parseNumeric(params.n, 20);
      const p = parseNumeric(params.p, 0.08);
      if (operationKey === 'exacta_4') result = binomialExact(n, p, 4);
      if (operationKey === 'max_3') result = binomialCdf(n, p, 3);
      if (operationKey === 'at_least_5') result = 1 - binomialCdf(n, p, 4);
      break;
    }
    case 5: {
      const ratePer3 = parseNumeric(params.ratePer3Min, 18);
      const intervalSeconds = operationKey === 'zero_30s'
        ? parseNumeric(params.alternativeIntervalSeconds ?? 30, 30)
        : parseNumeric(params.intervalMinutes ?? 1, 1) * 60;
      const interval = intervalSeconds < 60 ? intervalSeconds : intervalSeconds / 60;
      const intervalUnit = intervalSeconds < 60 ? 'segundos' : 'minutos';
      const lambda = setPoissonIntervalParams(params, ratePer3, 3, 'minutos', interval, intervalUnit);
      const lambdaText = Number(lambda.toPrecision(6)).toString();
      const lambdaFormula = formatPoissonLambda(params);
      if (operationKey === 'mean_1min') {
        result = lambda;
        formula = `${lambdaFormula}; E[X] = ${lambdaText} solicitudes`;
      }
      if (operationKey === 'exacta_8') {
        result = poissonProbability(lambda, 8);
        formula = `${lambdaFormula}; P(X = 8) = (e^(-${lambdaText}) * ${lambdaText}^8) / 8!`;
      }
      if (operationKey === 'alerta_1min') {
        const threshold = parseNumeric(params.threshold ?? 10, 10);
        result = 1 - poissonCdf(lambda, threshold);
        formula = `${lambdaFormula}; P(X > ${threshold}) = 1 - P(X <= ${threshold})`;
      }
      if (operationKey === 'zero_30s') {
        result = poissonProbability(lambda, 0);
        formula = `${lambdaFormula}; P(X = 0) = e^(-${lambdaText})`;
      }
      break;
    }
    case 6: {
      const r = parseNumeric(params.r, 6);
      const p = parseNumeric(params.p, 0.65);
      if (operationKey === 'exacta_10') result = negativeBinomialP(10, r, p);
      if (operationKey === 'max_8') result = negativeBinomialCdf(parseNumeric(params.maxAttempts ?? 8, 8), r, p);
      if (operationKey === 'more_than_10') result = 1 - negativeBinomialCdf(10, r, p);
      break;
    }
    case 7: {
      const lambda = parseNumeric(params.lambdaPerSecond ?? 0.2, 0.2);
      if (operationKey === 'before_4s') result = exponentialCdf(lambda, 4);
      if (operationKey === 'after_10s') result = 1 - exponentialCdf(lambda, 10);
      if (operationKey === 'between_3_8s') result = exponentialBetween(lambda, 3, 8);
      if (operationKey === 'p90') result = exponentialPercentile(lambda, 0.9);
      break;
    }
    case 8: {
      const mean = parseNumeric(params.mean, 240);
      const sd = parseNumeric(params.sd, 35);
      if (operationKey === 'gt_300') result = 1 - normalCdf(300, mean, sd);
      if (operationKey === 'between_210_280') result = normalCdf(280, mean, sd) - normalCdf(210, mean, sd);
      if (operationKey === 'lt_200') result = normalCdf(200, mean, sd);
      if (operationKey === 'percentile_95') result = normalPercentile(0.95, mean, sd);
      break;
    }
    default:
      throw new Error('No existe cálculo para esta operación.');
  }

  if (typeof result !== 'number' || Number.isNaN(result)) {
    throw new Error('El cálculo no generó un valor válido.');
  }

  const selectedOperation = exercise.operations.find((operation) => operation.key === operationKey) || exercise.operations[0];
  const numericResult = Number(result.toFixed(10));
  const interpretation = buildInterpretation({
    text: exercise.enunciado,
    distribution: exercise.distribution,
    operation: selectedOperation.label,
    formula: formula || selectedOperation.formula,
    result: numericResult,
    params
  });

  return {
    exerciseId: exercise.id,
    title: exercise.title,
    operationKey,
    result: numericResult,
    formula: formula || selectedOperation.formula,
    percentage: operationKey.startsWith('mean_')
      ? null
      : Number((result <= 1 ? result * 100 : result).toFixed(4)),
    params,
    interpretation
  };
}

module.exports = {
  analyzeText,
  solveProblem,
  calculateExercise,
  exerciseLookup
};
