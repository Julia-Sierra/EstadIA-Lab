const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getExerciseById } = require('../models/exerciseModel');
const { binomialExact, binomialCdf, poissonCdf, poissonProbability } = require('../models/distributionModels');
const { calculateExercise, solveProblem } = require('../services/statisticsService');

const statement = getExerciseById(4).enunciado;

function sumAtLeast(minimum, n = 20, p = 0.08) {
  let total = 0;
  for (let successes = minimum; successes <= n; successes += 1) {
    total += binomialExact(n, p, successes);
  }
  return total;
}

test('binomial "al menos" uses the target in the question, not the statement threshold', () => {
  const solution = solveProblem({
    statement,
    questions: ['Determine la probabilidad de que fallen al menos 5 servidores.']
  });

  assert.equal(solution.distribution, 'binomial');
  assert.deepEqual(solution.params, { n: 20, p: 0.08, x: 5 });
  assert.equal(solution.operation, 'P(X >= 5)');
  assert.equal(solution.formula, 'P(X >= 5) = 1 - P(X <= 4)');
  assert.ok(Math.abs(solution.result - sumAtLeast(5)) < 1e-10);
});

test('"al menos 5" and "más de 5" produce distinct binomial events', () => {
  const solution = solveProblem({
    statement,
    questions: [
      'Determine la probabilidad de que fallen al menos 5 servidores.',
      'Determine la probabilidad de que fallen más de 5 servidores.'
    ]
  });

  assert.equal(solution.answers[0].formula, 'P(X >= 5) = 1 - P(X <= 4)');
  assert.ok(Math.abs(solution.answers[0].result - sumAtLeast(5)) < 1e-10);
  assert.equal(solution.answers[1].operation, 'P(X > 5)');
  assert.equal(solution.answers[1].formula, 'P(X > 5) = 1 - P(X <= 5)');
  assert.ok(Math.abs(solution.answers[1].result - sumAtLeast(6)) < 1e-10);
});

test('binomial handles x-or-more questions and applies the statement policy threshold', () => {
  const binomialStatement = 'Se seleccionan 18 componentes. Cada uno tiene 12 % de probabilidad de presentar una vulnerabilidad crítica. Si se detectan 4 o más componentes vulnerables, se suspende la liberación.';
  const solution = solveProblem({
    statement: binomialStatement,
    questions: [
      'Determine la probabilidad de encontrar exactamente 3 componentes con vulnerabilidades críticas.',
      'Calcule la probabilidad de que se encuentren como máximo 2 componentes vulnerables.',
      'Determine la probabilidad de que se active la política de suspensión del lanzamiento.',
      'Calcule la probabilidad de que al menos 1 componente presente una vulnerabilidad crítica.'
    ]
  });

  assert.equal(solution.answers[0].result, Number(binomialExact(18, 0.12, 3).toFixed(10)));
  assert.equal(solution.answers[1].result, Number(binomialCdf(18, 0.12, 2).toFixed(10)));
  assert.equal(solution.answers[2].params.x, 4);
  assert.equal(solution.answers[2].operation, 'P(X >= 4)');
  assert.equal(solution.answers[2].formula, 'P(X >= 4) = 1 - P(X <= 3)');
  assert.equal(solution.answers[2].result, Number((1 - binomialCdf(18, 0.12, 3)).toFixed(10)));
  assert.equal(solution.answers[3].operation, 'P(X >= 1)');
  assert.equal(solution.answers[3].formula, 'P(X >= 1) = 1 - P(X <= 0)');
  assert.equal(solution.answers[3].result, Number((1 - binomialCdf(18, 0.12, 0)).toFixed(10)));

  const explicitAtLeast = solveProblem({
    statement: binomialStatement,
    questions: ['Calcule la probabilidad de encontrar 4 o más componentes vulnerables.']
  });
  assert.equal(explicitAtLeast.operation, 'P(X >= 4)');
  assert.equal(explicitAtLeast.result, Number((1 - binomialCdf(18, 0.12, 3)).toFixed(10)));
});

