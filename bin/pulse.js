#!/usr/bin/env node
'use strict';
// The `pulse` command: starts the app on this machine and looks after the
// install. install.sh puts a small launcher on the PATH that runs this file.
// Node built-ins only.
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseArgs } = require('util');
const { addSample, isNew, removeSample } = require('../server/sample');
const { startServer } = require('../server/server');

const WINDOWS = process.platform === 'win32';
const INSTALL_URL = process.env.PULSE_INSTALL_URL || `https://raw.githubusercontent.com/antonysallas/open-project-pulse/main/${WINDOWS ? 'install.ps1' : 'install.sh'}`;
const DEFAULT_PORT = '4070';
const SHARE = WINDOWS
  ? process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
  : process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
const HOME = process.env.PULSE_HOME || path.join(SHARE, 'open-project-pulse');
const APP = path.join(__dirname, '..');

const HELP = `Open Project Pulse: weekly project status reports

Usage:
  pulse [--port N] [--data DIR] [--no-open]   start Pulse and open it in your browser
  pulse logo FILE                             put your organisation's logo (SVG or PNG) on reports
  pulse logo --remove                         take it off again
  pulse sample --remove                       remove the made-up Acme project and its logo
  pulse sample                                add them back
  pulse update                               install the latest version
  pulse uninstall                             remove Pulse, keeping your data
  pulse version                               show the installed version

Your projects and reports are in ${path.join(HOME, 'data')}
`;

const dataDir = (given) => path.resolve(given || process.env.PULSE_DATA || path.join(HOME, 'data'));

function fail(message) {
  console.error(`pulse: ${message}`);
  process.exit(1);
}

function openBrowser(url) {
  if (WINDOWS) {
    spawn('cmd', ['/c', 'start', '""', url], { stdio: 'ignore', detached: true, windowsHide: true, windowsVerbatimArguments: true }).on('error', () => undefined).unref();
    return;
  }
  const command = { darwin: 'open', linux: 'xdg-open' }[process.platform];
  if (!command) return;
  // No browser here (a server, say) is fine: the address is printed anyway.
  spawn(command, [url], { stdio: 'ignore', detached: true }).on('error', () => undefined).unref();
}

function start(args) {
  const { values } = parseArgs({
    args,
    options: {
      port: { type: 'string', default: process.env.PULSE_PORT || DEFAULT_PORT },
      data: { type: 'string' },
      'no-open': { type: 'boolean', default: false },
    },
  });
  if (!/^\d+$/.test(values.port) || Number(values.port) < 1 || Number(values.port) > 65535) fail(`${values.port} is not a port number.`);
  const data = dataDir(values.data);
  fs.mkdirSync(data, { recursive: true, mode: 0o700 });
  const url = `http://localhost:${values.port}`;
  startServer({
    port: values.port,
    data,
    build: path.join(APP, 'build'),
    onListening: () => {
      console.log(`Pulse is running at ${url}\nYour data: ${data}\nPress Ctrl-C to stop.`);
      if (!values['no-open'] && process.stdout.isTTY) openBrowser(url);
    },
  });
}

function logo(args) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { remove: { type: 'boolean', default: false }, data: { type: 'string' } },
  });
  const brand = path.join(dataDir(values.data), 'brand');
  const clear = () => ['svg', 'png'].forEach((ext) => fs.rmSync(path.join(brand, `org-logo.${ext}`), { force: true }));
  if (values.remove) {
    clear();
    console.log('Logo removed. Reload Pulse to see it go.');
    return;
  }
  const file = positionals[0];
  if (!file) fail('Say which file: pulse logo path/to/logo.svg');
  const ext = path.extname(file).slice(1).toLowerCase();
  if (ext !== 'svg' && ext !== 'png') fail('The logo must be an .svg or .png file.');
  if (!fs.existsSync(file)) fail(`There is no file at ${file}.`);
  if (ext === 'svg') {
    // The PDF export can't size an SVG without these.
    const tag = (fs.readFileSync(file, 'utf8').match(/<svg\b[^>]*>/) || [''])[0];
    if (!/\swidth=/.test(tag) || !/\sheight=/.test(tag)) fail('An SVG logo needs width and height on its <svg> tag, or the PDF cannot size it. Add them, or use a PNG.');
  }
  fs.mkdirSync(brand, { recursive: true, mode: 0o700 });
  clear();
  fs.copyFileSync(file, path.join(brand, `org-logo.${ext}`));
  console.log('Logo saved. Reload Pulse to see it on your reports.');
}

