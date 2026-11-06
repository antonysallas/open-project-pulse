'use strict';
// The made-up project a new install starts with, so there is something to look
// at, and the calls that add and remove it (`pulse sample`). The files are in
// sample/. Their dates are moved in whole weeks when they are added, so the last
// report is always from the past week and weekdays stay the same. Keep dates out
// of the report text, where they wouldn't move.
const fs = require('fs');
const path = require('path');
const { cleanProject, summaryOf } = require('./api');

const SOURCE = path.join(__dirname, '..', 'sample');
const ID = 'acme-customer-portal';
const LOGO = 'org-logo.svg';
const WEEK = 7 * 86400000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n) => String(n).padStart(2, '0');
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const time = (date) => Date.parse(`${date}T00:00:00Z`);
const readSample = (name) => JSON.parse(fs.readFileSync(path.join(SOURCE, name), 'utf8'));

function write(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, data, { mode: 0o600 });
}

// Every date in the value, moved by this many milliseconds.
function moved(value, by) {
  if (Array.isArray(value)) return value.map((v) => moved(v, by));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, moved(v, by)]));
  if (typeof value === 'string' && DATE.test(value)) return new Date(time(value) + by).toISOString().slice(0, 10);
  return value;
}

// The project list. No file is an empty list; a file we can't read is an error,
// so that it is never overwritten.
function readList(dataDir) {
  let raw;
  try {
    raw = fs.readFileSync(path.join(dataDir, 'projects.json'), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const { projects } = JSON.parse(raw);
  return Array.isArray(projects) ? projects : [];
}
const writeList = (dataDir, projects) => write(path.join(dataDir, 'projects.json'), JSON.stringify({ projects }, null, 2));

const hasLogo = (dataDir) => ['svg', 'png'].some((ext) => fs.existsSync(path.join(dataDir, 'brand', `org-logo.${ext}`)));

// True for a data folder with nothing in it, as on a first install.
function isNew(dataDir) {
  try {
    return fs.readdirSync(dataDir).length === 0;
  } catch (err) {
    if (err.code === 'ENOENT') return true;
    throw err;
  }
}

// Adds the project, its reports and, if there is no logo yet, the logo. Changes
// nothing if the project is already there.
function addSample(dataDir, today = localToday()) {
  const list = readList(dataDir);
  if (list.some((p) => p && p.id === ID)) return { added: false };

  const names = fs.readdirSync(SOURCE).filter((n) => /^report-\d+\.json$/.test(n));
  const reports = names.map(readSample);
  const last = Math.max(...reports.map((r) => time(r.reportDate)));
  const by = Math.floor((time(today) - last) / WEEK) * WEEK;

  const { project, error } = cleanProject(moved(readSample('project.json'), by), ID);
  if (error) throw new Error(`The sample project is wrong: ${error}`);
  write(path.join(dataDir, 'projects', `${ID}.json`), JSON.stringify(project, null, 2));
  for (const source of reports) {
    const report = moved(source, by);
    if (report.locked) report.lockedAt = `${report.reportDate}T09:00:00.000Z`;
    write(path.join(dataDir, 'reports', ID, `${report.reportDate.replace(/-/g, '')}_${ID}_report.json`), JSON.stringify(report, null, 2));
  }
  writeList(dataDir, [...list, summaryOf(project)]);
  const logo = !hasLogo(dataDir);
  if (logo) write(path.join(dataDir, 'brand', LOGO), fs.readFileSync(path.join(SOURCE, LOGO)));
  return { added: true, reports: reports.length, logo };
}

// Removes the project, everything saved under it, and the logo if it is still
// the sample's. Nothing else is touched, and projects.json stays, so that an
// update doesn't take the folder for a new one and add the sample back.
function removeSample(dataDir) {
  const list = readList(dataDir);
  const known = list.some((p) => p && p.id === ID);
  if (known) writeList(dataDir, list.filter((p) => !p || p.id !== ID));
  fs.rmSync(path.join(dataDir, 'projects', `${ID}.json`), { force: true });

  const folder = path.join(dataDir, 'reports', ID);
  const reports = fs.existsSync(folder) ? fs.readdirSync(folder).filter((n) => n.endsWith('.json')).length : 0;
  fs.rmSync(folder, { recursive: true, force: true });

  // Unsaved forms: drafts/project-<id>.json and report-<id>-<file>.json
  const drafts = path.join(dataDir, 'drafts');
  for (const name of fs.existsSync(drafts) ? fs.readdirSync(drafts) : []) {
    if (name === `project-${ID}.json` || name.startsWith(`report-${ID}-`)) fs.rmSync(path.join(drafts, name), { force: true });
  }

  const logoFile = path.join(dataDir, 'brand', LOGO);
  const logo = fs.existsSync(logoFile) && fs.readFileSync(logoFile).equals(fs.readFileSync(path.join(SOURCE, LOGO)));
  if (logo) fs.rmSync(logoFile);
  return { removed: known, reports, logo };
}

module.exports = { addSample, removeSample, isNew, SAMPLE_ID: ID };
