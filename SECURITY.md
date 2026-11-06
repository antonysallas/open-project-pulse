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
2. Use **Report a vulnerability** on the repository's Security tab.
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

Open Project Pulse runs on your own computer and listens only on the loopback
address. By default it has no sign-in: anyone with an account on that computer who
can reach the port can use it, and it refuses to listen on any other address. To
share it, put it behind a sign-in proxy that strips `X-Forwarded-User` from what
clients send, and set `PULSE_AUTH=on`: see `docs/sign-in.md`.

All data stays on your machine.

### Report Data

Projects and reports (JSON and PDF) are saved in the data folder,
`~/.local/share/open-project-pulse/data` by default, readable only by your
user. These files may contain customer names, project names and status
information. Treat them according to your organization's data handling
policies.

### Installer

`install.sh` checks a SHA-256 checksum on what it downloads. The checksum comes
from the same place as the download, so it catches damaged downloads, not a
compromised source. You can read the script before you run it.

### Dependencies

This project uses third-party npm packages. Keep dependencies up to date
by running `npm audit` periodically and applying fixes with
`npm audit fix`.

## Security Updates

Security updates will be released as patch versions. Subscribe to
repository releases to receive notifications of security updates.