function sample(args) {
  const { values } = parseArgs({
    args,
    options: {
      remove: { type: 'boolean', default: false },
      'if-new': { type: 'boolean', default: false }, // the installer's: only into an empty folder
      data: { type: 'string' },
    },
  });
  const data = dataDir(values.data);
  if (values.remove) {
    const { removed, reports, logo } = removeSample(data);
    if (!removed && !logo) console.log('The sample project is already gone.');
    else console.log(`Removed the sample project, its ${reports} reports${logo ? ' and the Acme logo' : ''}. Reload Pulse to see them go.`);
    return;
  }
  if (values['if-new'] && !isNew(data)) return;
  const { added, reports } = addSample(data);
  if (!added) console.log('The sample project is already there.');
  else console.log(`Added a made-up sample project for Acme Inc., with ${reports} reports.\nWhen you have seen enough, remove it with:  pulse sample --remove`);
}

function update() {
  const script = 'script=$(curl -LsSf "$PULSE_INSTALL_URL" 2>/dev/null || wget -qO- "$PULSE_INSTALL_URL") && printf \'%s\\n\' "$script" | sh';
  const env = { ...process.env, PULSE_INSTALL_URL: INSTALL_URL, PULSE_HOME: HOME };
  if (process.env.PULSE_LAUNCHER) env.PULSE_BIN_DIR = path.dirname(process.env.PULSE_LAUNCHER); // keep it where it was installed
  const run = WINDOWS
    ? spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072; [Net.WebRequest]::DefaultWebProxy.Credentials = [Net.CredentialCache]::DefaultNetworkCredentials; irm $env:PULSE_INSTALL_URL | iex'], { stdio: 'inherit', env })
    : spawnSync('sh', ['-c', script], { stdio: 'inherit', env });
  if (run.status !== 0) fail(`Update failed. You still have the version you had. The installer is at ${INSTALL_URL}`);
  console.log('Restart Pulse if it is running.');
}

function uninstall() {
  // Only what the installer put there: the data folder stays.
  fs.rmSync(path.join(HOME, 'app'), { recursive: true, force: true });
  const launcher = process.env.PULSE_LAUNCHER;
  if (WINDOWS) {
    // Windows can't delete node.exe or pulse.cmd while they run, so a small job
    // does it just after this exits.
    const job = ['ping -n 3 127.0.0.1 >nul', `rmdir /s /q "${path.join(HOME, 'node')}"`, ...(launcher ? [`del /f /q "${launcher}"`] : [])].join(' & ');
    spawn('cmd', ['/d', '/s', '/c', `"${job}"`], { stdio: 'ignore', detached: true, windowsHide: true, windowsVerbatimArguments: true }).unref();
  } else {
    fs.rmSync(path.join(HOME, 'node'), { recursive: true, force: true });
    if (launcher) fs.rmSync(launcher, { force: true });
  }
  console.log(`Pulse is removed. Your data is still in ${path.join(HOME, 'data')}: delete that folder yourself if you no longer want it.`);
}

function version() {
  const { version: v } = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
  console.log(`Open Project Pulse ${v}`);
}

const [command, ...rest] = process.argv.slice(2);
try {
  if (command === 'logo') logo(rest);
  else if (command === 'sample') sample(rest);
  else if (command === 'update') update();
  else if (command === 'uninstall') uninstall();
  else if (command === 'version' || command === '--version' || command === '-V') version();
  else if (command === 'help' || command === '--help' || command === '-h') process.stdout.write(HELP);
  else if (command === undefined || command.startsWith('-')) start(process.argv.slice(2));
  else fail(`I don't know "${command}". Run pulse help to see what I can do.`);
} catch (err) {
  fail(err.message);
}
