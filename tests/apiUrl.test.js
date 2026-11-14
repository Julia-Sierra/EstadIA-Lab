const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const appScript = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');

function createApiUrl(endpoint) {
  const window = { API_ENDPOINT: endpoint, ESTADIA: {} };
  vm.runInNewContext(appScript, { window });
  return window.ESTADIA.apiUrl;
}

test('API URLs normalize a Vercel domain, /api base, or copied route', () => {
  const cases = [
    ['https://estadialab.vercel.app', 'https://estadialab.vercel.app/api/solve-problem'],
    ['https://estadialab.vercel.app/api', 'https://estadialab.vercel.app/api/solve-problem'],
    ['https://estadialab.vercel.app/api/gemini', 'https://estadialab.vercel.app/api/solve-problem'],
    ['https://estadialab.vercel.app/exercises', 'https://estadialab.vercel.app/api/solve-problem'],
    ['/api', '/api/solve-problem']
  ];

  for (const [endpoint, expectedUrl] of cases) {
    assert.equal(createApiUrl(endpoint)('solve-problem'), expectedUrl, endpoint);
  }

  assert.throws(() => createApiUrl('')('gemini'), /Configura la variable API_ENDPOINT/);
});
