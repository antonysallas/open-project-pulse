# Security Policy

## Supported Versions

| Version | Supported          |
|:--------|:-------------------|
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in
Open Project Pulse, please report it responsibly.

### How to Report

1. **Do NOT open a public issue** for security vulnerabilities.
2. Email the maintainers directly at the email address listed in the
   repository.
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48
  hours.
- **Assessment**: We will assess the vulnerability and determine its
  severity.
- **Fix Timeline**: Critical vulnerabilities will be addressed as quickly
  as possible. We aim to release a fix within 7-14 days for critical
  issues.
- **Disclosure**: We will coordinate with you on public disclosure timing.

## Security Considerations

Open Project Pulse is a local-only web application. All data stays on
your machine. There are no external API calls or remote data storage.

### Report Data

Generated reports (JSON and PDF) are saved to the local `reports/`
directory. These files may contain project names, team names, and status
information. Treat them according to your organization's data handling
policies.

### Dependencies

This project uses third-party npm packages. Keep dependencies up to date
by running `npm audit` periodically and applying fixes with
`npm audit fix`.

## Security Updates

Security updates will be released as patch versions. Subscribe to
repository releases to receive notifications of security updates.
