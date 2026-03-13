const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');
const { generateTypstSource } = require('../server/typstGenerator');

// Save reports outside public/ to avoid triggering CRA's hot reload
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'report-template.typ');
const TYPST_BIN = (() => {
  // Check common install locations, then fall back to PATH lookup
  const candidates = [
    path.join(os.homedir(), '.cargo', 'bin', 'typst'),
    '/usr/local/bin/typst',
    '/usr/bin/typst',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  // Fall back to bare name — relies on PATH resolution
  return 'typst';
})();

module.exports = function (app) {
  // Parse JSON bodies
  app.use('/api', require('express').json({ limit: '50mb' }));

  // Generate PDF from ReportData via Typst
  app.post('/api/reports/:projectId/generate-pdf', (req, res) => {
    const { projectId } = req.params;
    const { reportData } = req.body;

    if (!reportData) {
      return res.status(400).json({ error: 'Missing reportData' });
    }

    let tmpTyp = null;
    let tmpPdf = null;

    try {
      // Read template
      const templateSource = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

      // Generate Typst source
      const typstSource = generateTypstSource(reportData, templateSource);

      // Write to temp file
      tmpTyp = path.join(os.tmpdir(), `report-${projectId}-${Date.now()}.typ`);
      tmpPdf = tmpTyp.replace(/\.typ$/, '.pdf');
      fs.writeFileSync(tmpTyp, typstSource);

      // Compile with Typst
      const fontDirs = [
        '/usr/share/fonts',
        path.join(os.homedir(), '.local/share/fonts'),
        path.join(os.homedir(), '.fonts'),
        '/Library/Fonts',
        path.join(os.homedir(), 'Library', 'Fonts'),
        '/System/Library/Fonts',
      ].filter((d) => fs.existsSync(d));

      const args = ['compile', tmpTyp, tmpPdf];
      for (const dir of fontDirs) {
        args.push('--font-path', dir);
      }

      execFileSync(TYPST_BIN, args, { timeout: 30000 });

      // Read generated PDF
      const pdfBuffer = fs.readFileSync(tmpPdf);

      // Save a copy to reports directory
      const reportsDir = path.join(REPORTS_DIR, projectId);
      fs.mkdirSync(reportsDir, { recursive: true });

      const reportDate = new Date(reportData.reportDate);
      const dateStr = reportDate.toISOString().split('T')[0];
      const safeTitle = (reportData.projectTitle || 'Report').replace(/\s+/g, '_');
      const pdfFilename = `${safeTitle}_Report_${dateStr}.pdf`;
      const typFilename = `${safeTitle}_Report_${dateStr}.typ`;
      const savedPath = path.join(reportsDir, pdfFilename);
      const savedTypPath = path.join(reportsDir, typFilename);
      fs.writeFileSync(savedPath, pdfBuffer);
      fs.copyFileSync(tmpTyp, savedTypPath);
      console.log('DEBUG: Typst source saved to:', savedTypPath);

      // Return PDF as response
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFilename}"`,
        'X-Saved-Path': savedPath,
      });
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error.message);
      if (error.stderr) {
        console.error('Typst stderr:', error.stderr.toString());
      }
      res.status(500).json({
        error: 'Failed to generate PDF',
        details: error.message,
        stderr: error.stderr ? error.stderr.toString() : undefined,
      });
    } finally {
      // Clean up temp files (debug .typ is saved to reports dir above)
      try { if (tmpTyp && fs.existsSync(tmpTyp)) fs.unlinkSync(tmpTyp); } catch (_) {}
      try { if (tmpPdf && fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf); } catch (_) {}
    }
  });

  // Serve reports directory for loading saved reports
  app.use('/data/reports', require('express').static(REPORTS_DIR));
};
