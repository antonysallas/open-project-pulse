'use strict';
// The app's server side, shared by the dev server (src/setupProxy.js) and the
// production server (server/server.js). Node built-ins only.
//
//   GET  /data/projects.json              the project list        (dataDir)
//   GET  /data/projects/<file>.json       one project's details   (dataDir/projects)
//   GET  /api/projects                    every project's details (logo left out)
//                                         with a summary of its saved reports
//   GET  /api/projects/<id>/reports       saved report files, newest first
//   GET  /data/reports/<id>/<file>        one saved report, JSON or PDF (reportsDir/<id>)
//   POST /api/projects           {project}            create a project
//   POST /api/projects/<id>      {project}            change one (fields given replace)
//   POST /api/reports/<id>       {filename, data, opened, version}  save a report's JSON;
//                                         opened is the file it was opened from, null when
//                                         new, and version what X-Report-Version said then
//   POST /api/reports/<id>/pdf   {filename, base64}   save its PDF
//   POST /api/reports/<id>/lock  {filename, locked}   lock a submitted report
//                                         (no more saves to it or its PDF) or unlock it
//   POST /api/import             {file, mode}         bring in a .json export (a project
//                                         with its reports, or one report); mode is
//                                         'copy' or 'replace' when the project exists
//   GET  /api/session                     whether sign-in is on, and who is signed in
//   GET  /api/drafts/<key>                a form's unsaved state, or null  (dataDir/drafts)
//   POST /api/drafts/<key>       {draft}              keep it; {draft: null} drops it
//   GET  /brand/org-logo                  your organisation's logo for report footers
//                                         (dataDir/brand/org-logo.svg or .png), 204 when none
//
// <id> must be a project listed in projects.json, and a file name is cut to its
// last path part and reduced to letters, digits and ._()+- (anything else
// becomes _), so nothing is read or written outside the two folders. A new
// project's id is lowercase letters, digits and dashes, so report file names
// (YYYYMMDD_<id>_report.json) always split cleanly. A project is stored only
// with the fields cleanProject() knows, and an imported report with those
// cleanReport() knows. An import replaces nothing for good: what it replaces
// moves to dataDir/replaced/<id>-<time>. Only the lock call sets a report's
// locked, lockedAt and, with sign-in on, lockedBy. A POST must be JSON, and one from
// another site is refused.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const ID = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;
const REPORT = /_report\.json$/;
const LOCK_FIELDS = ['locked', 'lockedAt', 'lockedBy'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOGO = /^data:image\/(?:png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_LOGO = 1.5 * 1024 * 1024; // a 1 MB image as a data URL
const LOGO_TYPES = { svg: 'image/svg+xml', png: 'image/png' };
const STATUSES = ['in-progress', 'completed'];
const TYPES = ['ASK', 'APPROVAL', 'DIRECTIVE', 'FYI'];
const REPORT_STATUSES = ['on-track', 'at-risk', 'delayed'];
const EXPORT_VERSION = 1; // the newest .json export this version reads
const MAX_TEXT = 20000; // one rich-text item or reason in an imported report
const MAX_ITEMS = 200; // items in one list of an imported report
const MAX_REPORTS = 1000; // reports in one imported project
const DRAFT_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

function safeName(name, ext) {
  if (typeof name !== 'string') return null;
  const base = path.basename(name).replace(/[^A-Za-z0-9._()+-]+/g, '_').replace(/^[._]+/, '');
  if (base.length <= ext.length || base.length > 200 || !base.toLowerCase().endsWith(ext)) return null;
  return base;
}

const versionOf = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16);
const CHANGED = 'This report was changed somewhere else after you opened it. Reload to see the latest version: what you typed here is kept as a draft.';
const EDITING_TTL = 90000; // a form that stops saying it is open counts as closed after this

function send(res, status, body, type = 'application/json; charset=utf-8') {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': data.length, 'Cache-Control': 'no-store' });
  res.end(data);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size <= limit) chunks.push(chunk);
    });
    // Too large: read the rest to the end and drop it, so the client gets the
    // 413 instead of a cut connection.
    req.on('end', () => (size > limit
      ? reject(Object.assign(new Error('body too large'), { status: 413 }))
      : resolve(Buffer.concat(chunks))));
    req.on('error', reject);
  });
}

// Windows refuses a rename while antivirus or an indexer has the target open,
// usually only for a moment.
const HELD = ['EPERM', 'EACCES', 'EBUSY'];
const pause = new Int32Array(new SharedArrayBuffer(4));
function renameRetrying(from, to) {
  for (let tries = 1; ; tries++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (err) {
      if (tries >= 10 || !HELD.includes(err.code)) throw err;
      Atomics.wait(pause, 0, 0, 50);
    }
  }
}

