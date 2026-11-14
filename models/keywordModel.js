const normalizeText = (text = '') => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const distributionPatterns = {
  binomial: {
    label: 'Binomial',
    keywords: ['probabilidad constante', 'ensayos independientes', 'numero fijo', 'intentos', 'fallas', 'vulnerabilidad', 'seleccionan aleatoriamente', 'cada componente', 'cada prueba', 'cada servidor', 'probabilidad de exito', 'probabilidad de fallar', 'se supone que'],
    phrases: ['probabilidad constante', 'ensayos independientes', 'cada componente tiene una probabilidad', 'cada prueba tiene una probabilidad']
  },
  negativeBinomial: {
    label: 'Binomial negativa',
    keywords: ['quinta retransmision', 'sexto exito', 'hasta alcanzar', 'numero de intentos necesarios', 'intento numero', 'retransmision exitosa', 'pruebas satisfactorias', 'alcanza', 'exito numero', 'necesita obtener', 'numero de pruebas satisfactorias'],
    phrases: ['retransmision exitosa', 'pruebas satisfactorias', 'necesita obtener', 'hasta alcanzar']
  },
  poisson: {
    label: 'Poisson',
    keywords: ['en promedio', 'cada minuto', 'cada hora', 'durante un intervalo', 'cantidad de llegadas', 'numero de solicitudes', 'frecuencia de eventos', 'tasa promedio', 'alertas', 'solicitudes', 'llegadas', 'eventos ocurren independientemente', 'solicitudes llegan independientemente'],
    phrases: ['en promedio', 'durante un intervalo', 'tasa promedio constante', 'solicitudes llegan independientemente']
  },
  exponential: {
    label: 'Exponencial',
    keywords: ['tiempo de espera', 'tiempo hasta el siguiente evento', 'antes de determinado tiempo', 'mas de cierto tiempo', 'intervalo entre llegadas', 'siguiente mensaje', 'espera', 'segundos', 'tiempo hasta'],
    phrases: ['tiempo de espera', 'siguiente mensaje', 'tiempo hasta el siguiente evento']
  },
  normal: {
    label: 'Normal',
    keywords: ['distribucion normal', 'media', 'desviacion estandar', 'tiempo promedio', 'menor que', 'mayor que', 'entre dos valores', 'percentil', 'ms', 'milisegundos', 'respuesta', 'promedio', 'desviacion', 'estandar'],
    phrases: ['distribucion normal', 'percentil', 'media', 'desviacion estandar']
  }
};

class KeywordModel {
  analyze(text) {
    const normalized = normalizeText(text);
    const scores = {};
    const hits = {};

    Object.entries(distributionPatterns).forEach(([key, config]) => {
      const foundKeywords = config.keywords.filter((keyword) => normalized.includes(keyword));
      const foundPhrases = config.phrases.filter((phrase) => normalized.includes(phrase));
      const score = foundKeywords.length + foundPhrases.length * 2;
      scores[key] = score;
      hits[key] = { keywords: foundKeywords, phrases: foundPhrases };
    });

    const ranked = Object.entries(scores)
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1]);

    const first = ranked[0];
    const second = ranked[1];

    if (!first) {
      return {
        distribution: null,
        confidence: 0,
        ambiguous: true,
        explanation: 'No se detectaron patrones estadísticos suficientes para asignar una distribución con confianza.',
        keywords: [],
        hits: {}
      };
    }

    const distribution = first[0];
    const scoreDifference = (first[1] || 0) - (second ? second[1] : 0);
    const confidence = Math.min(0.98, Math.max(0.36, 0.45 + (first[1] / 8) * 0.45 - (scoreDifference < 2 ? 0.2 : 0)));

    return {
      distribution,
      label: distributionPatterns[distribution].label,
      confidence: Number(confidence.toFixed(2)),
      ambiguous: scoreDifference < 2,
      explanation: scoreDifference < 2
        ? 'El texto presenta señales de más de una distribución; se recomienda validar el contexto antes de clasificarlo como definitivo.'
        : `Se detectó una mayor coincidencia con la distribución ${distributionPatterns[distribution].label} a partir de palabras clave y expresiones contextuales.`,
      keywords: hits[distribution].keywords,
      hits,
      normalizedText: normalized,
      patterns: distributionPatterns
    };
  }
}

module.exports = KeywordModel;
