const { generateExplanation } = require('../services/geminiService');

async function explain(req, res) {
  try {
    const payload = req.body;
    if (!String(payload?.question || '').trim()) {
      return res.status(400).json({ ok: false, message: 'Escribe una pregunta para Gemini.' });
    }
    const response = await generateExplanation(payload);
    res.json({ ok: true, ...response });
  } catch (error) {
    const status = error.statusCode || (process.env.GEMINI_API_KEY ? 502 : 503);
    res.status(status).json({ ok: false, message: error.message || 'No se pudo generar la respuesta con Gemini.' });
  }
}

module.exports = {
  explain
};
