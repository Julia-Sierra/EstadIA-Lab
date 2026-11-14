module.exports = {
  appName: 'EstadIA Lab',
  tagline: 'Comprende los datos. Descubre la probabilidad.',
  developer: {
    name: 'Desarrollador',
    career: 'Ingeniería en Sistemas / Estadística aplicada',
    institution: 'Facultad de Ingeniería en Sistemas de Información',
    subject: 'Estadística I',
    year: '2026',
    copyright: '© 2026 EstadIA Lab. Todos los derechos reservados.'
  },
  gemini: {
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  },
  stats: {
    distributions: ['Binomial', 'Binomial negativa', 'Poisson', 'Exponencial', 'Normal'],
    exercises: 8
  }
};