// Write next to the target, then rename: a reader never sees half a file.
function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data, { mode: 0o600 });
  try {
    renameRetrying(tmp, file);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

// False for a POST sent by a page on some other site.
function sameSite(req, origin) {
  if (!req.headers.origin) return true;
  if (origin) return req.headers.origin === origin;
  try {
    return new URL(req.headers.origin).host === req.headers.host;
  } catch {
    return false;
  }
}

const isDate = (v) => typeof v === 'string' && DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
  new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// The project as stored in projects/<id>.json, built only from known fields.
// Returns { project } or { error } with a message for the person filling the form.
function cleanProject(input, id) {
  const p = input && typeof input === 'object' ? input : {};
  const name = text(p.name, 200);
  if (!name) return { error: 'Enter a project name.' };
  if (!isDate(p.startDate) || !isDate(p.endDate) || p.endDate <= p.startDate) {
    return { error: 'End date must be after the start date.' };
  }
  const model = p.deliveryModel === undefined ? 'sprint' : p.deliveryModel;
  if (model !== 'sprint' && model !== 'milestone') return { error: 'Delivery model must be sprint or milestone.' };
  const status = p.status === undefined ? 'in-progress' : p.status;
  if (!STATUSES.includes(status)) return { error: 'Status must be in-progress or completed.' };
  const weeks = p.sprintDuration === undefined ? 2 : p.sprintDuration;
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 8) return { error: 'Sprint length must be 1 to 8 weeks.' };

  const rows = model === 'sprint' ? p.sprints : p.phases;
  const list = rows === undefined ? [] : rows;
  if (!Array.isArray(list) || list.length > 200) return { error: 'Too many periods.' };
  const periods = [];
  for (const r of list) {
    const row = r && typeof r === 'object' ? r : {};
    const rowName = text(row.name, 100);
    if (!isDate(row.startDate) || !isDate(row.endDate) || row.endDate < row.startDate || (model === 'milestone' && !rowName)) {
      return { error: model === 'sprint' ? 'Each sprint needs a start and an end on or after it.' : 'Each phase needs a name and a start and end date.' };
    }
    const period = { name: rowName, startDate: row.startDate, endDate: row.endDate };
    // A sprint's goal (set from the report editor), tentative while it is a plan.
    const goal = model === 'sprint' ? text(row.goal, 50) : '';
    if (goal) {
      period.goal = goal;
      if (row.tentative === true) period.tentative = true;
    }
    periods.push(period);
  }
  if (model === 'milestone' && !periods.length) return { error: 'Add at least one phase.' };

  const goals = p.projectGoals === undefined ? [] : p.projectGoals;
  if (!Array.isArray(goals) || goals.length > 50) return { error: 'Too many goals.' };
  const badLogo = (v) => v && (typeof v !== 'string' || v.length > MAX_LOGO || !LOGO.test(v));
  const logo = p.logo || '';
  if (badLogo(logo)) return { error: 'The customer logo must be a PNG, JPEG, WebP or SVG image under 1 MB.' };
  const companyLogo = p.companyLogo || '';
  if (badLogo(companyLogo)) return { error: 'The company logo must be a PNG, JPEG, WebP or SVG image under 1 MB.' };

  const project = {
    id, name, description: text(p.description, 1000), customer: text(p.customer, 200), teamName: text(p.teamName, 200),
    status, startDate: p.startDate, endDate: p.endDate, deliveryModel: model, sprintDuration: weeks,
  };
  if (model === 'sprint') project.sprints = periods.map((x, i) => ({ number: i + 1, ...x, name: x.name || `Sprint ${i + 1}` }));
  else project.phases = periods;
  project.projectGoals = goals.map((g) => text(g, 4000)).filter(Boolean); // rich text
  if (logo) {
    project.logo = logo;
    project.logoName = text(p.logoName, 200);
  }
  // Your own organisation's, for this project only; without it reports show
  // the one in dataDir/brand.
  if (companyLogo) {
    project.companyLogo = companyLogo;
    project.companyLogoName = text(p.companyLogoName, 200);
  }
  return { project };
}

// Rich-text items as stored: { text, type }. Null when the list isn't one.
function cleanItems(list) {
  if (list === undefined) return [];
  if (!Array.isArray(list) || list.length > MAX_ITEMS) return null;
  const out = [];
  for (const item of list) {
    if (!item || typeof item.text !== 'string' || item.text.length > MAX_TEXT || !TYPES.includes(item.type)) return null;
    out.push({ text: item.text, type: item.type });
  }
  return out;
}

