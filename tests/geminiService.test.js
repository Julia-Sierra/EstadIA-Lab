const assert = require('node:assert/strict');
const { test } = require('node:test');
const { generateGeminiResponse } = require('../services/geminiService');

const successfulResponse = (text) => ({
  ok: true,
  json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] })
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

  assert.equal(response.model, 'gemini-2.5-flash-lite');
  assert.equal(response.explanation, 'Respuesta de respaldo.');
  assert.deepEqual(requests.map((request) => new URL(request.url).pathname), [
    '/v1beta/models/gemini-3.5-flash-lite:generateContent',
    '/v1beta/models/gemini-2.5-flash-lite:generateContent'
  ]);
  assert.equal(new URL(requests[0].url).search, '');
  assert.equal(requests[0].options.headers['x-goog-api-key'], 'test-secret');
});

test('Gemini does not use the fallback for non-503 errors', async (context) => {
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
    return { ok: false, status: 400, text: async () => 'invalid request' };
  };

  await assert.rejects(
    generateGeminiResponse('Responde directamente.'),
    (error) => error.statusCode === 502 && error.message.includes('HTTP 400')
  );
  assert.equal(requests, 1);
});
