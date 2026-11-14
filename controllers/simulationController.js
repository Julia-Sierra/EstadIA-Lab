const { getExerciseById } = require('../models/exerciseModel');
const {
  binomialExact,
  poissonProbability,
  negativeBinomialP,
  exponentialCdf,
  normalCdf
} = require('../models/distributionModels');

function randomBinomial(n, p) {
  let successes = 0;
  for (let i = 0; i < n; i += 1) {
    if (Math.random() < p) successes += 1;
  }
  return successes;
}

function randomPoisson(lambda) {
  let x = 0;
  let p = Math.exp(-lambda);
  let u = Math.random();
  while (u > p) {
    u -= p;
    x += 1;
    p *= lambda / x;
  }
  return x;
}

function randomExponential(lambda) {
  return -Math.log(1 - Math.random()) / lambda;
}

function randomNormal(mean, sd) {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function runSimulation(req, res) {
  try {
    const { exerciseId, operationKey, params = {}, trials = 5000 } = req.body;
    const exercise = getExerciseById(exerciseId);
    if (!exercise) {
      return res.status(404).json({ ok: false, message: 'Ejercicio no encontrado.' });
    }

    const safeTrials = Math.max(100, Number(trials) || 5000);
    const settledParams = { ...exercise.params, ...params };
    let theoretical = 0;
    let observed = 0;
    const labels = [];
    const counts = {};

    if (exercise.distribution === 'binomial') {
      const n = Number(settledParams.n ?? 10);
      const p = Number(settledParams.p ?? 0.5);
      theoretical = exercise.id === 1 ? binomialExact(n, p, 3) : (exercise.id === 4 ? 1 - (binomialExact(n, p, 0) + binomialExact(n, p, 1) + binomialExact(n, p, 2) + binomialExact(n, p, 3)) : binomialExact(n, p, 0));
      for (let i = 0; i < safeTrials; i += 1) {
        const x = randomBinomial(n, p);
        labels.push(x);
        counts[x] = (counts[x] || 0) + 1;
        if (exercise.id === 1 && x === 3) observed += 1;
        if (exercise.id === 4 && x <= 3) observed += 1;
      }
      observed = observed / safeTrials;
    }

    if (exercise.distribution === 'poisson') {
      const lambda = exercise.id === 3 ? (9 * (Number(settledParams.intervalMinutes ?? 20) / 15)) : (Number(settledParams.ratePer3Min ?? 18) / 3);
      theoretical = exercise.id === 3 ? 1 - (poissonProbability(lambda, 0) + poissonProbability(lambda, 1) + poissonProbability(lambda, 2) + poissonProbability(lambda, 3) + poissonProbability(lambda, 4) + poissonProbability(lambda, 5) + poissonProbability(lambda, 6) + poissonProbability(lambda, 7) + poissonProbability(lambda, 8) + poissonProbability(lambda, 9) + poissonProbability(lambda, 10) + poissonProbability(lambda, 11) + poissonProbability(lambda, 12) + poissonProbability(lambda, 13) + poissonProbability(lambda, 14) + poissonProbability(lambda, 15)) : poissonProbability(lambda, 8);
      for (let i = 0; i < safeTrials; i += 1) {
        const x = randomPoisson(lambda);
        labels.push(x);
        counts[x] = (counts[x] || 0) + 1;
        if (exercise.id === 5 && x === 8) observed += 1;
      }
      observed = observed / safeTrials;
    }

    if (exercise.distribution === 'negativeBinomial') {
      const r = Number(settledParams.r ?? 5);
      const p = Number(settledParams.p ?? 0.75);
      theoretical = negativeBinomialP(Number(settledParams.x ?? 7), r, p);
      for (let i = 0; i < safeTrials; i += 1) {
        let successes = 0;
        let attempts = 0;
        while (successes < r) {
          attempts += 1;
          if (Math.random() < p) successes += 1;
        }
        labels.push(attempts);
        counts[attempts] = (counts[attempts] || 0) + 1;
        if (attempts === 7) observed += 1;
      }
      observed = observed / safeTrials;
    }

    if (exercise.distribution === 'exponential') {
      const lambda = Number(settledParams.lambdaPerSecond ?? 0.2);
      theoretical = exponentialCdf(lambda, 4);
      for (let i = 0; i < safeTrials; i += 1) {
        const sample = randomExponential(lambda);
        labels.push(sample);
        counts[Math.round(sample)] = (counts[Math.round(sample)] || 0) + 1;
        if (sample < 4) observed += 1;
      }
      observed = observed / safeTrials;
    }

    if (exercise.distribution === 'normal') {
      const mean = Number(settledParams.mean ?? 240);
      const sd = Number(settledParams.sd ?? 35);
      theoretical = normalCdf(300, mean, sd);
      for (let i = 0; i < safeTrials; i += 1) {
        const sample = randomNormal(mean, sd);
        labels.push(sample);
        counts[Math.round(sample)] = (counts[Math.round(sample)] || 0) + 1;
        if (sample > 300) observed += 1;
      }
      observed = observed / safeTrials;
    }

    const histogram = Object.entries(counts)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([key, value]) => ({ key: Number(key), value }));

    return res.json({
      ok: true,
      exerciseId: exercise.id,
      distribution: exercise.distribution,
      theoretical: Number(theoretical.toFixed(6)),
      experimental: Number(observed.toFixed(6)),
      trials: safeTrials,
      histogram
    });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message || 'No se pudo ejecutar la simulación.' });
  }
}

module.exports = {
  runSimulation
};