test('Poisson questions recalculate lambda for each requested interval', () => {
  const poissonStatement = getExerciseById(5).enunciado;
  const solution = solveProblem({
    statement: poissonStatement,
    questions: [
      'Determine la cantidad promedio de solicitudes esperadas durante un minuto.',
      'Calcule la probabilidad de que exactamente 8 solicitudes lleguen durante un minuto.',
      'Determine la probabilidad de que el sistema active la alerta en un minuto.',
      'Calcule la probabilidad de que durante un intervalo de 30 segundos no se reciba ninguna solicitud.'
    ]
  });

  assert.equal(solution.distribution, 'poisson');
  assert.equal(solution.answers.length, 4);

  const [mean, exact, alert, noRequests] = solution.answers;
  assert.equal(mean.operation, 'E[X]');
  assert.equal(mean.result, 6);
  assert.equal(mean.percentage, null);
  assert.equal(mean.params.lambdaBase, 18);
  assert.equal(mean.params.lambdaAjustado, 6);
  assert.match(mean.formula, /regla de tres desde 18 en 3 minutos → 1 minuto/);

  assert.equal(exact.operation, 'P(X = 8)');
  assert.ok(Math.abs(exact.result - poissonProbability(6, 8)) < 1e-10);
  assert.match(exact.formula, /regla de tres desde 18 en 3 minutos → 1 minuto/);

  assert.equal(alert.operation, 'P(X > 10)');
  assert.ok(Math.abs(alert.result - (1 - poissonCdf(6, 10))) < 1e-10);
  assert.match(alert.formula, /regla de tres desde 18 en 3 minutos → 1 minuto/);

  assert.equal(noRequests.operation, 'P(X = 0)');
  assert.ok(Math.abs(noRequests.result - poissonProbability(3, 0)) < 1e-10);
  assert.equal(noRequests.params.lambdaAjustado, 3);
  assert.match(noRequests.formula, /regla de tres desde 18 en 3 minutos → 30 segundos/);
});

test('Poisson scales rates across non-time units and fractional intervals', () => {
  const distanceBased = solveProblem({
    statement: 'A process records an average of 4 occurrences every 500 meters.',
    questions: ['Find the probability of exactly 3 occurrences over 2 kilometers.']
  });
  assert.equal(distanceBased.distribution, 'poisson');
  assert.equal(distanceBased.params.lambdaAjustado, 16);
  assert.equal(distanceBased.params.unidadBase, 'metros');
  assert.equal(distanceBased.params.unidadPregunta, 'kilometros');

  const fractionalTime = solveProblem({
    statement: 'En promedio, ocurren 2.5 incidentes por hora.',
    questions: ['Calcule la probabilidad de exactamente 1 incidente durante un cuarto de hora.']
  });
  assert.equal(fractionalTime.params.lambdaBase, 2.5);
  assert.equal(fractionalTime.params.lambdaAjustado, 0.625);
  assert.equal(fractionalTime.params.intervaloPregunta, 0.25);

  const reversedStatement = solveProblem({
    statement: 'En un intervalo de tiempo de 2 horas se registran 10 incidentes en promedio.',
    questions: ['Calcule la probabilidad de exactamente 1 incidente durante media hora.']
  });
  assert.equal(reversedStatement.params.lambdaBase, 10);
  assert.equal(reversedStatement.params.lambdaAjustado, 2.5);

  const pageBased = solveProblem({
    statement: 'Se observan 3 ocurrencias por cada 500 páginas.',
    questions: ['Calcule la probabilidad de exactamente 2 ocurrencias en 1000 páginas.']
  });
  assert.equal(pageBased.params.lambdaAjustado, 6);

  const calendarUnits = solveProblem({
    statement: 'Un proceso registra 12 eventos cada 2 meses.',
    questions: ['Determine la probabilidad de exactamente 5 eventos durante un año.']
  });
  assert.equal(calendarUnits.params.lambdaAjustado, 73);

  const weeklyRate = solveProblem({
    statement: 'A process records 4 occurrences per week.',
    questions: ['Find the probability of exactly 1 occurrence in 2 days.']
  });
  assert.ok(Math.abs(weeklyRate.params.lambdaAjustado - (8 / 7)) < 1e-12);
});

