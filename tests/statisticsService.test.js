const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getExerciseById } = require('../models/exerciseModel');
const { binomialExact } = require('../models/distributionModels');
const { solveProblem } = require('../services/statisticsService');

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
