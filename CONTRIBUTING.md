# Contributing to Open Project Pulse

Thanks for helping. Use your own judgment with what follows, and if something here
is wrong or out of date, change it in a pull request.

## Code of Conduct

This project and everyone participating in it is governed by the
[Open Project Pulse Code of Conduct](CODE_OF_CONDUCT.md). By participating,
you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

A good report lets someone else see the problem for themselves.

- **Use the Issue Search** to see if the problem has already been reported.
- **Check if the issue has been fixed** by trying to reproduce it using the
  latest `main` branch.
- **Open a new Issue** and provide as much detail as possible:
  - **Use a clear and descriptive title.**
  - **Describe the exact steps which reproduce the problem.**
  - **Provide specific examples to demonstrate the steps.**
  - **Describe the behavior you observed after following the steps.**
  - **Explain which behavior you expected to see instead and why.**
  - **Include browser and Node.js version.**

### Pull Requests

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the project builds without warnings (`npm run build`).
5. Make sure your code lints.

## Development Setup

```bash
git clone <your-fork-url>
cd open-project-pulse
npm ci
npm start
```

The app runs at <http://localhost:3010>. It reads and writes `data/` in the
checkout, which git ignores. On Windows, use WSL or Git Bash, because the npm
scripts expect a Unix shell.

Before you open a pull request:

```bash
npm run test:server
CI=true npm test -- --watchAll=false
npx tsc --noEmit -p .
npx eslint --ext .ts,.tsx src
```

## Keep Real Data Out

This is a public repository. Never commit real customer, project or company
names, reports, logos or screenshots, including in tests, placeholders and
comments. Use made-up examples such as "Acme Inc.". Keep your own data in
`data/`, never in `public/` or `sample/`: both go to everyone who installs Pulse.
Anything in `sample/` must be made up, and its text must hold no dates, because
the sample's dates move when it is added. Screenshots in `docs/images` must show
only the sample project, and each one is listed by name in `.gitignore`.

## Styleguides

### Git Commit Messages

- Say what the commit does, as a command: "Fix the date on a copied report"
- Keep the first line to 72 characters
- Link the issue or pull request it belongs to, below the first line

### Code Style

- TypeScript with React functional components
- The design system in `src/styles/sallas` (vendored, don't edit it) and
  `src/styles/app.css` for Pulse's own layout
- Keep ESLint warnings at zero -- fix unused imports and variables

Run `npm run build` before submitting your PR to verify a clean build.

## License

By contributing, you agree that your contributions will be licensed under the
GNU General Public License, version 3 only.
