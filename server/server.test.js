'use strict';
// npm run test:server: the production server and the
// API it shares with the dev server, against throwaway folders.
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { after, before, test } = require('node:test');
const http = require('http');
const { createServer, readSettings } = require('./server');
const { cleanProject, safeName } = require('./api');

let root, data, server, base;

before(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-test-'));
  data = path.join(root, 'data');
  const build = path.join(root, 'build');
  fs.mkdirSync(path.join(data, 'projects'), { recursive: true });
  fs.mkdirSync(path.join(build, 'static', 'js'), { recursive: true });
  fs.writeFileSync(path.join(data, 'projects.json'),
    JSON.stringify({ projects: [{ id: 'demo', name: 'Demo', detailsFile: 'projects/demo.json' }] }));
  fs.writeFileSync(path.join(data, 'projects', 'demo.json'), '{"name":"Demo details"}');
  fs.writeFileSync(path.join(build, 'index.html'), '<!doctype html><title>Pulse</title>');
  fs.writeFileSync(path.join(build, 'static', 'js', 'main.abc123.js'), 'console.log(1)');
  fs.writeFileSync(path.join(root, 'secret.txt'), 'outside');
  server = createServer({ buildDir: build, dataDir: data, maxBody: 4096, log: () => {} });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(root, { recursive: true, force: true });
});

