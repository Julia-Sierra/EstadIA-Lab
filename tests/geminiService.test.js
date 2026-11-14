const assert = require('node:assert/strict');
const { test } = require('node:test');
const { generateGeminiResponse } = require('../services/geminiService');

const successfulResponse = (text) => ({
  ok: true,
  json: async () => ({
    steps: [{ type: 'model_output', content: [{ type: 'text', text }] }]
  })
});

const unavailableResponse = () => ({
  ok: false,
  status: 503,
  text: async () => 'temporarily unavailable'
});

test('Gemini fallback is used only after a primary model 503 and keeps the key out of the URL', async (context) => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  context.after(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
  });

  process.env.GEMINI_API_KEY = 'test-secret';
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return requests.length === 1 ? unavailableResponse() : successfulResponse('Respuesta de respaldo.');
  };

  const response = await generateGeminiResponse('Responde directamente.');

  assert.equal(response.model, 'gemini-3.5-flash-lite');
  assert.equal(response.explanation, 'Respuesta de respaldo.');
  assert.deepEqual(requests.map((request) => request.url), [
    'https://generativelanguage.googleapis.com/v1beta/interactions',
    'https://generativelanguage.googleapis.com/v1beta/interactions'
  ]);
  assert.deepEqual(requests.map((request) => JSON.parse(request.options.body).model), [
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite'
  ]);
  assert.equal(new URL(requests[0].url).search, '');
  assert.equal(requests[0].options.headers['x-goog-api-key'], 'test-secret');
  assert.equal(requests[0].options.headers['Api-Revision'], '2026-05-20');
  assert.deepEqual(JSON.parse(requests[0].options.body).generation_config, {
    thinking_level: 'low',
    max_output_tokens: 500
  });
  assert.equal(JSON.parse(requests[0].options.body).store, false);
});

test('Gemini uses the fallback for any upstream HTTP error', async (context) => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  context.after(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
  });

  process.env.GEMINI_API_KEY = 'test-secret';
  let requests = 0;
  global.fetch = async () => {
    requests += 1;
    if (requests === 1) {
      return { ok: false, status: 429, text: async () => 'rate limited' };
    }
    return successfulResponse('Respuesta de respaldo.');
  };

  const response = await generateGeminiResponse('Responde directamente.');
  assert.equal(response.model, 'gemini-3.5-flash-lite');
  assert.equal(response.explanation, 'Respuesta de respaldo.');
  assert.equal(requests, 2);
});
