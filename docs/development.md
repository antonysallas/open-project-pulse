# Development

```bash
git clone https://github.com/antonysallas/open-project-pulse.git
cd open-project-pulse
npm ci
npm start              # http://localhost:3010
```

The dev server reads and writes `data/` in the checkout, with the layout in
[the reference](reference.md). Set `PULSE_DATA` to use another folder. `data/`
is not tracked. Keep your data out of `public/`: the build copies all of it into
the app. To work with the sample project, run
`node bin/pulse.js sample --data data`.

```bash
npm run test:server                  # server and API (node --test)
CI=true npm test -- --watchAll=false # dates, periods, rich text, reports, routes
npx tsc --noEmit -p .
npx eslint --ext .ts,.tsx src
```

On Windows, `npm start` and `npm run build` need a POSIX shell for the settings
in front of them, and packaging needs `sh`: use WSL or Git Bash.

## Tech stack

- React 18 and TypeScript (Create React App 5)
- The Sallas design system (`src/styles/sallas`: tokens and `s-*` component
  classes), plus `src/styles/app.css` for Pulse's own layout
- Red Hat Display, Text and Mono, self-hosted (`src/styles/redhat`, SIL OFL)
- Lucide icons (`lucide-react`)
- html2canvas and jsPDF for the PDF, and PptxGenJS for slides, loaded only when
  you export
- `server/api.js`: the API (Node built-ins), shared by the dev server and
  `server/server.js`, which `pulse` starts

## Publish a release

The installers download `open-project-pulse.tar.gz` from the latest GitHub
release. To publish one, set the version in `package.json`, then push a matching
tag.

`.github/workflows/release.yml` runs on every push to `main` and every pull
request. It runs the tests, builds the archive with `scripts/package-release.sh`,
then installs and starts it. On a tag, it also creates the release.

```bash
git tag v0.1.0
git push origin v0.1.0
```
