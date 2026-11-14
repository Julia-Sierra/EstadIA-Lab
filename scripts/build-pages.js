const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outputDirectory = path.join(root, '_site');
const publicDirectory = path.join(root, 'public');
const apiEndpoint = (process.env.API_ENDPOINT || '').trim().replace(/\/+$/, '');

fs.mkdirSync(outputDirectory, { recursive: true });
fs.copyFileSync(
  path.join(root, 'views', 'exercises.html'),
  path.join(outputDirectory, 'index.html')
);
fs.cpSync(publicDirectory, path.join(outputDirectory, 'public'), { recursive: true });
fs.writeFileSync(
  path.join(outputDirectory, 'public', 'js', 'deployment-config.js'),
  `window.API_ENDPOINT = ${JSON.stringify(apiEndpoint)};\n`
);
