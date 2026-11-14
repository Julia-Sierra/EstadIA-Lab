function factorial(value) {
  if (value < 0) return 0;
  let result = 1;
  for (let i = 2; i <= value; i += 1) {
    result *= i;
  }
  return result;
}

function combination(n, k) {
  if (k < 0 || k > n) return 0;
  const minK = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= minK; i += 1) {
    result = (result * (n - minK + i)) / i;
  }
  return result;
}

function clampProbability(value) {
  return Math.max(0, Math.min(1, value));
}

function binomialExact(n, p, x) {
  if (!Number.isFinite(n) || !Number.isFinite(p) || !Number.isFinite(x)) {
    throw new Error('Parámetros inválidos para distribución binomial.');
  }
  if (x < 0 || x > n) return 0;
  return combination(n, x) * Math.pow(p, x) * Math.pow(1 - p, n - x);
}

function binomialCdf(n, p, x) {
  let total = 0;
  for (let i = 0; i <= x; i += 1) {
    total += binomialExact(n, p, i);
  }
  return clampProbability(total);
}

function binomialSurvival(n, p, x) {
  return clampProbability(1 - binomialCdf(n, p, x));
}

function negativeBinomialP(k, r, p) {
  if (k < r) return 0;
  return combination(k - 1, r - 1) * Math.pow(p, r) * Math.pow(1 - p, k - r);
}

function negativeBinomialCdf(kMax, r, p) {
  let total = 0;
  for (let k = r; k <= kMax; k += 1) {
    total += negativeBinomialP(k, r, p);
  }
  return clampProbability(total);
}

function poissonProbability(lambda, x) {
  if (lambda < 0 || !Number.isFinite(lambda)) throw new Error('La tasa de Poisson debe ser válida.');
  if (!Number.isInteger(x) || x < 0) return 0;
  return Math.exp(-lambda) * Math.pow(lambda, x) / factorial(x);
}

function poissonCdf(lambda, x) {
  let total = 0;
  for (let i = 0; i <= x; i += 1) {
    total += poissonProbability(lambda, i);
  }
  return clampProbability(total);
}

function poissonSurvival(lambda, x) {
  return clampProbability(1 - poissonCdf(lambda, x));
}

function exponentialCdf(lambda, t) {
  if (lambda <= 0) return 0;
  return clampProbability(1 - Math.exp(-lambda * t));
}

function exponentialSurvival(lambda, t) {
  return clampProbability(Math.exp(-lambda * t));
}

function exponentialBetween(lambda, a, b) {
  if (b < a) [a, b] = [b, a];
  return clampProbability(exponentialCdf(lambda, b) - exponentialCdf(lambda, a));
}

function exponentialPercentile(lambda, probability) {
  if (lambda <= 0) return 0;
  return -Math.log(1 - clampProbability(probability)) / lambda;
}

function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * absX);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX));
  return sign * y;
}

function normalCdf(x, mean, sd) {
  const z = (x - mean) / sd;
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

function normalBetween(mean, sd, a, b) {
  if (b < a) [a, b] = [b, a];
  return clampProbability(normalCdf(b, mean, sd) - normalCdf(a, mean, sd));
}

function inverseStandardNormal(p) {
  if (p <= 0 || p >= 1) return 0;
  const a = [
    -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
    1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00
  ];
  const b = [
    -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
    6.680131188771972e+01, -1.328068155288572e+01
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
    -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00
  ];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];

  const plow = 0.02425;
  const phigh = 1 - plow;

  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  if (p > phigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  const q = p - 0.5;
  return (((((a[0] * q + a[1]) * q + a[2]) * q + a[3]) * q + a[4]) * q + a[5]) /
    (((((b[0] * q + b[1]) * q + b[2]) * q + b[3]) * q + b[4]) * q + 1);
}

function normalPercentile(probability, mean, sd) {
  return mean + inverseStandardNormal(probability) * sd;
}

module.exports = {
  binomialExact,
  binomialCdf,
  binomialSurvival,
  negativeBinomialP,
  negativeBinomialCdf,
  poissonProbability,
  poissonCdf,
  poissonSurvival,
  exponentialCdf,
  exponentialSurvival,
  exponentialBetween,
  exponentialPercentile,
  normalCdf,
  normalBetween,
  normalPercentile,
  inverseStandardNormal
};
