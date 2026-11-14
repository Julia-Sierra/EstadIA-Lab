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
    /(?:exactamente|exactly|igual a|igual(?:mente)?|es de)\s*(\d+(?:[.,]\d+)?)/i,
    /(?:como máximo|a lo sumo|no supere|maximo|at most|no more than)\s*(\d+(?:[.,]\d+)?)/i,
    /(?:al menos|por lo menos|mas de|más de|supera|mayor que|at least|more than|greater than)\s*(\d+(?:[.,]\d+)?)/i,
    /(?:menos de|inferior a|less than)\s*(\d+(?:[.,]\d+)?)/i,
    /(?:<=|≤|>=|≥|<|>)\s*(\d+(?:[.,]\d+)?)/i,
    /(?:entre\s*)(\d+(?:[.,]\d+)?)(?:\s*(?:y|e)\s*)(\d+(?:[.,]\d+)?)/i
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      if (match[2]) return Number(match[2].replace(',', '.'));
      return Number(match[1].replace(',', '.'));
    }
  }

  const explicitThreshold = /(?:mas de|más de|supera|alerta cuando recibe|excede|por encima de|mayor que|more than|greater than)\s*(\d+(?:[.,]\d+)?)/i.exec(normalizedText);
  if (explicitThreshold) {
    return Number(explicitThreshold[1].replace(',', '.'));
  }

  return fallback;
}

const UNIT_DEFINITIONS = [
  { canonical: 'milisegundos', dimension: 'time', factor: 0.001, aliases: ['milisegundo', 'milisegundos', 'millisecond', 'milliseconds', 'ms'] },
  { canonical: 'segundos', dimension: 'time', factor: 1, aliases: ['segundo', 'segundos', 'second', 'seconds', 'sec', 'secs', 'seg', 'segs', 's'] },
  { canonical: 'minutos', dimension: 'time', factor: 60, aliases: ['minuto', 'minutos', 'minute', 'minutes', 'min', 'mins'] },
  { canonical: 'horas', dimension: 'time', factor: 3600, aliases: ['hora', 'horas', 'hour', 'hours', 'hr', 'hrs', 'h'] },
  { canonical: 'dias', dimension: 'time', factor: 86400, aliases: ['dia', 'dias', 'day', 'days', 'd'] },
  { canonical: 'semanas', dimension: 'time', factor: 604800, aliases: ['semana', 'semanas', 'week', 'weeks', 'wk', 'wks'] },
  { canonical: 'meses', dimension: 'time', factor: 2592000, aliases: ['mes', 'meses', 'month', 'months'] },
  { canonical: 'años', dimension: 'time', factor: 31536000, aliases: ['ano', 'anos', 'year', 'years', 'yr', 'yrs'] },
  { canonical: 'milimetros', dimension: 'length', factor: 0.001, aliases: ['milimetro', 'milimetros', 'millimeter', 'millimeters', 'mm'] },
  { canonical: 'centimetros', dimension: 'length', factor: 0.01, aliases: ['centimetro', 'centimetros', 'centimeter', 'centimeters', 'cm'] },
  { canonical: 'metros', dimension: 'length', factor: 1, aliases: ['metro', 'metros', 'meter', 'meters', 'm'] },
  { canonical: 'kilometros', dimension: 'length', factor: 1000, aliases: ['kilometro', 'kilometros', 'kilometer', 'kilometers', 'km'] },
  { canonical: 'pulgadas', dimension: 'length', factor: 0.0254, aliases: ['pulgada', 'pulgadas', 'inch', 'inches', 'in'] },
  { canonical: 'pies', dimension: 'length', factor: 0.3048, aliases: ['pie', 'pies', 'foot', 'feet', 'ft'] },
  { canonical: 'yardas', dimension: 'length', factor: 0.9144, aliases: ['yarda', 'yardas', 'yard', 'yards', 'yd', 'yds'] },
  { canonical: 'millas', dimension: 'length', factor: 1609.344, aliases: ['milla', 'millas', 'mile', 'miles', 'mi'] },
  { canonical: 'paginas', dimension: 'pages', factor: 1, aliases: ['pagina', 'paginas', 'page', 'pages', 'hoja', 'hojas'] }
];
const UNIT_ALIASES = new Map(
  UNIT_DEFINITIONS.flatMap((definition) => definition.aliases.map((alias) => [
    normalizePoissonText(alias),
    definition
  ]))
);
const KNOWN_UNIT_PATTERN = [...UNIT_ALIASES.keys()]
  .sort((left, right) => right.length - left.length)
  .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');
