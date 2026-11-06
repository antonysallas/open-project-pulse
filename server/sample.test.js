'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { cleanProject, createApi } = require('./api');
const { addSample, removeSample, isNew, SAMPLE_ID: ID } = require('./sample');

const SOURCE = path.join(__dirname, '..', 'sample');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-sample-'));
const json = (...parts) => JSON.parse(fs.readFileSync(path.join(...parts), 'utf8'));
const weekday = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();
const sourceReports = () => fs.readdirSync(SOURCE).filter((n) => /^report-\d+\.json$/.test(n)).map((n) => json(SOURCE, n));
const listed = (data) => json(data, 'projects.json').projects.map((p) => p.id);

test('a new folder gets the project, its reports and the logo, dated to this week', () => {
  const data = tmp();
  assert.ok(isNew(data));
  const result = addSample(data, '2030-05-15'); // a Wednesday
  assert.deepStrictEqual(result, { added: true, reports: 6, logo: true });
  assert.ok(!isNew(data));
  assert.deepStrictEqual(listed(data), [ID]);

  const files = fs.readdirSync(path.join(data, 'reports', ID)).sort();
  assert.strictEqual(files.length, 6);
  assert.strictEqual(files[5], `20300509_${ID}_report.json`); // the Thursday before
  const newest = json(data, 'reports', ID, files[5]);
  assert.strictEqual(newest.reportDate, '2030-05-09');
  assert.strictEqual(newest.nextReportDate, '2030-05-16');
  assert.strictEqual(newest.status, 'at-risk');

  const project = json(data, 'projects', `${ID}.json`);
  assert.strictEqual(weekday(project.startDate), 1); // weeks moved whole: still a Monday
  assert.strictEqual(weekday(project.endDate), 5);
  assert.ok(project.startDate < newest.reportDate && newest.reportDate < project.endDate);
  assert.ok(fs.existsSync(path.join(data, 'brand', 'org-logo.svg')));
});

test('a report due today is the newest', () => {
  const data = tmp();
  addSample(data, '2030-05-16'); // a Thursday
  assert.ok(fs.existsSync(path.join(data, 'reports', ID, `20300516_${ID}_report.json`)));
});

test('the server shows the sample like any other project', async () => {
  const data = tmp();
  addSample(data, '2030-05-15');
  const api = createApi({ dataDir: data, reportsDir: path.join(data, 'reports') });
  const server = http.createServer((req, res) => api(req, res) || res.writeHead(404).end());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const { projects } = await (await fetch(`${base}/api/projects`)).json();
    assert.strictEqual(projects.length, 1);
    assert.strictEqual(projects[0].customer, 'Acme Inc. (sample data)');
    assert.deepStrictEqual(projects[0].reports.map((r) => r.status), ['at-risk', 'at-risk', 'delayed', 'at-risk', 'on-track', 'on-track']);
    assert.deepStrictEqual(projects[0].reports.map((r) => r.locked), [false, false, true, true, true, true]);
    assert.deepStrictEqual(projects[0].reports[0].actions, { ASK: 2, APPROVAL: 1, DIRECTIVE: 1, FYI: 2 });
    const logo = await fetch(`${base}/brand/org-logo`);
    assert.strictEqual(logo.status, 200);
    assert.strictEqual(logo.headers.get('content-type'), 'image/svg+xml');
    const report = await fetch(`${base}/data/reports/${ID}/${projects[0].reports[5].json}`);
    const old = await report.json();
    assert.strictEqual(old.lockedAt, `${old.reportDate}T09:00:00.000Z`);
  } finally {
    server.close();
  }
});

test('adding again changes nothing, and other data stays', () => {
  const data = tmp();
  fs.writeFileSync(path.join(data, 'projects.json'), JSON.stringify({ projects: [{ id: 'mine', name: 'Mine' }] }));
  fs.mkdirSync(path.join(data, 'brand'));
  fs.writeFileSync(path.join(data, 'brand', 'org-logo.png'), 'my logo');

  assert.strictEqual(addSample(data, '2030-05-15').logo, false); // keeps the logo there
  assert.deepStrictEqual(fs.readdirSync(path.join(data, 'brand')), ['org-logo.png']);
  assert.deepStrictEqual(listed(data), ['mine', ID]);

  const before = fs.readFileSync(path.join(data, 'projects', `${ID}.json`), 'utf8');
  assert.deepStrictEqual(addSample(data, '2031-01-01'), { added: false });
  assert.strictEqual(fs.readFileSync(path.join(data, 'projects', `${ID}.json`), 'utf8'), before);
});

