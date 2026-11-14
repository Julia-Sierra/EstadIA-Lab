const express = require('express');
const exerciseController = require('../controllers/exerciseController');
const analysisController = require('../controllers/analysisController');
const simulationController = require('../controllers/simulationController');
const geminiController = require('../controllers/geminiController');

const router = express.Router();

router.get('/exercises', exerciseController.listExercises);
router.get('/exercises/:id', exerciseController.getExercise);
router.post('/calculate', exerciseController.calculate);
router.post('/analyze', analysisController.analyze);
router.post('/solve-problem', (req, res) => {
  const { text, statement, questions } = req.body || {};
  try {
    const { solveProblem } = require('../services/statisticsService');
    const payload = solveProblem({ text, statement, questions });
    res.json({ ok: true, ...payload });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message || 'No se pudo resolver el problema.' });
  }
});
router.post('/simulate', simulationController.runSimulation);
router.post('/gemini', geminiController.explain);
router.post('/gemini/explain', geminiController.explain);

module.exports = router;
