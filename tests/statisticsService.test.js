const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getExerciseById } = require('../models/exerciseModel');
const { binomialExact, poissonCdf, poissonProbability } = require('../models/distributionModels');
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
  assert.match(mean.formula, /λ ajustado = 18 × \(60 \/ 180\) = 6 para 1 minuto/);

  assert.equal(exact.operation, 'P(X = 8)');
  assert.ok(Math.abs(exact.result - poissonProbability(6, 8)) < 1e-10);
  assert.ok(Math.abs(exact.result - 0.1032577335) < 1e-10);
  assert.match(exact.formula, /λ ajustado = 18 × \(60 \/ 180\) = 6 para 1 minuto/);

  assert.equal(alert.operation, 'P(X > 10)');
  assert.ok(Math.abs(alert.result - (1 - poissonCdf(6, 10))) < 1e-10);
  assert.ok(Math.abs(alert.result - 0.0426209236) < 1e-10);
  assert.match(alert.formula, /λ ajustado = 18 × \(60 \/ 180\) = 6 para 1 minuto/);

  assert.equal(noRequests.operation, 'P(X = 0)');
  assert.ok(Math.abs(noRequests.result - poissonProbability(3, 0)) < 1e-10);
  assert.ok(Math.abs(noRequests.result - 0.0497870684) < 1e-10);
  assert.match(noRequests.formula, /λ ajustado = 18 × \(30 \/ 180\) = 3 para 30 segundos/);
  assert.equal(noRequests.params.lambdaAjustado, 3);
});

test('Poisson parsing inherits base duration and converts other time units', () => {
  const inherited = solveProblem({
    statement: 'El servicio recibe 18 solicitudes cada 3 minutos.',
    questions: ['Calcule la probabilidad de exactamente 8 solicitudes.']
  });
  assert.equal(inherited.params.lambdaBase, 18);
  assert.equal(inherited.params.lambdaAjustado, 18);
  assert.equal(inherited.params.intervaloPregunta, 3);
  assert.equal(inherited.params.unidadPregunta, 'minutos');

  const converted = solveProblem({
    statement: 'El sistema recibe 12 solicitudes cada 2 horas.',
    questions: ['Calcule la probabilidad de exactamente 2 solicitudes durante un día.']
  });
  assert.equal(converted.params.lambdaBase, 12);
  assert.equal(converted.params.lambdaAjustado, 144);
  assert.equal(converted.params.tiempoBaseSegundos, 7200);
  assert.equal(converted.params.tiempoPreguntaSegundos, 86400);
});

test('Poisson follows the previous interval and the alert-window interval when omitted', () => {
  const solution = solveProblem({
    statement: 'El servicio recibe 18 solicitudes cada 3 minutos. Genera una alerta cuando recibe más de 10 solicitudes en un minuto.',
    questions: [
      'Calcule la probabilidad de exactamente 8 solicitudes durante 30 segundos.',
      'Calcule la probabilidad de no recibir solicitudes.'
    ]
  });
  assert.equal(solution.answers[0].params.lambdaAjustado, 3);
  assert.equal(solution.answers[1].params.lambdaAjustado, 3);

  const alert = solveProblem({
    statement: 'El sistema recibe 18 solicitudes cada 3 minutos y genera una alerta cuando recibe más de 10 solicitudes en un minuto.',
    questions: ['Determine la probabilidad de que el sistema active la alerta.']
  });
  assert.equal(alert.params.lambdaAjustado, 6);
  assert.equal(alert.operation, 'P(X > 10)');
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
  const mean = calculateExercise(3, 'mean_20');
  const shortWindow = calculateExercise(3, 'max_3_5min');
  assert.equal(mean.result, 12);
  assert.equal(mean.params.lambdaAjustado, 12);
  assert.ok(Math.abs(shortWindow.result - poissonCdf(3, 3)) < 1e-10);

  assert.equal(calculateExercise(5, 'mean_1min').result, 6);
  assert.equal(calculateExercise(5, 'mean_1min').percentage, null);
  const exact = calculateExercise(5, 'exacta_8');
  const alert = calculateExercise(5, 'alerta_1min');
  const zero = calculateExercise(5, 'zero_30s');
  assert.ok(Math.abs(exact.result - poissonProbability(6, 8)) < 1e-10);
  assert.ok(Math.abs(alert.result - (1 - poissonCdf(6, 10))) < 1e-10);
  assert.ok(Math.abs(zero.result - poissonProbability(3, 0)) < 1e-10);
  assert.equal(exact.params.lambdaAjustado, 6);
  assert.equal(zero.params.lambdaAjustado, 3);
  assert.match(zero.formula, /λ ajustado = 18 × \(30 \/ 180\) = 3 para 30 segundos/);
});
