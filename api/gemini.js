const { generateExplanation } = require('../services/geminiService');

const allowedOrigins = new Set([
  'https://julia-sierra.github.io',
  ...(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
]);

module.exports = async function geminiHandler(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ ok: false, message: 'Método no permitido.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ ok: false, message: 'Configura GEMINI_API_KEY como variable secreta del servidor.' });
  }

  try {
    const result = await generateExplanation(req.body || {});
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(error.statusCode || 502).json({
      ok: false,
      message: error.message || 'No se pudo generar la respuesta con Gemini.'
    });
  }
};