// A report from an imported file, built only from the fields a saved report
// has (src/types/ReportTypes.ts StoredReport), lock left out. Its text is shown
// only through the app's rich-text cleaner, as every saved report's is.
// Returns { report } or { error }.
function cleanReport(input) {
  const r = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  if (!isDate(r.reportDate)) return { error: 'a report has no date' };
  if (!REPORT_STATUSES.includes(r.status)) return { error: `the ${r.reportDate} report has no status` };
  const report = { reportDate: r.reportDate };
  if (r.nextReportDate !== undefined) {
    if (!isDate(r.nextReportDate)) return { error: `the ${r.reportDate} report has a bad next report date` };
    report.nextReportDate = r.nextReportDate;
  }
  report.status = r.status;
  for (const key of ['accomplishments', 'upcomingGoals', 'peopleAndProcess', 'technology']) {
    const items = cleanItems(r[key]);
    if (!items) return { error: `the ${r.reportDate} report has a damaged list` };
    report[key] = items;
  }
  report.draft = r.draft === true;
  if (r.currentPeriods !== undefined) {
    const list = r.currentPeriods;
    if (!Array.isArray(list) || list.length > 200 || !list.every((i) => Number.isInteger(i) && i >= 0 && i < 200)) {
      return { error: `the ${r.reportDate} report has damaged periods` };
    }
    report.currentPeriods = list;
  }
  for (const key of ['sprintGoal', 'nextSprintGoal']) {
    if (r[key] === undefined) continue;
    if (typeof r[key] !== 'string') return { error: `the ${r.reportDate} report has a damaged sprint goal` };
    report[key] = r[key].trim().slice(0, 50);
  }
  if (r.statusReason !== undefined) {
    if (typeof r.statusReason !== 'string' || r.statusReason.length > MAX_TEXT) return { error: `the ${r.reportDate} report has a damaged reason` };
    if (r.statusReason) report.statusReason = r.statusReason;
  }
  return { report };
}

const reportName = (id, date) => `${date.replace(/-/g, '')}_${id}_report.json`;

