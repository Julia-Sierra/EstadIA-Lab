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