const UNIT_PATTERN = `(?:${KNOWN_UNIT_PATTERN}|[a-z][a-z-]*)`;
const NUMBER_PATTERN = '\\d+(?:[.,]\\d+)?';
const QUANTITY_PATTERN = `(?:un\\s+cuarto\\s+de|cuarto\\s+de|medio|media|un|una|uno|${NUMBER_PATTERN}(?:\\s*\\/\\s*\\d+)?)`;
const INTERVAL_MARKER_PATTERN = '\\b(?<connector>cada|por(?:\\s+cada)?|en|durante|a\\s+lo\\s+largo\\s+de|every|each|per|in|within|during|for|over)\\s+';
const INTERVAL_PATTERN = new RegExp(
  `${INTERVAL_MARKER_PATTERN}(?:(?:un|una|el|la|the|a|an)\\s+(?:intervalo|periodo|period|duration|lapso)\\s+(?:de|of)\\s+(?:tiempo\\s+(?:de|of)\\s+)?)?(?:(?<amount>${QUANTITY_PATTERN})\\s+)?(?<unit>${UNIT_PATTERN})\\b`,
  'giu'
);
const EVENT_TERMS = /\b(?:evento|eventos|suceso|sucesos|ocurrencia|ocurrencias|llegada|llegadas|solicitud|solicitudes|alerta|alertas|llamada|llamadas|mensaje|mensajes|incidente|incidentes|fallo|fallos|falla|fallas|visita|visitas|accidente|accidentes|request|requests|event|events|arrival|arrivals|call|calls|message|messages|failure|failures|incident|incidents)\b/i;
const RATE_TERMS = /\b(?:promedio|promedia|media|tasa|frecuencia|average|averages|mean|rate|frequency|lambda|λ|recibe|reciben|receive|receives|ocurre|ocurren|sucede|suceden|produce|producen|registra|registran|llega|llegan|arrive|arrives|occur|occurs)\b/i;
const THRESHOLD_PREFIX = /(?:mas de|al menos|por lo menos|mayor que|superior a|excede|supera|alerta cuando|alarma cuando|threshold|more than|greater than|exceeds)\s*$/i;
const NON_INTERVAL_UNITS = new Set([
  'evento', 'eventos', 'suceso', 'sucesos', 'ocurrencia', 'ocurrencias',
  'solicitud', 'solicitudes', 'request', 'requests', 'llegada', 'llegadas',
  'arrival', 'arrivals', 'fallo', 'fallos', 'falla', 'fallas',
  'message', 'messages', 'mensaje', 'mensajes'
]);
const NON_EVENT_WORDS = new Set([
  'a', 'an', 'the', 'of', 'and', 'or', 'is', 'are', 'was', 'were', 'in',
  'en', 'por', 'cada', 'every', 'each', 'per', 'during', 'within', 'for',
  'over', 'de', 'del', 'un', 'una', 'uno', 'se', 'que', 'con', 'average',
  'averages', 'mean', 'rate', 'frequency', 'promedio', 'media', 'tasa',
  'frecuencia', 'occur', 'occurs', 'ocurre', 'ocurren', 'happen', 'happens',
  'sucede', 'suceden', 'produce', 'producen', 'record', 'records', 'registra',
  'registran', 'receive', 'receives', 'recibe', 'reciben', 'arrive', 'arrives',
  'llega', 'llegan', 'on', 'at', 'by'
]);

function normalizePoissonText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeGenericUnit(unit) {
  const normalized = normalizePoissonText(unit).replace(/[.]$/, '');
  if (/(?:ches|shes|xes|zes|ses)$/.test(normalized)) return normalized.slice(0, -2);
  if (/(?:ss|is|us)$/.test(normalized)) return normalized;
  return normalized.endsWith('s') ? normalized.slice(0, -1) : normalized;
}

function resolveUnit(unit) {
  const normalized = normalizePoissonText(unit).replace(/[.]$/, '');
  const known = UNIT_ALIASES.get(normalized);
  if (known) return known;
  return {
    canonical: normalizeGenericUnit(normalized),
    dimension: `unit:${normalizeGenericUnit(normalized)}`,
    factor: 1
  };
}

function hasEventDescriptor(text) {
  const normalized = normalizePoissonText(text);
  if (EVENT_TERMS.test(normalized)) return true;
  return normalized.split(/[^a-z0-9-]+/).some((word) => (
    word
    && !NON_EVENT_WORDS.has(word)
    && !UNIT_ALIASES.has(word)
    && !/^\d+$/.test(word)
  ));
}

