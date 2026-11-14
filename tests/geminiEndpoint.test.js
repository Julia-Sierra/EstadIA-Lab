const assert = require('node:assert/strict');
const { test } = require('node:test');
const geminiHandler = require('../api/gemini');

test('Gemini endpoint allows the GitHub Pages preflight request', async () => {
  const headers = {};
  const response = {
    statusCode: null,
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    }
  };

  await geminiHandler({
    method: 'OPTIONS',
    headers: { origin: 'https://julia-sierra.github.io' }
  }, response);

  assert.equal(response.statusCode, 204);
  assert.equal(response.ended, true);
  assert.equal(headers['access-control-allow-origin'], 'https://julia-sierra.github.io');
  assert.equal(headers['access-control-allow-methods'], 'POST,OPTIONS');
});

test('Gemini endpoint passes Poisson interval parameters to the explanation prompt', async (context) => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  context.after(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
  });

  process.env.GEMINI_API_KEY = 'test-secret';
  let requestBody;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        steps: [{ type: 'model_output', content: [{ type: 'text', text: 'El valor esperado es 6.' }] }]
      })
    };
  };

  const response = {
    statusCode: null,
    body: null,
    setHeader() {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };

  await geminiHandler({
    method: 'POST',
    headers: {},
    body: {
      question: '¿Cuál es el valor esperado?',
      enunciado: 'Se producen 18 eventos cada 3 minutos.',
      distribution: 'Poisson',
      params: { lambdaBase: 18, intervaloBase: 3, unidadBase: 'minutos', lambdaAjustado: 6 },
      answers: [{
        question: 'En un minuto',
        params: { lambdaBase: 18, lambdaAjustado: 6, intervaloPregunta: 1, unidadPregunta: 'minutos' },
        operation: 'E[X]',
        formula: 'λ ajustado = 6',
        result: 6
      }]
    }
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.explanation, 'El valor esperado es 6.');
  assert.match(requestBody.input, /verifica para cada pregunta/);
  assert.match(requestBody.input, /lambdaBase/);
  assert.match(requestBody.input, /lambdaAjustado/);
  assert.match(requestBody.input, /intervaloPregunta/);
});
