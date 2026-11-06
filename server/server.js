'use strict';
// Open Project Pulse's server: the built app (build/) plus the API in api.js, one
// process, Node built-ins only. `pulse` (bin/pulse.js) starts it for one person on
// their own computer, or run it directly behind a sign-in proxy (docs/sign-in.md).
//
//   node server/server.js --port 8080 --data /path/to/data \
//       [--host H] [--origin https://pulse.example.com] [--require-user] [--build DIR]
//
// Sign-in is off unless PULSE_AUTH=on (or --require-user), and with it off the
// server answers only requests addressed to this machine and will not listen beyond
// it, so a web page can't reach the reports by pointing its own domain at 127.0.0.1
// (DNS rebinding). With it on, every request but /healthz needs X-Forwarded-User,
// which only the sign-in proxy in front sets; the proxy must strip it from clients.
// Hashed files under static/ are cached for a year, everything else is revalidated.
// Every response carries a CSP that allows only this origin.
const fs = require('fs');
const http = require('http');
const path = require('path');
const { parseArgs } = require('util');
const { createApi } = require('./api');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json',
};
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
const SECURITY = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

function serveStatic(buildDir, req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  let rel;
  try {
    rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  let file = path.resolve(buildDir, `.${rel}`);
  if (file !== buildDir && !file.startsWith(buildDir + path.sep)) {
    res.writeHead(404).end();
    return;
  }
  // A path with no file extension that does not exist is the page itself.
  if (rel === '/' || (!path.extname(rel) && !fs.existsSync(file))) file = path.join(buildDir, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('not found');
      return;
    }
    const hashed = rel.startsWith('/static/');
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}

const LOOPBACK = ['127.0.0.1', 'localhost', '::1'];
const localHosts = (port, origin) => [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`, ...(origin ? [new URL(origin).host] : [])];

// The settings, from the environment. Everything is optional: with nothing set,
// Pulse has no sign-in and listens only on this computer.
function readSettings(env = process.env) {
  const mode = (env.PULSE_AUTH || 'off').toLowerCase();
  if (mode !== 'on' && mode !== 'off') throw new Error('PULSE_AUTH must be on or off.');
  const idleMinutes = Number(env.PULSE_IDLE_MINUTES || 25);
  if (!Number.isInteger(idleMinutes) || idleMinutes < 2) throw new Error('PULSE_IDLE_MINUTES must be a whole number of 2 or more.');
  const host = env.PULSE_HOST || '127.0.0.1';
  if (mode === 'off' && !LOOPBACK.includes(host)) {
    throw new Error(`With sign-in off, Pulse listens only on this computer, not on ${host}. Anyone who could reach it could read and change every report. Set PULSE_AUTH=on behind a sign-in proxy: see docs/sign-in.md.`);
  }
  return {
    auth: mode === 'on' ? {
      signInUrl: env.PULSE_AUTH_SIGN_IN_URL || '/oauth2/start',
      signOutUrl: env.PULSE_AUTH_SIGN_OUT_URL || '/oauth2/sign_out',
      idleMinutes,
    } : null,
    host,
    origin: env.PULSE_ORIGIN || null,
  };
}

function createServer({ buildDir, dataDir, auth = null, origin = null, maxBody, log = console.log }) {
  buildDir = path.resolve(buildDir);
  const api = createApi({ dataDir, reportsDir: path.join(dataDir, 'reports'), auth, origin, maxBody, log });
  const server = http.createServer((req, res) => {
    for (const [name, value] of Object.entries(SECURITY)) res.setHeader(name, value);
    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
      return;
    }
    if (auth) {
      if (!req.headers['x-forwarded-user']) {
        res.writeHead(403, { 'Content-Type': 'text/plain' }).end('sign in first');
        return;
      }
    } else if (!localHosts(server.address().port, origin).includes(req.headers.host)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' }).end('wrong host');
      return;
    }
    if (!api(req, res)) serveStatic(buildDir, req, res);
  });
  return server;
}

const DEFAULT_BUILD = path.join(__dirname, '..', 'build');

function startServer({ port, data, build = DEFAULT_BUILD, settings = readSettings(), onListening }) {
  if (!fs.existsSync(path.join(build, 'index.html'))) {
    console.error(`no build at ${build}: run npm run build first`);
    process.exit(1);
  }
  const server = createServer({ buildDir: build, dataDir: data, auth: settings.auth, origin: settings.origin });
  server.on('error', (err) => {
    console.error(err.code === 'EADDRINUSE' ? `Port ${port} is already in use. Is Pulse already running? Pick another port with --port.` : err.message);
    process.exit(1);
  });
  server.listen(Number(port), settings.host, onListening);
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  return server;
}

function main() {
  const envFile = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envFile) && process.loadEnvFile) process.loadEnvFile(envFile);
  const { values } = parseArgs({
    options: {
      port: { type: 'string' },
      host: { type: 'string' },
      data: { type: 'string' },
      build: { type: 'string', default: DEFAULT_BUILD },
      origin: { type: 'string' },
      'require-user': { type: 'boolean', default: false },
    },
  });
  const port = values.port || process.env.PULSE_PORT;
  const data = values.data || process.env.PULSE_DATA;
  if (!port || !data) {
    console.error('usage: server.js --port PORT --data DIR [--host H] [--origin URL] [--require-user] [--build DIR]');
    process.exit(2);
  }
  const settings = readSettings({
    ...process.env,
    ...(values.host ? { PULSE_HOST: values.host } : {}),
    ...(values.origin ? { PULSE_ORIGIN: values.origin } : {}),
    ...(values['require-user'] ? { PULSE_AUTH: 'on' } : {}),
  });
  startServer({
    port, data, build: values.build, settings,
    onListening: () => console.log(`Open Project Pulse on http://${settings.host}:${port} (data ${data}, sign-in ${settings.auth ? 'on' : 'off'})`),
  });
}

if (require.main === module) main();

module.exports = { createServer, readSettings, startServer };