const get = (p) => fetch(base + p);
const versionNow = async (name) => (await get(`/data/reports/demo/${encodeURIComponent(name)}`)).headers.get('x-report-version');
const post = (p, body, headers = {}) => fetch(base + p, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: base, ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

test('the page, its assets and the security headers', async () => {
  const page = await get('/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<title>Pulse/);
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(page.headers.get('cache-control'), 'no-cache');
  assert.equal((await get('/somewhere')).status, 200); // no extension: the page
  const js = await get('/static/js/main.abc123.js');
  assert.match(js.headers.get('cache-control'), /immutable/);
  assert.equal((await get('/static/js/missing.js')).status, 404);
});

test('project files', async () => {
  assert.equal((await (await get('/data/projects.json')).json()).projects[0].id, 'demo');
  assert.equal((await (await get('/data/projects/demo.json')).json()).name, 'Demo details');
  assert.equal((await get('/data/projects/nope.json')).status, 404);
});

test('save a report, list it, read it back', async () => {
  assert.deepEqual(await (await get('/api/projects/demo/reports')).json(), { reports: [] });
  const saved = await post('/api/reports/demo', { filename: '20310515_demo_report.json', data: { status: 'on-track' } });
  assert.equal(saved.status, 200);
  await post('/api/reports/demo', { filename: '20310508_demo_report.json', data: { status: 'at-risk' } });
  const { reports } = await (await get('/api/projects/demo/reports')).json();
  assert.deepEqual(reports, ['20310515_demo_report.json', '20310508_demo_report.json']);
  assert.equal((await (await get('/data/reports/demo/20310515_demo_report.json')).json()).status, 'on-track');
});

test('save a PDF; anything else is refused', async () => {
  const pdf = Buffer.from('%PDF-1.4 test').toString('base64');
  const ok = await post('/api/reports/demo/pdf', { filename: '20310515_demo_report.pdf', base64: pdf });
  assert.deepEqual(await ok.json(), { ok: true, filename: '20310515_demo_report.pdf' });
  const back = await get('/data/reports/demo/20310515_demo_report.pdf');
  assert.equal(back.headers.get('content-type'), 'application/pdf');
  const notPdf = Buffer.from('<html>').toString('base64');
  assert.equal((await post('/api/reports/demo/pdf', { filename: 'x.pdf', base64: notPdf })).status, 400);
  assert.equal((await post('/api/reports/demo/pdf', { filename: 'x.exe', base64: pdf })).status, 400);
});

test('nothing is written or read outside the folders', async () => {
  const res = await post('/api/reports/demo', { filename: '../../../escape_report.json', data: { x: 1 } });
  assert.equal((await res.json()).filename, 'escape_report.json');
  assert.ok(fs.existsSync(path.join(data, 'reports', 'demo', 'escape_report.json')));
  assert.ok(!fs.existsSync(path.join(root, 'escape_report.json')));
  assert.equal((await post('/api/reports/..', { filename: 'a.json', data: {} })).status, 404);
  assert.equal((await get('/data/reports/demo/..%2F..%2F..%2Fsecret.txt')).status, 404);
  assert.equal((await get('/data/projects/..%2F..%2Fsecret.txt')).status, 404);
  assert.equal((await get('/..%2Fsecret.txt')).status, 404);
  assert.equal((await get('/..%5Csecret.txt')).status, 404); // a backslash: a separator on Windows
  assert.equal((await get('/static/..%5C..%5Csecret.txt')).status, 404);
  assert.equal((await get('/static/..%2F..%2Fsecret.txt')).status, 404);
});

test('unknown project, wrong origin, not JSON, too large', async () => {
  assert.equal((await post('/api/reports/other', { filename: 'a.json', data: {} })).status, 404);
  assert.equal((await get('/api/projects/other/reports')).status, 404);
  assert.equal((await post('/api/reports/demo', { filename: 'a.json', data: {} }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post('/api/reports/demo', 'filename=a.json', { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post('/api/reports/demo', { filename: 'a.json', data: { pad: 'x'.repeat(5000) } })).status, 413);
  assert.equal((await post('/api/reports/demo', '{nope')).status, 400);
  assert.equal((await get('/api/whatever')).status, 404);
});

test('safeName', () => {
  assert.equal(safeName('a/b/../c d.json', '.json'), 'c_d.json');
  assert.equal(safeName('..json', '.json'), null);
  assert.equal(safeName('.hidden.json', '.json'), 'hidden.json');
  assert.equal(safeName('x.pdf', '.json'), null);
  assert.equal(safeName(42, '.json'), null);
});

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const project = (extra = {}) => ({
  id: 'example-project', name: 'Acme Portal', customer: 'Acme Inc.', teamName: 'Web team',
  startDate: '2031-04-07', endDate: '2031-06-22', deliveryModel: 'sprint', sprintDuration: 2,
  sprints: [{ name: 'Sprint 1', startDate: '2031-04-07', endDate: '2031-04-20' }, { name: '', startDate: '2031-04-21', endDate: '2031-05-04' }],
  projectGoals: ['Customers can sign in', '  ', 'Train the support team'], ...extra,
});
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(data, p), 'utf8'));

test('every project with a summary of its reports', async () => {
  const { projects } = await (await get('/api/projects')).json();
  assert.equal(projects.length, 1);
  const [demo] = projects;
  assert.equal(demo.id, 'demo');
  assert.equal(demo.name, 'Demo details'); // details merged over the list entry
  assert.equal(demo.hasLogo, false);
  const newest = demo.reports.find((r) => r.json === '20310515_demo_report.json');
  assert.deepEqual(newest, { json: '20310515_demo_report.json', pdf: '20310515_demo_report.pdf', date: '2031-05-15', status: 'on-track', draft: false, locked: false, reason: '', actions: {} });
  assert.equal(demo.reports.find((r) => r.json === '20310508_demo_report.json').pdf, null);
});

test('create a project', async () => {
  const res = await post('/api/projects', { project: project({ logo: PNG, logoName: 'example.png', extra: 'dropped' }) });
  assert.equal(res.status, 201);
  const { project: saved } = await res.json();
  assert.equal(saved.hasLogo, true);
  assert.equal(saved.logo, undefined);
  const details = readJson('projects/example-project.json');
  assert.equal(details.status, 'in-progress');
  assert.equal(details.extra, undefined);
  assert.equal(details.logo, PNG);
  assert.deepEqual(details.projectGoals, ['Customers can sign in', 'Train the support team']);
  assert.deepEqual(details.sprints[1], { number: 2, name: 'Sprint 2', startDate: '2031-04-21', endDate: '2031-05-04' });
  assert.deepEqual(readJson('projects.json').projects[1], {
    id: 'example-project', name: 'Acme Portal', description: '', customer: 'Acme Inc.', status: 'in-progress', detailsFile: 'projects/example-project.json',
  });
  const listed = (await (await get('/api/projects')).json()).projects.find((p) => p.id === 'example-project');
  assert.equal(listed.hasLogo, true);
  assert.equal(listed.logo, undefined);
  assert.deepEqual(listed.reports, []);
  assert.equal((await get('/data/projects/example-project.json')).status, 200);
});

test('a new project is refused when it is not valid', async () => {
  const refused = async (body, status = 400) => {
    const res = await post('/api/projects', body);
    assert.equal(res.status, status, JSON.stringify(body));
    return (await res.json()).error;
  };
  assert.match(await refused({ project: project() }, 409), /already exists/);
  assert.match(await refused({ project: project({ id: 'Has_Underscore' }) }), /lowercase/);
  assert.match(await refused({ project: project({ id: 'ends-' }) }), /lowercase/);
  assert.match(await refused({ project: project({ id: 'n1', name: ' ' }) }), /project name/);
  assert.match(await refused({ project: project({ id: 'n1', endDate: '2031-04-01' }) }), /after the start/);
  assert.match(await refused({ project: project({ id: 'n1', startDate: '2031-02-30' }) }), /after the start/);
  assert.match(await refused({ project: project({ id: 'n1', deliveryModel: 'milestone' }) }), /at least one phase/);
  assert.match(await refused({ project: project({ id: 'n1', deliveryModel: 'milestone', phases: [{ name: '', startDate: '2031-04-07', endDate: '2031-05-01' }] }) }), /phase needs a name/);
  assert.match(await refused({ project: project({ id: 'n1', sprints: [{ startDate: '2031-04-10', endDate: '2031-04-09' }] }) }), /sprint needs/);
  assert.match(await refused({ project: project({ id: 'n1', logo: 'data:text/html;base64,PGgxPg==' }) }), /logo/);
  assert.match(await refused({ project: project({ id: 'n1', sprintDuration: 9 }) }), /1 to 8/);
  assert.match(await refused({ nope: 1 }), /missing project/);
  assert.equal((await post('/api/projects', { project: project({ id: 'n1' }) }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post('/api/projects', 'x', { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal(readJson('projects.json').projects.length, 2);
  assert.ok(!fs.existsSync(path.join(data, 'projects', 'n1.json')));
});

test('sprint goals are kept on sprints only, up to 50 characters', () => {
  const sprints = [
    { name: 'Sprint 1', startDate: '2031-04-07', endDate: '2031-04-20', goal: '  First goal ', tentative: false },
    { name: 'Sprint 2', startDate: '2031-04-21', endDate: '2031-05-04', goal: 'x'.repeat(80), tentative: true },
    { name: 'Sprint 3', startDate: '2031-05-05', endDate: '2031-05-18', tentative: true },
  ];
  const { project } = cleanProject({ name: 'S', startDate: '2031-04-07', endDate: '2031-05-18', deliveryModel: 'sprint', sprints }, 's');
  assert.deepEqual(project.sprints.map((x) => [x.goal, x.tentative]), [['First goal', undefined], ['x'.repeat(50), true], [undefined, undefined]]);
  const phased = cleanProject({ name: 'P', startDate: '2031-04-07', endDate: '2031-05-18', deliveryModel: 'milestone', phases: [{ ...sprints[0], name: 'Build' }] }, 'p');
  assert.equal(phased.project.phases[0].goal, undefined);
});

test('change a project: phases, then mark it completed and reopen it', async () => {
  const phases = [{ name: 'Discovery', startDate: '2031-04-07', endDate: '2031-04-30' }, { name: 'Build', startDate: '2031-05-01', endDate: '2031-06-22' }];
  const res = await post('/api/projects/example-project', { project: { id: 'renamed', name: 'Renamed Portal', deliveryModel: 'milestone', phases } });
  assert.equal(res.status, 200);
  let details = readJson('projects/example-project.json');
  assert.equal(details.id, 'example-project'); // the id in the body is ignored
  assert.equal(details.name, 'Renamed Portal');
  assert.equal(details.customer, 'Acme Inc.'); // fields not sent are kept
  assert.equal(details.logo, PNG);
  assert.deepEqual(details.phases, phases);
  assert.equal(details.sprints, undefined);

  assert.equal((await post('/api/projects/example-project', { project: { status: 'completed' } })).status, 200);
  assert.equal(readJson('projects/example-project.json').status, 'completed');
  assert.equal(readJson('projects.json').projects.find((p) => p.id === 'example-project').status, 'completed');
  await post('/api/projects/example-project', { project: { status: 'in-progress', logo: '' } });
  details = readJson('projects/example-project.json');
  assert.equal(details.status, 'in-progress');
  assert.equal(details.logo, undefined);

  assert.equal((await post('/api/projects/example-project', { project: { status: 'archived' } })).status, 400);
  assert.equal((await post('/api/projects/missing', { project: { status: 'completed' } })).status, 404);
  assert.equal((await post('/api/projects/demo', { project: { status: 'completed' } })).status, 400); // demo has no dates
});

test('a report saved with its PDF is listed together', async () => {
  const pdf = Buffer.from('%PDF-1.4 test').toString('base64');
  const data = {
    reportDate: '2031-05-22', status: 'at-risk', statusReason: 'Waiting on <strong>the test account</strong>', draft: true,
    peopleAndProcess: [{ text: 'a', type: 'ASK' }, { text: 'b', type: 'FYI' }, { text: 'c', type: 'nonsense' }],
    technology: [{ text: 'd', type: 'ASK' }, { text: 'e', type: 'DIRECTIVE' }],
  };
  await post('/api/reports/example-project', { filename: '20310522_example-project_report.json', data });
  await post('/api/reports/example-project/pdf', { filename: '20310522_example-project_report.pdf', base64: pdf });
  const { projects } = await (await get('/api/projects')).json();
  assert.deepEqual(projects.find((p) => p.id === 'example-project').reports, [
    {
      json: '20310522_example-project_report.json', pdf: '20310522_example-project_report.pdf', date: '2031-05-22', status: 'at-risk', draft: true, locked: false,
      reason: 'Waiting on <strong>the test account</strong>', actions: { ASK: 2, FYI: 1, DIRECTIVE: 1 },
    },
  ]);
});

test('a locked report takes no more saves until it is unlocked', async () => {
  const pdf = Buffer.from('%PDF-1.4 test').toString('base64');
  const file = '20310529_demo_report.json';
  const lock = (locked, filename = file) => post('/api/reports/demo/lock', { filename, locked });
  await post('/api/reports/demo', { filename: file, data: { reportDate: '2031-05-29', status: 'at-risk', draft: true } });
  assert.equal((await lock(true)).status, 409); // a draft can't be locked
  // A save can't lock a report itself.
  await post('/api/reports/demo', { filename: file, opened: file, version: await versionNow(file), data: { reportDate: '2031-05-29', status: 'at-risk', draft: false, locked: true } });
  assert.equal(readJson('reports/demo/20310529_demo_report.json').locked, undefined);

  const res = await lock(true);
  assert.equal(res.status, 200);
  const { report } = await res.json();
  assert.equal(report.locked, true);
  assert.ok(!Number.isNaN(Date.parse(report.lockedAt)));
  assert.equal(readJson('reports/demo/20310529_demo_report.json').locked, true);
  const { projects } = await (await get('/api/projects')).json();
  assert.equal(projects.find((p) => p.id === 'demo').reports.find((r) => r.json === file).locked, true);

  const refused = await post('/api/reports/demo', { filename: file, opened: file, version: await versionNow(file), data: { reportDate: '2031-05-29', status: 'on-track' } });
  assert.equal(refused.status, 409);
  assert.match((await refused.json()).error, /locked/);
  assert.equal((await post('/api/reports/demo/pdf', { filename: '20310529_demo_report.pdf', base64: pdf })).status, 409);
  assert.equal(readJson('reports/demo/20310529_demo_report.json').status, 'at-risk');
  assert.equal((await post('/api/reports/demo/pdf', { filename: '20310530_demo_report.pdf', base64: pdf })).status, 200); // another date

  const open = await (await lock(false)).json();
  assert.deepEqual([open.report.locked, open.report.lockedAt], [undefined, undefined]);
  assert.equal((await post('/api/reports/demo', { filename: file, opened: file, version: await versionNow(file), data: { reportDate: '2031-05-29', status: 'on-track' } })).status, 200);
  assert.equal((await post('/api/reports/demo/pdf', { filename: '20310529_demo_report.pdf', base64: pdf })).status, 200);

  assert.equal((await lock(true, '20310605_demo_report.json')).status, 404);
  assert.equal((await lock(true, '../projects.json')).status, 404);
  assert.equal((await post('/api/reports/other/lock', { filename: file, locked: true })).status, 404);
  assert.equal((await post('/api/reports/demo/lock', { filename: file, locked: true }, { Origin: 'https://evil.example' })).status, 403);
});

test('a draft is kept, read back and dropped', async () => {
  const draft = { savedAt: 1936000000000, state: { name: 'Example Project' } };
  const none = async () => (await (await get('/api/drafts/new-project')).json()) === null;
  assert.ok(await none());
  assert.equal((await post('/api/drafts/new-project', { draft })).status, 200);
  assert.deepEqual(await (await get('/api/drafts/new-project')).json(), draft);
  assert.ok(fs.existsSync(path.join(data, 'drafts', 'new-project.json')));

  assert.equal((await post('/api/drafts/new-project', { draft: null })).status, 200);
  assert.ok(await none());
  assert.equal((await post('/api/drafts/new-project', { draft: null })).status, 200); // already gone

  assert.equal((await post('/api/drafts/new-project', { nothing: true })).status, 400);
  assert.equal((await post('/api/drafts/..%2Fprojects', { draft })).status, 404);
  assert.equal((await post('/api/drafts/.hidden', { draft })).status, 404);
  assert.equal((await post('/api/drafts/new-project', { draft }, { Origin: 'https://evil.example' })).status, 403);
});

// A server with an empty data folder, as on a first run.
async function localServer(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-local-'));
  const build = path.join(dir, 'build');
  fs.mkdirSync(build);
  fs.writeFileSync(path.join(build, 'index.html'), '<!doctype html><title>Pulse</title>');
  const dataDir = path.join(dir, 'data');
  const local = createServer({ buildDir: build, dataDir, log: () => {} });
  await new Promise((resolve) => local.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    local.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return { dataDir, url: `http://127.0.0.1:${local.address().port}` };
}

test('the organisation logo comes from the data folder, and none is a normal answer', async (t) => {
  const { dataDir, url } = await localServer(t);
  const none = await fetch(`${url}/brand/org-logo`, { method: 'HEAD' });
  assert.equal(none.status, 204);
  assert.ok(!(none.headers.get('content-type') || '').startsWith('image/'));

  fs.mkdirSync(path.join(dataDir, 'brand'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'brand', 'org-logo.png'), 'png');
  const png = await fetch(`${url}/brand/org-logo`);
  assert.equal(png.status, 200);
  assert.equal(png.headers.get('content-type'), 'image/png');

  fs.writeFileSync(path.join(dataDir, 'brand', 'org-logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
  const svg = await fetch(`${url}/brand/org-logo`);
  assert.equal(svg.headers.get('content-type'), 'image/svg+xml');
});

test('the server answers only requests addressed to this machine', async () => {
  const { port } = server.address();
  const status = (route, host) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: route, headers: { Host: host } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    }).on('error', reject);
  });
  for (const host of [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]) assert.equal(await status('/api/projects', host), 200, host);
  assert.equal(await status('/api/projects', 'rebound.example.com'), 403);
  assert.equal(await status('/api/projects', 'localhost:9'), 403);
  assert.equal(await status('/data/projects.json', 'rebound.example.com'), 403);
  assert.equal(await status('/healthz', 'rebound.example.com'), 200);
});

test('a POST from this address is fine, with or without an Origin', async () => {
  const body = { filename: '20310603_demo_report.json', data: { status: 'green' } };
  assert.equal((await post('/api/reports/demo', body)).status, 200);
  const { port } = server.address();
  assert.equal((await post('/api/reports/demo', body, { Origin: `http://localhost:${port}` })).status, 403); // reached as 127.0.0.1
  assert.equal((await post('/api/reports/demo', body, { Origin: 'null' })).status, 403);
});

test('a save survives a target that is held for a moment, as antivirus does on Windows', async (t) => {
  const { renameSync } = fs;
  let failures = 2;
  t.mock.method(fs, 'renameSync', (from, to) => {
    if (failures-- > 0) throw Object.assign(new Error('held'), { code: 'EPERM' });
    return renameSync(from, to);
  });
  const saved = await post('/api/reports/demo', { filename: '20310601_demo_report.json', data: { status: 'green' } });
  assert.equal(saved.status, 200);
  assert.equal(failures, -1);
});

test('a save that keeps failing says so and leaves no temporary file', async (t) => {
  t.mock.method(fs, 'renameSync', () => {
    throw Object.assign(new Error('held'), { code: 'EBUSY' });
  });
  const res = await post('/api/reports/demo', { filename: '20310602_demo_report.json', data: { status: 'green' } });
  assert.equal(res.status, 500);
  assert.deepEqual(fs.readdirSync(path.join(data, 'reports', 'demo')).filter((n) => n.endsWith('.tmp')), []);
});

// These use dates of their own, so they don't touch the reports above.
const saveAs = async (filename, opened, report, version) => post('/api/reports/demo', {
  filename, opened, version: version === undefined && typeof opened === 'string' ? await versionNow(opened) : version, data: report,
});
const fileOf = (name) => path.join(data, 'reports', 'demo', name);
const textOf = (name) => JSON.parse(fs.readFileSync(fileOf(name), 'utf8')).note;

test('a new report can never replace another one', async () => {
  const name = '20270107_demo_report.json';
  assert.equal((await saveAs(name, null, { draft: false, note: 'submitted' })).status, 200);
  for (const opened of [null, undefined]) {
    const res = await saveAs(name, opened, { draft: true, note: 'replacement' });
    assert.equal(res.status, 409);
    assert.match((await res.json()).error, /^There is already a report for this date/);
  }
  assert.equal(textOf(name), 'submitted');

  const draft = '20270114_demo_report.json';
  await saveAs(draft, null, { draft: true, note: 'first draft' });
  assert.equal((await saveAs(draft, null, { draft: true, note: 'second draft' })).status, 409);
  assert.equal(textOf(draft), 'first draft');
});

test('a report opened from one file can not take over another', async () => {
  const [mine, other] = ['20270121_demo_report.json', '20270128_demo_report.json'];
  await saveAs(mine, null, { draft: true, note: 'mine' });
  await saveAs(other, null, { draft: false, note: 'other' });
  assert.equal((await saveAs(other, mine, { draft: true, note: 'moved' })).status, 409);
  assert.equal(textOf(mine), 'mine');
  assert.equal(textOf(other), 'other');
});

test('a report saves to its own file, as a draft or once submitted', async () => {
  const name = '20270204_demo_report.json';
  await saveAs(name, null, { draft: true, note: 'one' });
  assert.equal((await saveAs(name, name, { draft: true, note: 'two' })).status, 200);
  assert.equal(textOf(name), 'two');
  assert.equal((await saveAs(name, name, { draft: false, note: 'three' })).status, 200);
  assert.equal((await saveAs(name, name, { draft: false, note: 'four' })).status, 200);
  assert.equal(textOf(name), 'four');
});

test('a draft saved under a new date moves, and leaves nothing behind', async () => {
  const [from, to] = ['20270211_demo_report.json', '20270218_demo_report.json'];
  await saveAs(from, null, { draft: true, note: 'moving' });
  assert.equal((await saveAs(to, from, { draft: true, note: 'moved' })).status, 200);
  assert.equal(textOf(to), 'moved');
  assert.ok(!fs.existsSync(fileOf(from)));
});

test('only a draft moves: a submitted or locked report stays', async () => {
  const [kept, locked, to1, to2] = ['20270225_demo_report.json', '20270304_demo_report.json', '20270311_demo_report.json', '20270318_demo_report.json'];
  await saveAs(kept, null, { draft: false, note: 'submitted' });
  assert.equal((await saveAs(to1, kept, { draft: true, note: 'copy' })).status, 200);
  assert.equal(textOf(kept), 'submitted');

  await saveAs(locked, null, { draft: false, note: 'presented' });
  assert.equal((await post('/api/reports/demo/lock', { filename: locked, locked: true })).status, 200);
  const before = fs.readFileSync(fileOf(locked), 'utf8');
  assert.equal((await saveAs(locked, locked, { draft: false, note: 'changed' })).status, 409);
  assert.equal((await saveAs(locked, null, { draft: true, note: 'changed' })).status, 409);
  assert.equal((await saveAs(to2, locked, { draft: true, note: 'copy' })).status, 200);
  assert.equal(fs.readFileSync(fileOf(locked), 'utf8'), before);
});

test('a refused save leaves a stored PDF alone, and a date with only a PDF is taken', async () => {
  const pdf = Buffer.from('%PDF-1.4 stored').toString('base64');
  const name = '20270325_demo_report.json';
  const stored = name.replace('.json', '.pdf');
  await saveAs(name, null, { draft: false, note: 'submitted' });
  await post('/api/reports/demo/pdf', { filename: stored, base64: pdf });
  assert.equal((await saveAs(name, null, { draft: true, note: 'replacement' })).status, 409);
  assert.equal(fs.readFileSync(fileOf(stored)).toString('base64'), pdf);

  const only = '20270401_demo_report.pdf';
  await post('/api/reports/demo/pdf', { filename: only, base64: pdf });
  assert.equal((await saveAs(only.replace('.pdf', '.json'), null, { draft: true, note: 'x' })).status, 409);
  assert.ok(!fs.existsSync(fileOf(only.replace('.pdf', '.json'))));
});

test('what a save opened can only name a report in its own folder', async () => {
  assert.equal((await saveAs('20270408_demo_report.json', 42, { draft: true })).status, 400);
  assert.equal((await saveAs('20270408_demo_report.json', '../../projects/demo.json', { draft: true })).status, 409);
  assert.ok(fs.existsSync(path.join(data, 'projects', 'demo.json')));
  assert.equal((await saveAs('20270415_demo_report.json', 'not-a-report.txt', { draft: true })).status, 400);
});

test('a save based on a version that has changed is refused', async () => {
  const name = '20270422_demo_report.json';
  const first = await (await saveAs(name, null, { draft: true, note: 'one' })).json();
  assert.equal(first.version, await versionNow(name));
  const seen = first.version; // both editors opened this version
  const other = await saveAs(name, name, { draft: true, note: 'saved elsewhere' }, seen);
  assert.equal(other.status, 200);
  const res = await saveAs(name, name, { draft: true, note: 'mine' }, seen);
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /changed somewhere else/);
  assert.equal(textOf(name), 'saved elsewhere');
  // Having seen the latest version, it can be saved.
  assert.equal((await saveAs(name, name, { draft: true, note: 'mine' }, await versionNow(name))).status, 200);
  assert.equal(textOf(name), 'mine');
});

test('a save with no version, or of a file that has gone, is refused', async () => {
  const name = '20270429_demo_report.json';
  await saveAs(name, null, { draft: true, note: 'one' });
  assert.equal((await saveAs(name, name, { draft: true, note: 'two' }, null)).status, 409);
  assert.equal(textOf(name), 'one');
  const [from, to, again] = ['20270506_demo_report.json', '20270513_demo_report.json', '20270520_demo_report.json'];
  await saveAs(from, null, { draft: true, note: 'moving' });
  const seen = await versionNow(from);
  assert.equal((await saveAs(to, from, { draft: true, note: 'moved' }, seen)).status, 200);
  assert.equal((await saveAs(from, from, { draft: true, note: 'back' }, seen)).status, 409);
  assert.equal((await saveAs(again, from, { draft: true, note: 'elsewhere' }, seen)).status, 409);
  assert.ok(!fs.existsSync(fileOf(from)) && !fs.existsSync(fileOf(again)));
});

test('a draft changed elsewhere does not move, and a PDF is no part of a version', async () => {
  const [from, to] = ['20270527_demo_report.json', '20270603_demo_report.json'];
  const { version } = await (await saveAs(from, null, { draft: true, note: 'one' })).json();
  await saveAs(from, from, { draft: true, note: 'two' }, version);
  assert.equal((await saveAs(to, from, { draft: true, note: 'moved' }, version)).status, 409);
  assert.equal(textOf(from), 'two');
  assert.ok(!fs.existsSync(fileOf(to)));

  const pdf = Buffer.from('%PDF-1.4 stored').toString('base64');
  const seen = await versionNow(from);
  await post('/api/reports/demo/pdf', { filename: from.replace('.json', '.pdf'), base64: pdf });
  assert.equal(await versionNow(from), seen);
});

test('a form hears whether it is open anywhere else, with no name attached', async (t) => {
  const beat = async (key, tab, leaving = false) => (await (await post(`/api/editing/${key}`, { tab, leaving })).json()).others;
  assert.equal(await beat('report-demo-a', 'one'), 0);
  assert.equal(await beat('report-demo-a', 'two'), 1);
  assert.equal(await beat('report-demo-a', 'one'), 1);
  assert.equal(await beat('report-demo-b', 'three'), 0); // another form
  await beat('report-demo-a', 'two', true);
  assert.equal(await beat('report-demo-a', 'one'), 0);

  // A tab that vanished without saying so stops counting.
  await beat('report-demo-c', 'gone');
  const now = Date.now();
  t.mock.method(Date, 'now', () => now + 91000);
  assert.equal(await beat('report-demo-c', 'still'), 0);
  t.mock.restoreAll();

  assert.equal((await post('/api/editing/..%2Fprojects', { tab: 'one' })).status, 404);
  assert.equal((await post('/api/editing/report-demo-a', { tab: '../x' })).status, 400);
  assert.equal((await post('/api/editing/report-demo-a', {})).status, 400);
  assert.equal((await post('/api/editing/report-demo-a', { tab: 'one' }, { Origin: 'https://evil.example' })).status, 403);
});

test('with nothing set there is no sign-in, and Pulse stays on this computer', () => {
  assert.deepEqual(readSettings({}), { auth: null, host: '127.0.0.1', origin: null });
  assert.throws(() => readSettings({ PULSE_HOST: '0.0.0.0' }), /only on this computer/);
  assert.throws(() => readSettings({ PULSE_AUTH: 'maybe' }), /on or off/);
  assert.throws(() => readSettings({ PULSE_AUTH: 'on', PULSE_IDLE_MINUTES: '1' }), /IDLE_MINUTES/);
  assert.equal(readSettings({ PULSE_AUTH: 'on', PULSE_HOST: '0.0.0.0' }).host, '0.0.0.0');
});

test('with sign-in on, its addresses default to paths', () => {
  assert.deepEqual(readSettings({ PULSE_AUTH: 'on' }).auth, { signInUrl: '/oauth2/start', signOutUrl: '/oauth2/sign_out', idleMinutes: 25 });
  assert.deepEqual(readSettings({
    PULSE_AUTH: 'ON', PULSE_AUTH_SIGN_IN_URL: '/login', PULSE_AUTH_SIGN_OUT_URL: '/logout', PULSE_IDLE_MINUTES: '10',
  }).auth, { signInUrl: '/login', signOutUrl: '/logout', idleMinutes: 10 });
});

test('with sign-in off, a sign-in header means nothing', async () => {
  const someone = { 'X-Forwarded-User': 'someone' };
  assert.deepEqual(await (await fetch(`${base}/api/session`, { headers: someone })).json(), { auth: false, user: null });
  const name = '20270610_demo_report.json';
  await saveAs(name, null, { draft: false, note: 'one' });
  const { report } = await (await post('/api/reports/demo/lock', { filename: name, locked: true }, someone)).json();
  assert.equal(report.locked, true);
  assert.equal(report.lockedBy, undefined);
  await post('/api/drafts/header-test', { draft: { state: 1 } }, someone);
  assert.ok(fs.existsSync(path.join(data, 'drafts', 'header-test.json')));
  assert.ok(!fs.existsSync(path.join(data, 'drafts', 'someone')));
});

// The same server with sign-in on, as behind a sign-in proxy.
async function signedInServer(t, env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-signin-'));
  const build = path.join(dir, 'build');
  const dataDir = path.join(dir, 'data');
  fs.mkdirSync(build);
  fs.mkdirSync(dataDir);
  fs.writeFileSync(path.join(build, 'index.html'), '<!doctype html><title>Pulse</title>');
  fs.writeFileSync(path.join(dataDir, 'projects.json'), JSON.stringify({ projects: [{ id: 'demo', name: 'Demo' }] }));
  const settings = readSettings({ PULSE_AUTH: 'on', ...env });
  const signedIn = createServer({ buildDir: build, dataDir, auth: settings.auth, origin: settings.origin, log: () => {} });
  await new Promise((resolve) => signedIn.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    signedIn.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const url = `http://127.0.0.1:${signedIn.address().port}`;
  const as = (user) => (user ? { 'X-Forwarded-User': user } : {});
  return {
    dataDir, url,
    read: (route, user) => fetch(url + route, { headers: as(user) }),
    write: (route, body, user, headers = {}) => fetch(url + route, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...as(user), ...headers }, body: JSON.stringify(body),
    }),
  };
}

test('with sign-in on, only the health check is open', async (t) => {
  const { read } = await signedInServer(t);
  assert.equal((await read('/healthz')).status, 200);
  assert.equal((await read('/')).status, 403);
  assert.equal((await read('/data/projects.json')).status, 403);
  assert.equal((await read('/api/session')).status, 403);
  assert.equal((await read('/')).headers.get('x-report-version'), null);
  assert.equal((await read('/', 'test-user')).status, 200);
});

test('with sign-in on, the app hears who it is and where to sign in and out', async (t) => {
  const plain = await signedInServer(t);
  assert.deepEqual(await (await plain.read('/api/session', 'test-user')).json(), {
    auth: true, user: 'test-user', signInUrl: '/oauth2/start', signOutUrl: '/oauth2/sign_out', idleMinutes: 25,
  });
  const custom = await signedInServer(t, { PULSE_AUTH_SIGN_IN_URL: '/login', PULSE_AUTH_SIGN_OUT_URL: '/logout', PULSE_IDLE_MINUTES: '10' });
  const session = await (await custom.read('/api/session', 'test-user')).json();
  assert.deepEqual([session.signInUrl, session.signOutUrl, session.idleMinutes], ['/login', '/logout', 10]);
});

test('with sign-in on, a lock records who, and a save can not claim it', async (t) => {
  const { read, write, dataDir } = await signedInServer(t);
  const file = '20270617_demo_report.json';
  assert.equal((await write('/api/reports/demo', { filename: file, opened: null, data: { draft: false, lockedBy: 'not me' } }, 'test-user')).status, 200);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, 'reports', 'demo', file), 'utf8')).lockedBy, undefined);
  const locked = await (await write('/api/reports/demo/lock', { filename: file, locked: true }, 'test-user')).json();
  assert.equal(locked.report.lockedBy, 'test-user');
  const open = await (await write('/api/reports/demo/lock', { filename: file, locked: false }, 'test-user')).json();
  assert.equal(open.report.lockedBy, undefined);
  assert.equal((await read(`/data/reports/demo/${file}`, 'test-user')).status, 200);
});

test('with sign-in on, each person has their own drafts', async (t) => {
  const { read, write, dataDir } = await signedInServer(t);
  const draft = { savedAt: 1, state: { name: 'Example' } };
  assert.equal((await write('/api/drafts/new-project', { draft }, 'test-user')).status, 200);
  assert.deepEqual(await (await read('/api/drafts/new-project', 'test-user')).json(), draft);
  assert.equal(await (await read('/api/drafts/new-project', 'someone-else')).json(), null);
  assert.equal(await (await read('/api/drafts/new-project', '../test-user')).json(), null);
  assert.ok(fs.existsSync(path.join(dataDir, 'drafts', 'test-user', 'new-project.json')));
});

test('with an address set, a POST from any other site is refused', async (t) => {
  const { read, write } = await signedInServer(t, { PULSE_ORIGIN: 'https://pulse.example.com' });
  const tab = { tab: 'one' };
  assert.equal((await write('/api/editing/some-form', tab, 'test-user', { Origin: 'https://pulse.example.com' })).status, 200);
  assert.equal((await write('/api/editing/some-form', tab, 'test-user', { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await read('/', 'test-user')).status, 200); // whatever Host the proxy passes on
});
