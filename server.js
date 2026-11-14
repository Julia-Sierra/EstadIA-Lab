const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const apiRoutes = require('./routes/apiRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use('/api', apiRoutes);
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.redirect('/exercises');
});

app.get('/dashboard', (req, res) => {
  res.redirect('/exercises');
});

app.get('/exercises', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'exercises.html'));
});

app.get('/health', (req, res) => {
  res.json({ ok: true, app: 'EstadIA Lab', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ ok: false, message: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`EstadIA Lab corriendo en http://localhost:${PORT}`);
});
