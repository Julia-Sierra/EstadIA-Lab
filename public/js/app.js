window.ESTADIA = window.ESTADIA || {};

const configuredApiEndpoint = typeof window.API_ENDPOINT === 'string'
  ? window.API_ENDPOINT.trim()
  : '/api';
const apiEndpointBase = configuredApiEndpoint
  .replace(/\/+$/, '')
  .replace(/\/(?:exercises|gemini)$/i, '');
window.ESTADIA.API_ENDPOINT = !apiEndpointBase
  ? ''
  : /\/api$/i.test(apiEndpointBase)
    ? apiEndpointBase
    : `${apiEndpointBase}/api`;
window.ESTADIA.apiUrl = (path) => {
  if (!window.ESTADIA.API_ENDPOINT) {
    throw new Error('Configura la variable API_ENDPOINT con la URL del backend.');
  }
  return `${window.ESTADIA.API_ENDPOINT}/${String(path).replace(/^\/+/, '')}`;
};

window.ESTADIA.formatPercent = (value) => `${Number(value || 0).toFixed(4)}%`;

window.ESTADIA.renderParamList = (params) => {
  const entries = Object.entries(params || {});
  if (!entries.length) return '<div class="param-item">Sin parámetros adicionales.</div>';
  return entries
    .map(([key, value]) => `<div class="param-item"><strong>${key}:</strong> ${value}</div>`)
    .join('');
};

window.ESTADIA.renderResult = ({ result, percentage, title, operationKey }) => {
  const probability = Number(result ?? 0);
  const percent = Number(percentage ?? (probability * 100));
  return `
    <h3>${title}</h3>
    <p><strong>Operación:</strong> ${operationKey}</p>
    <p><strong>Resultado decimal:</strong> ${probability.toFixed(6)}</p>
    <p><strong>Resultado porcentual:</strong> ${percent.toFixed(4)}%</p>
    <p><strong>Interpretación:</strong> La probabilidad estimada del evento es de ${probability.toFixed(6)}, lo que equivale a ${percent.toFixed(4)}%.</p>
  `;
};