function findSentenceBoundaries(text) {
  return [...text.matchAll(/[.!?;\n]/g)]
    .map((match) => match.index)
    .filter((index) => (
      text[index] !== '.'
      || !(/\d/.test(text[index - 1] || '') && /\d/.test(text[index + 1] || ''))
    ));
}

function parseIntervalAmount(amount) {
  if (!amount) return 1;
  if (/^(?:un\s+cuarto\s+de|cuarto\s+de)$/.test(amount)) return 0.25;
  if (/^medio$|^media$/.test(amount)) return 0.5;
  const fraction = /^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/.exec(amount);
  if (fraction) {
    const denominator = Number(fraction[2].replace(',', '.'));
    return denominator > 0
      ? Number(fraction[1].replace(',', '.')) / denominator
      : Number.NaN;
  }
  if (/^(?:un|una|uno)$/.test(amount)) return 1;
  return Number(amount.replace(',', '.'));
}

function extractPoissonIntervals(text) {
  const normalizedText = normalizePoissonText(text);
  const intervals = [];
  for (const match of normalizedText.matchAll(INTERVAL_PATTERN)) {
    const amount = parseIntervalAmount(match.groups.amount);
    const unitToken = match.groups.unit;
    const unit = resolveUnit(unitToken);
    const isKnownUnit = UNIT_ALIASES.has(unitToken);
    const connector = match.groups.connector;
    const isExplicitlyQuantified = Boolean(match.groups.amount);
    if (!isKnownUnit && (
      (NON_INTERVAL_UNITS.has(unitToken) || EVENT_TERMS.test(unitToken))
      || !isExplicitlyQuantified
      || (/^(?:en|during|within)$/.test(connector) && /^(?:un|una|uno)$/.test(match.groups.amount || ''))
    )) {
      continue;
    }

    const normalizedValue = amount * unit.factor;
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(normalizedValue) || normalizedValue <= 0) {
      continue;
    }

    intervals.push({
      intervalo: amount,
      unidad: unit.canonical,
      unidadOriginal: unitToken,
      dimension: unit.dimension,
      valorNormalizado: normalizedValue,
      indice: match.index,
      fin: match.index + match[0].length,
      conector: connector
    });
  }
  return intervals;
}

function extractPoissonBaseRate(text) {
  const normalizedText = normalizePoissonText(text);
  const candidates = [];
  for (const interval of extractPoissonIntervals(normalizedText)) {
    const textBeforeInterval = normalizedText.slice(0, interval.indice);
    const priorBoundaries = findSentenceBoundaries(textBeforeInterval);
    const sentenceStart = (priorBoundaries[priorBoundaries.length - 1] ?? -1) + 1;
    const prefix = normalizedText.slice(Math.max(sentenceStart, interval.indice - 120), interval.indice);
    const numbers = [...prefix.matchAll(new RegExp(NUMBER_PATTERN, 'g'))];
    if (numbers.length) {
      const countMatch = numbers[numbers.length - 1];
      const lambdaBase = Number(countMatch[0].replace(',', '.'));
      const beforeCount = prefix.slice(0, countMatch.index);
      const afterCount = prefix.slice(countMatch.index + countMatch[0].length);
      const markedAsThreshold = THRESHOLD_PREFIX.test(beforeCount.slice(-80).trimEnd());
      const describesEvents = hasEventDescriptor(afterCount) || EVENT_TERMS.test(beforeCount);
      const hasRateConnector = /^(?:cada|por|every|each|per|in|en)$/.test(interval.conector);
      const describesRate = RATE_TERMS.test(beforeCount.slice(-100))
        && (describesEvents || hasRateConnector);
      const explicitRateConnector = /^\s*$/.test(afterCount)
        && /^(?:cada|por|every|each|per)$/.test(interval.conector);

      if (!markedAsThreshold && (describesEvents || describesRate || explicitRateConnector)) {
        const distance = Math.abs(interval.indice - (countMatch.index + countMatch[0].length));
        const score = (describesEvents ? 4 : 0)
          + (describesRate ? 3 : 0)
          + (hasRateConnector ? 1 : 0)
          - Math.min(distance / 120, 1);
        candidates.push({ interval, lambdaBase, score });
      }
    }

    const suffixStart = interval.fin;
    const suffixBoundaries = findSentenceBoundaries(normalizedText.slice(suffixStart));
    const sentenceEnd = suffixBoundaries[0];
    const suffixEnd = sentenceEnd !== undefined
      ? suffixStart + sentenceEnd
      : Math.min(normalizedText.length, suffixStart + 120);
    const suffix = normalizedText.slice(suffixStart, suffixEnd);
    const trailingNumbers = [...suffix.matchAll(new RegExp(NUMBER_PATTERN, 'g'))];
    for (const countMatch of trailingNumbers) {
      const lambdaBase = Number(countMatch[0].replace(',', '.'));
      const beforeCount = suffix.slice(0, countMatch.index);
      const afterCount = suffix.slice(countMatch.index + countMatch[0].length);
      const markedAsThreshold = THRESHOLD_PREFIX.test(beforeCount.trimEnd());
      const describesEvents = hasEventDescriptor(afterCount) || EVENT_TERMS.test(beforeCount);
      const describesRate = RATE_TERMS.test(beforeCount) || RATE_TERMS.test(afterCount);
      if (!markedAsThreshold && (describesEvents || describesRate)) {
        const distance = Math.abs(countMatch.index);
        const score = (describesEvents ? 4 : 0)
          + (describesRate ? 3 : 0)
          - Math.min(distance / 120, 1);
        candidates.push({ interval, lambdaBase, score });
      }
    }
  }

  const best = candidates.sort((left, right) => right.score - left.score)[0];
  if (!best) return null;
  return {
    lambdaBase: best.lambdaBase,
    intervaloBase: best.interval.intervalo,
    unidadBase: best.interval.unidad,
    dimensionBase: best.interval.dimension,
    valorBaseNormalizado: best.interval.valorNormalizado
  };
}

