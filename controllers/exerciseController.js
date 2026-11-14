const { getAllExercises, getExerciseById } = require('../models/exerciseModel');
const { calculateExercise } = require('../services/statisticsService');

function listExercises(req, res) {
  res.json({ ok: true, exercises: getAllExercises() });
}

function getExercise(req, res) {
  const exercise = getExerciseById(req.params.id);
  if (!exercise) {
    return res.status(404).json({ ok: false, message: 'Ejercicio no encontrado.' });
  }
  return res.json({ ok: true, exercise });
}

function calculate(req, res) {
  try {
    const { exerciseId, operationKey, params } = req.body;
    const result = calculateExercise(exerciseId, operationKey, params || {});
    res.json({ ok: true, result });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message || 'No se pudo calcular el ejercicio.' });
  }
}

module.exports = {
  listExercises,
  getExercise,
  calculate
};
