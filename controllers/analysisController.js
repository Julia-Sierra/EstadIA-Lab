const { analyzeText } = require('../services/statisticsService');

function analyze(req, res) {
  try {
    const { text } = req.body;
    const result = analyzeText(text || '');
    res.json({ ok: true, analysis: result });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message || 'No se pudo analizar el texto.' });
  }
}

module.exports = {
  analyze
};