test('Poisson inherits a compatible interval and rejects incompatible units', () => {
  const inherited = solveProblem({
    statement: 'El servicio registra 18 solicitudes cada 3 minutos.',
    questions: [
      'Calcule la probabilidad de exactamente 8 solicitudes durante 30 segundos.',
      'Calcule la probabilidad de no recibir solicitudes.'
    ]
  });
  assert.equal(inherited.answers[1].params.lambdaAjustado, 3);

  assert.throws(() => solveProblem({
    statement: 'El servicio registra 18 solicitudes cada 3 minutos.',
    questions: ['Calcule la probabilidad de exactamente 8 solicitudes durante 500 metros.']
  }), /no es compatible/);
});

test('Poisson uses the interval attached to a referenced alert when the question omits it', () => {
  const solution = solveProblem({
    statement: 'El servicio registra 18 solicitudes cada 3 minutos. Se activa una alerta al recibir más de 10 solicitudes en un minuto.',
    questions: ['Determine la probabilidad de que se active la alerta.']
  });
  assert.equal(solution.params.lambdaAjustado, 6);
  assert.equal(solution.operation, 'P(X > 10)');
  assert.ok(Math.abs(solution.result - (1 - poissonCdf(6, 10))) < 1e-10);
});

test('Poisson does not divide by zero or substitute a default rate when base data is missing', () => {
  assert.throws(() => solveProblem({
    statement: 'Las solicitudes llegan independientemente.',
    questions: ['Calcule la probabilidad de exactamente 2 solicitudes.']
  }), /tasa promedio y el intervalo base/);

  assert.throws(() => solveProblem({
    statement: 'El servicio recibe 18 solicitudes cada 0 minutos.',
    questions: ['Calcule la probabilidad de exactamente 2 solicitudes durante un minuto.']
  }), /tasa promedio y el intervalo base/);
});

test('Poisson supports strict and inclusive probability tails', () => {
  const solution = solveProblem({
    statement: 'El sistema recibe 18 solicitudes cada 3 minutos.',
    questions: [
      'Calcule P(X < 8) durante un minuto.',
      'Calcule P(X <= 8) durante un minuto.',
      'Calcule P(X >= 8) durante un minuto.',
      'Calcule P(X > 8) durante un minuto.'
    ]
  });
  const [less, lessOrEqual, greaterOrEqual, greater] = solution.answers;
  assert.equal(less.operation, 'P(X < 8)');
  assert.ok(Math.abs(less.result - poissonCdf(6, 7)) < 1e-10);
  assert.equal(lessOrEqual.operation, 'P(X <= 8)');
  assert.ok(Math.abs(lessOrEqual.result - poissonCdf(6, 8)) < 1e-10);
  assert.equal(greaterOrEqual.operation, 'P(X >= 8)');
  assert.ok(Math.abs(greaterOrEqual.result - (1 - poissonCdf(6, 7))) < 1e-10);
  assert.equal(greater.operation, 'P(X > 8)');
  assert.ok(Math.abs(greater.result - (1 - poissonCdf(6, 8))) < 1e-10);
});

test('built-in API saturation exercise calculates each Poisson event with the converted lambda', () => {
  const mean = calculateExercise(5, 'mean_1min');
  const exact = calculateExercise(5, 'exacta_8');
  const alert = calculateExercise(5, 'alerta_1min');
  const zero = calculateExercise(5, 'zero_30s');
  assert.equal(mean.result, 6);
  assert.equal(mean.percentage, null);
  assert.equal(mean.params.lambdaAjustado, 6);
  assert.match(mean.formula, /λ ajustado = 6/);
  assert.ok(Math.abs(exact.result - poissonProbability(6, 8)) < 1e-10);
  assert.ok(Math.abs(alert.result - (1 - poissonCdf(6, 10))) < 1e-10);
  assert.ok(Math.abs(zero.result - poissonProbability(3, 0)) < 1e-10);
  assert.equal(zero.params.lambdaAjustado, 3);
  assert.match(zero.formula, /λ ajustado = 3/);
});