function extractQuestionInterval(questionText) {
  return extractPoissonIntervals(questionText)[0] || null;
}

function extractRelatedEventInterval(contextText) {
  const normalizedText = normalizePoissonText(contextText);
  const triggers = [...normalizedText.matchAll(/\b(?:alertas?|alarmas?|umbral|threshold)\b/g)];
  for (let index = triggers.length - 1; index >= 0; index -= 1) {
    const start = triggers[index].index;
    const endMatch = /[.!?;\n]/.exec(normalizedText.slice(start));
    const clause = normalizedText.slice(start, endMatch ? start + endMatch.index : start + 240);
    const interval = extractQuestionInterval(clause);
    if (interval) return interval;
  }
  return null;
}

function formatPoissonLambda(params) {
  const formatValue = (value) => Number(value.toPrecision(6)).toString();
  const singularUnits = {
    milisegundos: 'milisegundo',
    segundos: 'segundo',
    minutos: 'minuto',
    horas: 'hora',
    dias: 'dia',
    semanas: 'semana',
    meses: 'mes',
    'años': 'año',
    milimetros: 'milimetro',
    centimetros: 'centimetro',
    metros: 'metro',
    kilometros: 'kilometro',
    pulgadas: 'pulgada',
    pies: 'pie',
    yardas: 'yarda',
    millas: 'milla',
    paginas: 'pagina'
  };
  const formatInterval = (amount, unit) => `${formatValue(amount)} ${amount === 1 ? singularUnits[unit] || unit : unit}`;
  const base = `${formatValue(params.lambdaBase)} en ${formatInterval(params.intervaloBase, params.unidadBase)}`;
  const requested = formatInterval(params.intervaloPregunta, params.unidadPregunta);
  if (!params.ajusteAplicado) {
    return `λ = ${formatValue(params.lambdaAjustado)} (intervalo coincidente: ${base})`;
  }
  return `λ ajustado = ${formatValue(params.lambdaAjustado)} (regla de tres desde ${base} → ${requested}: ${formatValue(params.lambdaBase)} × (${formatValue(params.valorPreguntaNormalizado)} / ${formatValue(params.valorBaseNormalizado)}))`;
}