test('a project list that cannot be read is an error and is not overwritten', () => {
  const data = tmp();
  fs.writeFileSync(path.join(data, 'projects.json'), 'not json');
  assert.throws(() => addSample(data), SyntaxError);
  assert.throws(() => removeSample(data), SyntaxError);
  assert.strictEqual(fs.readFileSync(path.join(data, 'projects.json'), 'utf8'), 'not json');
});

test('removing takes only the sample, and the folder is no longer new', () => {
  const data = tmp();
  fs.writeFileSync(path.join(data, 'projects.json'), JSON.stringify({ projects: [{ id: 'mine', name: 'Mine' }] }));
  fs.mkdirSync(path.join(data, 'projects'));
  fs.writeFileSync(path.join(data, 'projects', 'mine.json'), '{}');
  fs.mkdirSync(path.join(data, 'reports', 'mine'), { recursive: true });
  fs.writeFileSync(path.join(data, 'reports', 'mine', `20300101_mine_report.json`), '{}');
  addSample(data, '2030-05-15');
  const drafts = path.join(data, 'drafts');
  fs.mkdirSync(drafts, { recursive: true });
  for (const n of [`project-${ID}.json`, `report-${ID}-x.json`, 'project-mine.json', 'new-project.json']) fs.writeFileSync(path.join(drafts, n), '{}');

  assert.deepStrictEqual(removeSample(data), { removed: true, reports: 6, logo: true });
  assert.deepStrictEqual(listed(data), ['mine']);
  assert.ok(!fs.existsSync(path.join(data, 'projects', `${ID}.json`)));
  assert.ok(!fs.existsSync(path.join(data, 'reports', ID)));
  assert.ok(!fs.existsSync(path.join(data, 'brand', 'org-logo.svg')));
  assert.ok(fs.existsSync(path.join(data, 'projects', 'mine.json')));
  assert.ok(fs.existsSync(path.join(data, 'reports', 'mine', '20300101_mine_report.json')));
  assert.deepStrictEqual(fs.readdirSync(drafts).sort(), ['new-project.json', 'project-mine.json']);

  assert.deepStrictEqual(removeSample(data), { removed: false, reports: 0, logo: false });
  const only = tmp();
  addSample(only, '2030-05-15');
  removeSample(only);
  assert.deepStrictEqual(listed(only), []);
  assert.ok(!isNew(only), 'an update must not add the sample back');
});

test('removing keeps a logo you put in its place', () => {
  const data = tmp();
  addSample(data, '2030-05-15');
  fs.writeFileSync(path.join(data, 'brand', 'org-logo.svg'), '<svg width="1" height="1"/>');
  assert.strictEqual(removeSample(data).logo, false);
  assert.ok(fs.existsSync(path.join(data, 'brand', 'org-logo.svg')));
});

test('the sample files are what the app itself would store', () => {
  const source = json(SOURCE, 'project.json');
  assert.deepStrictEqual(cleanProject(source, ID), { project: source });

  const reports = sourceReports();
  for (const r of reports) {
    const next = new Date(Date.parse(`${r.reportDate}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
    assert.strictEqual(r.nextReportDate, next);
    assert.strictEqual(weekday(r.reportDate), 4);
    assert.strictEqual(!!r.statusReason, r.status !== 'on-track');
    assert.strictEqual(r.draft, false);
    for (const key of ['accomplishments', 'upcomingGoals', 'peopleAndProcess', 'technology']) {
      for (const item of r[key]) assert.ok(['ASK', 'APPROVAL', 'DIRECTIVE', 'FYI'].includes(item.type));
    }
  }
});

test('the sample text holds no dates, which would not move with the others', () => {
  const month = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d|\d\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b20\d\d\b|\d{1,2}\/\d{1,2}/i;
  const source = json(SOURCE, 'project.json');
  const texts = [source.name, source.description, source.customer, source.teamName, ...source.projectGoals, ...source.phases.map((p) => p.name)];
  for (const r of sourceReports()) {
    texts.push(r.statusReason || '');
    for (const key of ['accomplishments', 'upcomingGoals', 'peopleAndProcess', 'technology']) texts.push(...r[key].map((i) => i.text));
  }
  for (const text of texts) assert.ok(!month.test(text), text);
});

test('the sample logo stands alone: no fonts, links, scripts or embedded images', () => {
  const svg = fs.readFileSync(path.join(SOURCE, 'org-logo.svg'), 'utf8');
  assert.match(svg.match(/<svg\b[^>]*>/)[0], /\swidth="\d+"\s+height="\d+"/); // the PDF export needs both
  assert.ok(!/<text\b|<image\b|<script\b|<style\b|href=|font-family|url\(|data:/i.test(svg));
});
