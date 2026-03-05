const fs = require('fs');
const path = require('path');

// Save reports outside public/ to avoid triggering CRA's hot reload
const REPORTS_DIR = path.join(__dirname, '..', 'reports');

module.exports = function (app) {
  // Parse JSON bodies
  app.use('/api', require('express').json({ limit: '50mb' }));

  // Save report JSON
  app.post('/api/reports/:projectId', (req, res) => {
    const { projectId } = req.params;
    const { filename, data } = req.body;

    if (!filename || !data) {
      return res.status(400).json({ error: 'Missing filename or data' });
    }

    const reportsDir = path.join(REPORTS_DIR, projectId);
    fs.mkdirSync(reportsDir, { recursive: true });

    const filePath = path.join(reportsDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    res.json({ ok: true, path: filePath });
  });

  // Save report PDF (base64-encoded)
  app.post('/api/reports/:projectId/pdf', (req, res) => {
    const { projectId } = req.params;
    const { filename, base64 } = req.body;

    if (!filename || !base64) {
      return res.status(400).json({ error: 'Missing filename or base64 data' });
    }

    const reportsDir = path.join(REPORTS_DIR, projectId);
    fs.mkdirSync(reportsDir, { recursive: true });

    const filePath = path.join(reportsDir, filename);
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(filePath, buffer);

    res.json({ ok: true, path: filePath });
  });

  // Serve reports directory for loading saved reports
  app.use('/data/reports', require('express').static(REPORTS_DIR));
};