function setPoissonIntervalParams(params, lambdaBase, intervaloBase, unidadBase, intervaloPregunta, unidadPregunta) {
  const baseUnit = resolveUnit(unidadBase);
  const questionUnit = resolveUnit(unidadPregunta);
  const valorBaseNormalizado = intervaloBase * baseUnit.factor;
  const valorPreguntaNormalizado = intervaloPregunta * questionUnit.factor;
  if (baseUnit.dimension !== questionUnit.dimension) {
    throw new Error('Las unidades base y solicitada no son compatibles para ajustar λ.');
  }
  if (
    !Number.isFinite(lambdaBase)
    || lambdaBase < 0
    || !Number.isFinite(valorBaseNormalizado)
    || valorBaseNormalizado <= 0
    || !Number.isFinite(valorPreguntaNormalizado)
    || valorPreguntaNormalizado <= 0
  ) {
    throw new Error('La tasa de Poisson debe ser no negativa y los intervalos deben ser positivos.');
  }
  const ratio = valorPreguntaNormalizado / valorBaseNormalizado;
  const ajusteAplicado = Math.abs(ratio - 1) > 1e-12;
  const lambdaAjustado = ajusteAplicado ? lambdaBase * ratio : lambdaBase;
  if (!Number.isFinite(lambdaAjustado)) {
    throw new Error('El λ ajustado no es finito para los intervalos proporcionados.');
  }
  Object.assign(params, {
    lambdaBase,
    intervaloBase,
    unidadBase: baseUnit.canonical,
    dimensionBase: baseUnit.dimension,
    valorBaseNormalizado,
    lambdaAjustado,
    intervaloPregunta,
    unidadPregunta: questionUnit.canonical,
    dimensionPregunta: questionUnit.dimension,
    valorPreguntaNormalizado,
    ajusteAplicado
  });
  return lambdaAjustado;
}