// The id and name "Keep both" gives a copy: <id>-2 and "<name> (2)", or the
// next number free.
function copyOf(list, id, name) {
  for (let n = 2; n < 1000; n++) {
    const suffix = `-${n}`;
    const next = `${id.slice(0, 60 - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (ID.test(next) && !list.some((p) => p.id === next)) return { id: next, name: `${name} (${n})` };
  }
  return null;
}

// projects.json's entry for a project: enough to list it.
const summaryOf = (p) => ({
  id: p.id, name: p.name, description: p.description, customer: p.customer, status: p.status, detailsFile: `projects/${p.id}.json`,
});

// auth is null with sign-in off, or { signInUrl, signOutUrl, idleMinutes } with it
// on. Only with it on does a request have a user: otherwise the header means nothing.
function createApi({ dataDir, reportsDir, auth = null, origin = null, maxBody = 32 * 1024 * 1024, log = () => {} }) {
  const userOf = (req) => (auth && req.headers['x-forwarded-user']) || null;
  const forUser = (req) => (userOf(req) ? ` for ${userOf(req)}` : '');
  const draftFile = (req, key) => {
    const user = userOf(req);
    const folder = user ? [String(user).replace(/[^A-Za-z0-9@-]+/g, '_').slice(0, 100)] : [];
    return path.join(dataDir, 'drafts', ...folder, `${key}.json`);
  };
  const listFile = path.join(dataDir, 'projects.json');
  function readList() {
    try {
      const list = JSON.parse(fs.readFileSync(listFile, 'utf8')).projects;
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }
  const known = (id) => ID.test(id) && readList().some((p) => p.id === id);

  // A saved PDF downloads under the name Export gives a new one
  // (src/utils/report.ts downloadName): Project_Name_Report_YYYY-MM-DD.pdf.
  function pdfName(id, file) {
    const m = file.match(/^(\d{4})(\d{2})(\d{2})_/);
    if (!m) return null;
    const entry = readList().find((p) => p.id === id) || {};
    const name = String(entry.name || id).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Project';
    return `${name}_Report_${m[1]}-${m[2]}-${m[3]}.pdf`;
  }

  // A project's details file, or its projects.json entry when it has none.
  function readDetails(entry) {
    const file = typeof entry.detailsFile === 'string' && entry.detailsFile.split('/');
    if (file && file.length === 2 && file[0] === 'projects' && safeName(file[1], '.json') === file[1]) {
      try {
        return { ...entry, ...JSON.parse(fs.readFileSync(path.join(dataDir, 'projects', file[1]), 'utf8')), id: entry.id };
      } catch {
        // fall through to the entry
      }
    }
    return entry;
  }

  // Saved reports, newest first: the JSON file, its date, status and reason,
  // its stakeholder items counted by type, and the PDF saved with it (YYYYMMDD_<id>_report.pdf).
  function reportSummaries(id) {
    let names;
    try {
      names = fs.readdirSync(path.join(reportsDir, id));
    } catch {
      return [];
    }
    const pdfs = names.filter((n) => safeName(n, '.pdf') === n);
    return names.filter((n) => REPORT.test(n) && safeName(n, '.json') === n).sort().reverse().map((json) => {
      let data = {};
      try {
        data = JSON.parse(fs.readFileSync(path.join(reportsDir, id, json), 'utf8')) || {};
      } catch {
        // listed without its date and status
      }
      const m = json.match(/^(\d{4})(\d{2})(\d{2})_/);
      const date = isDate(data.reportDate) ? data.reportDate : m ? `${m[1]}-${m[2]}-${m[3]}` : null;
      const stem = json.replace(/\.json$/, '.pdf');
      const pdf = pdfs.includes(stem) ? stem : null;
      const actions = {};
      for (const list of [data.peopleAndProcess, data.technology]) {
        for (const item of Array.isArray(list) ? list : []) {
          if (item && TYPES.includes(item.type)) actions[item.type] = (actions[item.type] || 0) + 1;
        }
      }
      return {
        json, pdf, date, status: typeof data.status === 'string' ? data.status : null, draft: data.draft === true,
        locked: data.locked === true, reason: text(data.statusReason, 4000), actions,
      };
    });
  }

  function listProjects(res) {
    const projects = readList().filter((p) => p && ID.test(p.id)).map((entry) => {
      const { logo, companyLogo, ...details } = readDetails(entry);
      return { ...details, hasLogo: !!logo, hasCompanyLogo: !!companyLogo, reports: reportSummaries(entry.id) };
    });
    send(res, 200, { projects });
  }

  function sendFile(res, file, type, versioned = false, downloadAs = null) {
    fs.readFile(file, (err, data) => {
      if (err) {
        send(res, 404, { error: 'not found' });
        return;
      }
      if (versioned) res.setHeader('X-Report-Version', versionOf(data));
      if (downloadAs) res.setHeader('Content-Disposition', `inline; filename="${downloadAs}"`);
      send(res, 200, data, type);
    });
  }

  // The parsed JSON body, or undefined once an error has been sent.
  async function readJson(req, res) {
    if (!/^application\/json\b/.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'JSON only' });
    if (!sameSite(req, origin)) return send(res, 403, { error: 'wrong origin' });
    try {
      return JSON.parse((await readBody(req, maxBody)).toString('utf8'));
    } catch (err) {
      return send(res, err.status || 400, { error: err.status ? 'too large' : 'bad JSON' });
    }
  }

  // Create (id null) or change a project: the details file first, then its
  // entry in projects.json, so the list never names a missing file. The reads
  // and writes after the body arrives are synchronous, so two saves can't
  // interleave.
  async function saveProject(req, res, id) {
    if (id !== null && !known(id)) return send(res, 404, { error: 'unknown project' });
    const body = await readJson(req, res);
    if (body === undefined) return undefined;
    const input = body && typeof body.project === 'object' && body.project ? body.project : null;
    if (!input) return send(res, 400, { error: 'missing project' });
    const list = readList();
    let base = {};
    if (id === null) {
      id = input.id;
      if (typeof id !== 'string' || !ID.test(id)) {
        return send(res, 400, { error: 'Project ID must be lowercase letters, digits and dashes.' });
      }
      if (list.some((p) => p.id === id)) return send(res, 409, { error: `A project with ID ${id} already exists. Change the ID.` });
    } else {
      const entry = list.find((p) => p.id === id);
      if (!entry) return send(res, 404, { error: 'unknown project' });
      base = readDetails(entry);
    }
    const { project, error } = cleanProject({ ...base, ...input }, id);
    if (error) return send(res, 400, { error });
    writeAtomic(path.join(dataDir, 'projects', `${id}.json`), JSON.stringify(project, null, 2));
    const entry = summaryOf(project);
    const next = list.some((p) => p.id === id) ? list.map((p) => (p.id === id ? entry : p)) : [...list, entry];
    writeAtomic(listFile, JSON.stringify({ projects: next }, null, 2));
    log(`${base.id ? 'changed' : 'created'} project ${id}${forUser(req)}`);
    const { logo, companyLogo, ...rest } = project;
    return send(res, base.id ? 200 : 201, { ok: true, project: { ...rest, hasLogo: !!logo, hasCompanyLogo: !!companyLogo } });
  }

  // A saved report's JSON, or null.
  function readReport(id, json) {
    try {
      return JSON.parse(fs.readFileSync(path.join(reportsDir, id, json), 'utf8')) || null;
    } catch {
      return null;
    }
  }

  // The report JSON a file belongs to: itself, or for a PDF
  // (YYYYMMDD_<id>_report.pdf) the report of its date.
  function reportOf(id, name) {
    if (REPORT.test(name)) return name;
    const m = name.match(/^(\d{8})_.*_report\.pdf$/);
    return m ? `${m[1]}_${id}_report.json` : null;
  }

  async function save(req, res, id, pdf) {
    if (!known(id)) return send(res, 404, { error: 'unknown project' });
    const body = await readJson(req, res);
    if (body === undefined) return undefined;
    const name = safeName(body && body.filename, pdf ? '.pdf' : '.json');
    if (!name) return send(res, 400, { error: `filename must end in ${pdf ? '.pdf' : '.json'}` });
    const json = reportOf(id, name);
    const saved = json && readReport(id, json);
    if (saved && saved.locked === true) return send(res, 409, { error: 'This report is locked. Unlock it to change it.' });
    let data;
    let movedFrom = null;
    if (pdf) {
      data = typeof body.base64 === 'string' ? Buffer.from(body.base64, 'base64') : Buffer.alloc(0);
      if (data.subarray(0, 5).toString('latin1') !== '%PDF-') return send(res, 400, { error: 'not a PDF' });
    } else {
      if (!body.data || typeof body.data !== 'object') return send(res, 400, { error: 'missing data' });
      // A save replaces only the file it was opened from, so that a report can't
      // silently take the place of another one on the same date.
      const opened = body.opened === undefined || body.opened === null ? null : safeName(body.opened, '.json');
      if (opened === null && body.opened !== undefined && body.opened !== null) return send(res, 400, { error: 'opened must name a report file' });
      // Saved from a version that has since changed, it would undo that other save.
      if (opened !== null) {
        let current = null;
        try {
          current = fs.readFileSync(path.join(reportsDir, id, opened));
        } catch {
          // moved or gone, which is a change too
        }
        if (!current || versionOf(current) !== body.version) return send(res, 409, { error: CHANGED });
      }
      if (name !== opened) {
        const taken = [name, name.replace(/\.json$/i, '.pdf')].some((n) => fs.existsSync(path.join(reportsDir, id, n)));
        if (taken) return send(res, 409, { error: 'There is already a report for this date. Open it from Reports, or pick another date.' });
        // Saved under a new date, a draft moves. Anything else stays where it is.
        const old = opened && REPORT.test(opened) ? readReport(id, opened) : null;
        if (old && old.draft === true && old.locked !== true) movedFrom = opened;
      }
      const report = { ...body.data };
      for (const k of LOCK_FIELDS) delete report[k];
      data = JSON.stringify(report, null, 2);
    }
    writeAtomic(path.join(reportsDir, id, name), data);
    if (movedFrom) {
      try {
        fs.rmSync(path.join(reportsDir, id, movedFrom), { force: true });
      } catch (err) {
        log(`couldn't remove ${id}/${movedFrom} after moving it: ${err.message}`);
      }
    }
    log(`saved ${id}/${name} (${data.length} bytes)${forUser(req)}`);
    return send(res, 200, pdf ? { ok: true, filename: name } : { ok: true, filename: name, version: versionOf(Buffer.from(data)) });
  }

  // Lock a submitted report once it has been presented, or unlock it.
  async function lock(req, res, id) {
    if (!known(id)) return send(res, 404, { error: 'unknown project' });
    const body = await readJson(req, res);
    if (body === undefined) return undefined;
    const name = safeName(body && body.filename, '.json');
    const report = name && REPORT.test(name) ? readReport(id, name) : null;
    if (!report) return send(res, 404, { error: 'unknown report' });
    if (report.draft === true) return send(res, 409, { error: 'Submit the report before locking it.' });
    for (const k of LOCK_FIELDS) delete report[k];
    const user = userOf(req);
    if (body.locked === true) Object.assign(report, { locked: true, lockedAt: new Date().toISOString(), ...(user ? { lockedBy: user } : {}) });
    writeAtomic(path.join(reportsDir, id, name), JSON.stringify(report, null, 2));
    log(`${report.locked ? 'locked' : 'unlocked'} ${id}/${name}${forUser(req)}`);
    return send(res, 200, { ok: true, report });
  }

  // Bring in a .json export (src/utils/exchange.ts). All or nothing: the new
  // reports are written to a folder of their own first and swapped in by
  // rename; whatever they replace moves to dataDir/replaced/<id>-<time>, and
  // a step that fails undoes the ones before it.
  const DAMAGED = 'This file is incomplete or damaged, so nothing was imported. Export it again from Pulse.';
  const asideDir = (id) => path.join(dataDir, 'replaced', `${id}-${new Date().toISOString().replace(/[:.]/g, '-')}`);

  async function importFile(req, res) {
    const body = await readJson(req, res);
    if (body === undefined) return undefined;
    const file = body && body.file;
    if (!file || typeof file !== 'object' || file.format !== 'pulse-export') {
      return send(res, 400, { error: "This isn't a Pulse export. Choose a .json file exported from Pulse." });
    }
    if (!Number.isInteger(file.version) || file.version < 1) return send(res, 400, { error: DAMAGED });
    if (file.version > EXPORT_VERSION) return send(res, 400, { error: 'This file was made by a newer version of Pulse. Update Pulse, then import it again.' });
    if (file.kind === 'project') return importProject(req, res, file, body.mode);
    if (file.kind === 'report') return importReport(req, res, file);
    return send(res, 400, { error: DAMAGED });
  }

  function importProject(req, res, file, mode) {
    const src = file.project;
    if (!src || typeof src !== 'object' || typeof src.id !== 'string' || !ID.test(src.id) ||
        !Array.isArray(file.reports) || file.reports.length > MAX_REPORTS) {
      return send(res, 400, { error: DAMAGED });
    }
    const list = readList();
    const exists = list.some((p) => p.id === src.id);
    if (exists && mode !== 'copy' && mode !== 'replace') {
      return send(res, 409, { error: `A project with ID ${src.id} is already in Pulse. Choose Keep both or Replace existing.` });
    }
    let id = src.id;
    let name = src.name;
    if (exists && mode === 'copy') {
      const copy = copyOf(list, src.id, text(src.name, 200) || src.id);
      if (!copy) return send(res, 409, { error: `There are too many copies of ${src.id} already.` });
      ({ id, name } = copy);
    }
    const { project, error } = cleanProject({ ...src, name }, id);
    if (error) return send(res, 400, { error: `${DAMAGED} (${error})` });
    const reports = [];
    for (const r of file.reports) {
      const { report, error: bad } = cleanReport(r);
      if (bad) return send(res, 400, { error: `${DAMAGED} (In the file, ${bad}.)` });
      if (reports.some((x) => x.reportDate === report.reportDate)) {
        return send(res, 400, { error: `${DAMAGED} (It has two reports for ${report.reportDate}.)` });
      }
      reports.push(report);
    }

    const dir = path.join(reportsDir, id);
    const detailsFile = path.join(dataDir, 'projects', `${id}.json`);
    const tmp = path.join(reportsDir, `.import-${id}-${process.pid}-${Date.now()}`);
    const aside = asideDir(id);
    const undo = [];
    try {
      fs.mkdirSync(tmp, { recursive: true, mode: 0o700 });
      for (const r of reports) fs.writeFileSync(path.join(tmp, reportName(id, r.reportDate)), JSON.stringify(r, null, 2), { mode: 0o600 });
      if (fs.existsSync(dir)) {
        fs.mkdirSync(aside, { recursive: true, mode: 0o700 });
        renameRetrying(dir, path.join(aside, 'reports'));
        undo.push(() => renameRetrying(path.join(aside, 'reports'), dir));
      }
      renameRetrying(tmp, dir);
      undo.push(() => renameRetrying(dir, tmp));
      const old = fs.existsSync(detailsFile) ? fs.readFileSync(detailsFile) : null;
      if (old) {
        fs.mkdirSync(aside, { recursive: true, mode: 0o700 });
        fs.writeFileSync(path.join(aside, `${id}.json`), old, { mode: 0o600 });
      }
      writeAtomic(detailsFile, JSON.stringify(project, null, 2));
      undo.push(() => (old ? writeAtomic(detailsFile, old) : fs.rmSync(detailsFile, { force: true })));
      // The list last, so it never names a project that isn't all there.
      const entry = summaryOf(project);
      const next = list.some((p) => p.id === id) ? list.map((p) => (p.id === id ? entry : p)) : [...list, entry];
      writeAtomic(listFile, JSON.stringify({ projects: next }, null, 2));
    } catch (err) {
      for (const step of undo.reverse()) {
        try {
          step();
        } catch (e) {
          log(`import of ${id}: couldn't undo a step: ${e.message}`);
        }
      }
      fs.rmSync(tmp, { recursive: true, force: true });
      throw err;
    }
    log(`imported project ${id} with ${reports.length} reports${exists && mode === 'replace' ? `, replacing the old one (kept in ${path.relative(dataDir, aside)})` : ''}${forUser(req)}`);
    return send(res, 200, { ok: true, id, name: project.name, reports: reports.length });
  }

  function importReport(req, res, file) {
    const id = file.projectId;
    if (typeof id !== 'string' || !ID.test(id)) return send(res, 400, { error: DAMAGED });
    if (!known(id)) {
      const owner = text(file.projectName, 200) || id;
      return send(res, 404, { error: `This report belongs to '${owner}', which isn't in Pulse. Import that project's file first, then this report.` });
    }
    const { report, error } = cleanReport(file.report);
    if (error) return send(res, 400, { error: `${DAMAGED} (In the file, ${error}.)` });
    const name = reportName(id, report.reportDate);
    const pdf = name.replace(/\.json$/, '.pdf');
    const dir = path.join(reportsDir, id);
    const current = readReport(id, name);
    if (current && current.locked === true) {
      return send(res, 409, { error: `The ${report.reportDate} report is locked. Unlock it, then import again.` });
    }
    // The report it replaces, and its PDF, which would no longer match.
    const aside = asideDir(id);
    const replaced = [name, pdf].filter((n) => fs.existsSync(path.join(dir, n)));
    let pdfMoved = false;
    try {
      if (replaced.length) {
        fs.mkdirSync(aside, { recursive: true, mode: 0o700 });
        if (replaced.includes(name)) fs.copyFileSync(path.join(dir, name), path.join(aside, name));
        if (replaced.includes(pdf)) {
          renameRetrying(path.join(dir, pdf), path.join(aside, pdf));
          pdfMoved = true;
        }
      }
      writeAtomic(path.join(dir, name), JSON.stringify(report, null, 2));
    } catch (err) {
      if (pdfMoved) {
        try {
          renameRetrying(path.join(aside, pdf), path.join(dir, pdf));
        } catch (e) {
          log(`import of ${id}/${name}: couldn't put the PDF back: ${e.message}`);
        }
      }
      throw err;
    }
    log(`imported ${id}/${name}${replaced.length ? ` (the old one kept in ${path.relative(dataDir, aside)})` : ''}${forUser(req)}`);
    return send(res, 200, { ok: true, id, filename: name, replaced: replaced.includes(name) });
  }

  // Which forms are open, kept in memory only: the alert that a report or project
  // is open somewhere else. Each open form says so every little while.
  const editing = new Map(); // key -> Map(tab -> last heard from)
  async function markEditing(req, res, key) {
    const body = await readJson(req, res);
    if (body === undefined) return undefined;
    const tab = body && body.tab;
    if (typeof tab !== 'string' || !DRAFT_KEY.test(tab)) return send(res, 400, { error: 'missing tab' });
    const now = Date.now();
    for (const [k, tabs] of editing) {
      for (const [t, seen] of tabs) if (now - seen > EDITING_TTL) tabs.delete(t);
      if (!tabs.size) editing.delete(k);
    }
    const tabs = editing.get(key) || new Map();
    if (body.leaving === true) tabs.delete(tab);
    else tabs.set(tab, now);
    if (tabs.size) editing.set(key, tabs);
    else editing.delete(key);
    return send(res, 200, { others: [...tabs.keys()].filter((t) => t !== tab).length });
  }

  // A form's unsaved state, kept while it is edited so a closed tab loses nothing.
  async function saveDraft(req, res, key) {
    const body = await readJson(req, res);
    if (body === undefined) return undefined;
    const file = draftFile(req, key);
    if (body && body.draft === null) {
      fs.rmSync(file, { force: true });
      return send(res, 200, { ok: true });
    }
    if (!body || !body.draft || typeof body.draft !== 'object') return send(res, 400, { error: 'missing draft' });
    writeAtomic(file, JSON.stringify(body.draft));
    return send(res, 200, { ok: true });
  }

  function listReports(res, id) {
    if (!known(id)) return send(res, 404, { error: 'unknown project' });
    fs.readdir(path.join(reportsDir, id), (err, names) => {
      const reports = err ? [] : names.filter((n) => REPORT.test(n) && safeName(n, '.json') === n);
      send(res, 200, { reports: reports.sort().reverse() });
    });
  }

  // Returns true when the request is one of the routes above (answered, or
  // being answered); false hands it on (to the static files or the dev server).
  return function api(req, res) {
    let parts;
    try {
      parts = new URL(req.url, 'http://x').pathname.split('/').slice(1).map(decodeURIComponent);
    } catch {
      send(res, 400, { error: 'bad path' });
      return true;
    }
    const route = parts.join('/');
    const get = req.method === 'GET' || req.method === 'HEAD';

    const fail = (what) => (err) => {
      log(`${what} failed: ${err.message}`);
      if (!res.headersSent) send(res, 500, { error: `${what} failed` });
    };

    if (get && route === 'api/session') {
      send(res, 200, auth ? { auth: true, user: userOf(req), ...auth } : { auth: false, user: null });
    } else if (get && route === 'brand/org-logo') {
      // No logo is a normal answer, not an error the browser would log.
      const ext = Object.keys(LOGO_TYPES).find((e) => fs.existsSync(path.join(dataDir, 'brand', `org-logo.${e}`)));
      if (ext) sendFile(res, path.join(dataDir, 'brand', `org-logo.${ext}`), LOGO_TYPES[ext]);
      else send(res, 204, '');
    } else if (parts.length === 3 && parts[0] === 'api' && parts[1] === 'drafts' && (get || req.method === 'POST')) {
      if (!DRAFT_KEY.test(parts[2])) send(res, 404, { error: 'not found' });
      else if (get) {
        // No draft is a normal answer (null), not an error the browser would log.
        fs.readFile(draftFile(req, parts[2]), (err, data) => send(res, 200, err ? 'null' : data));
      }
      else saveDraft(req, res, parts[2]).catch(fail('draft'));
    } else if (req.method === 'POST' && parts.length === 3 && parts[0] === 'api' && parts[1] === 'editing') {
      if (!DRAFT_KEY.test(parts[2])) send(res, 404, { error: 'not found' });
      else markEditing(req, res, parts[2]).catch(fail('editing'));
    } else if (get && route === 'data/projects.json') {
      sendFile(res, path.join(dataDir, 'projects.json'), 'application/json; charset=utf-8');
    } else if (get && parts.length === 3 && parts[0] === 'data' && parts[1] === 'projects') {
      if (safeName(parts[2], '.json') !== parts[2]) send(res, 404, { error: 'not found' });
      else sendFile(res, path.join(dataDir, 'projects', parts[2]), 'application/json; charset=utf-8');
    } else if (get && route === 'api/projects') {
      listProjects(res);
    } else if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'projects' && parts.length <= 3) {
      saveProject(req, res, parts.length === 3 ? parts[2] : null).catch(fail('save'));
    } else if (get && parts.length === 4 && parts[0] === 'api' && parts[1] === 'projects' && parts[3] === 'reports') {
      listReports(res, parts[2]);
    } else if (get && parts.length === 4 && parts[0] === 'data' && parts[1] === 'reports') {
      const [, , id, file] = parts;
      const type = file.endsWith('.pdf') ? 'application/pdf' : 'application/json; charset=utf-8';
      if (!known(id) || safeName(file, file.endsWith('.pdf') ? '.pdf' : '.json') !== file) send(res, 404, { error: 'not found' });
      else sendFile(res, path.join(reportsDir, id, file), type, !file.endsWith('.pdf'), file.endsWith('.pdf') ? pdfName(id, file) : null);
    } else if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'reports' &&
               (parts.length === 3 || (parts.length === 4 && parts[3] === 'pdf'))) {
      save(req, res, parts[2], parts.length === 4).catch(fail('save'));
    } else if (req.method === 'POST' && parts.length === 4 && parts[0] === 'api' && parts[1] === 'reports' && parts[3] === 'lock') {
      lock(req, res, parts[2]).catch(fail('lock'));
    } else if (req.method === 'POST' && route === 'api/import') {
      importFile(req, res).catch(fail('import'));
    } else if (parts[0] === 'api') {
      send(res, 404, { error: 'no such call' });
    } else {
      return false;
    }
    return true;
  };
}

module.exports = { createApi, safeName, cleanProject, cleanReport, summaryOf };
