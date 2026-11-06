const path = require('path');
const { createApi } = require('../server/api');

// Dev server (npm start): the same API as production (server/api.js), on the
// same folder layout: data/projects.json, data/projects/*.json and
// data/reports/<project>/ (or PULSE_DATA). data/ sits outside public/ because
// CRA reloads the page when anything in public/ changes, which would cut off
// every save, and copies public/ into the build, which would ship your reports.
const root = path.join(__dirname, '..');
const dataDir = path.resolve(process.env.PULSE_DATA || path.join(root, 'data'));

module.exports = function (app) {
  const api = createApi({ dataDir, reportsDir: path.join(dataDir, 'reports') });
  app.use((req, res, next) => {
    if (!api(req, res)) next();
  });
};