function inferParamsByDistribution(
  distribution,
  text,
  questionText = text,
  contextText = text,
  inheritedPoissonInterval = null
) {
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
    const baseRate = extractPoissonBaseRate(text);
    if (!baseRate) {
      throw new Error('No se pudo identificar la tasa promedio y el intervalo base del problema de Poisson.');
    }

    const questionInterval = extractQuestionInterval(questionText);
    const relatedEventInterval = /\b(?:alerta|alarma|umbral|threshold)\b/i.test(questionText || '')
      ? extractRelatedEventInterval(contextText)
      : null;
    const requestedInterval = questionInterval
      || relatedEventInterval
      || inheritedPoissonInterval
      || {
        intervalo: baseRate.intervaloBase,
        unidad: baseRate.unidadBase,
        dimension: baseRate.dimensionBase,
        valorNormalizado: baseRate.valorBaseNormalizado
      };

    if (requestedInterval.dimension !== baseRate.dimensionBase) {
      throw new Error(
        `La unidad solicitada (${requestedInterval.unidad}) no es compatible con la unidad base (${baseRate.unidadBase}).`
      );
    }

    const ratio = requestedInterval.valorNormalizado / baseRate.valorBaseNormalizado;
    if (!Number.isFinite(ratio) || ratio <= 0) {
      throw new Error('No se pudo comparar el intervalo base con el intervalo solicitado.');
    }
    const ajusteAplicado = Math.abs(ratio - 1) > 1e-12;
    const lambdaAjustado = ajusteAplicado ? baseRate.lambdaBase * ratio : baseRate.lambdaBase;
    if (!Number.isFinite(lambdaAjustado)) {
      throw new Error('El λ ajustado no es finito para los intervalos proporcionados.');
    }
    const isZeroEvent = /ningun[oa]?|cero|zero|none|no\s+(?:se\s+)?(?:reciba|llegue|lleguen)|no\s+(?:requests?|events?)\s+(?:arrive|occur)/i.test(questionText || '');
    const questionTarget = findQuestionTargetByKeyword(questionText, null);
    const contextTarget = findQuestionTargetByKeyword(normalizedText, null);
    const x = isZeroEvent ? 0 : questionTarget ?? contextTarget ?? 8;
    return {
      lambda: lambdaAjustado,
      lambdaBase: baseRate.lambdaBase,
      intervaloBase: baseRate.intervaloBase,
      unidadBase: baseRate.unidadBase,
      dimensionBase: baseRate.dimensionBase,
      valorBaseNormalizado: baseRate.valorBaseNormalizado,
      lambdaAjustado,
      intervaloPregunta: requestedInterval.intervalo,
      unidadPregunta: requestedInterval.unidad,
      dimensionPregunta: requestedInterval.dimension,
      valorPreguntaNormalizado: requestedInterval.valorNormalizado,
      ajusteAplicado,
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
  const analysis = keywordModel.analyze(inputText || '');
  const baseRate = extractPoissonBaseRate(inputText);
  if (baseRate && !['binomial', 'negativeBinomial'].includes(analysis.distribution)) {
    return {
      ...analysis,
      distribution: 'poisson',
      label: 'Poisson',
      confidence: 0.75,
      explanation: 'Se detectó una tasa promedio de ocurrencias en un intervalo.',
      keywords: []
    };
  }
  return analysis;
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
    const lambdaConversion = formatPoissonLambda(params);
    const asksForMean = /promedio|valor esperado|cantidad esperada|media de|expected value|average|mean|λ|lambda/.test(normalizedQuestion);
    const asksForZero = /ningun[oa]?|cero|zero|none|no\s+(?:se\s+)?(?:reciba|llegue|lleguen)|no\s+(?:requests?|events?)\s+(?:arrive|occur)/.test(normalizedQuestion);
    const asksForAlert = /\b(?:alerta|alarma|umbral|threshold)\b/.test(normalizedQuestion);
    const eventTypeForText = (text) => {
      const normalized = normalizePoissonText(text);
      if (/(?:<=|≤|como maximo|a lo sumo|no supere|no mas de|a lo mas|at most|no more than)/.test(normalized)) return 'lessOrEqual';
      if (/(?:<(?!=)|menos de|inferior a|menor que|less than)/.test(normalized)) return 'less';
      if (/(?:>=|≥|al menos|por lo menos|como minimo|mayor o igual|at least)/.test(normalized)) return 'greaterOrEqual';
      if (/(?:>|mas de|supera|mayor que|excede|por encima de|more than|greater than)/.test(normalized)) return 'greater';
      return null;
    };
    const eventType = eventTypeForText(questionText)
      || (asksForAlert ? eventTypeForText(contextText) : null);

    if (asksForMean) {
      operation = 'E[X]';
      formula = `${lambdaConversion}; E[X] = ${lambdaText} ocurrencias`;
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
      formula = `${lambdaConversion}; P(X > ${x}) = 1 - P(X <= ${x})`;
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
  const analysis = analyzeText(statementText || baseText);
  const distribution = analysis.distribution;

  if (!distribution) {
    return {
      ok: false,
      analysis,
      message: 'No se pudo identificar una distribución estadística con suficiente confianza. Intenta describir el problema con más detalle.',
      result: null
    };
  }

  const baseStatement = statementText || baseText;
  const firstQuestion = questionList[0] || statement;
  const firstQuestionContext = [baseStatement, firstQuestion].filter(Boolean).join(' ');
  const params = inferParamsByDistribution(
    distribution,
    baseStatement,
    firstQuestion,
    firstQuestionContext
  );

  if (questionList.length > 1) {
    let inheritedPoissonInterval = null;
    const answers = questionList.map((questionText, index) => {
      const questionContext = [baseStatement, questionText].filter(Boolean).join(' ');
      const questionParams = inferParamsByDistribution(
        distribution,
        baseStatement,
        questionText,
        questionContext,
        inheritedPoissonInterval
      );
      if (distribution === 'poisson') {
        inheritedPoissonInterval = {
          intervalo: questionParams.intervaloPregunta,
          unidad: questionParams.unidadPregunta,
          dimension: questionParams.dimensionPregunta,
          valorNormalizado: questionParams.valorPreguntaNormalizado
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
  const computed = computeDistributionResult(distribution, params, questionText, firstQuestionContext);
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
        formula = `${lambdaFormula}; E[X] = ${lambdaText} ocurrencias`;
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
      const intervaloSegundos = operationKey === 'zero_30s'
        ? parseNumeric(params.alternativeIntervalSeconds ?? 30, 30)
        : parseNumeric(params.intervalMinutes ?? 1, 1) * 60;
      const unidadPregunta = intervaloSegundos < 60 ? 'segundos' : 'minutos';
      const intervaloPregunta = intervaloSegundos < 60
        ? intervaloSegundos
        : intervaloSegundos / 60;
      const lambda = setPoissonIntervalParams(
        params,
        ratePer3,
        3,
        'minutos',
        intervaloPregunta,
        unidadPregunta
      );
      const lambdaText = Number(lambda.toPrecision(6)).toString();
      const lambdaFormula = formatPoissonLambda(params);
      if (operationKey === 'mean_1min') {
        result = lambda;
        formula = `${lambdaFormula}; E[X] = ${lambdaText} ocurrencias`;
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
  const calculationFormula = formula || selectedOperation.formula;
  const interpretation = buildInterpretation({
    text: exercise.enunciado,
    distribution: exercise.distribution,
    operation: selectedOperation.label,
    formula: calculationFormula,
    result: numericResult,
    params
  });

  return {
    exerciseId: exercise.id,
    title: exercise.title,
    operationKey,
    result: numericResult,
    formula: calculationFormula,
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
