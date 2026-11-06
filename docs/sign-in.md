# Optional sign-in

Pulse is made for one person on their own computer, and that is how it runs unless
you change it: no sign-in, and it listens only on that computer.

To share it, put it behind a sign-in proxy such as
[oauth2-proxy](https://oauth2-proxy.github.io/oauth2-proxy/) and turn sign-in on.
Pulse has no sign-in page or identity provider of its own: your proxy decides who
gets in, and tells Pulse who they are in the `X-Forwarded-User` header. **The proxy
must strip that header from what clients send**, or anyone could claim to be anyone.

## Settings

Set these in the environment, however you start Pulse. `node server/server.js` also
reads them from a `.env` next to `package.json`: see `env.example`. The installed
`pulse` command takes them from the environment only.

| Setting                   | Default            | What it does              |
|:--------------------------|:-------------------|:--------------------------|
| `PULSE_AUTH`              | `off`              | `on` requires a sign-in   |
| `PULSE_AUTH_SIGN_IN_URL`  | `/oauth2/start`    | Where your proxy signs in |
| `PULSE_AUTH_SIGN_OUT_URL` | `/oauth2/sign_out` | Where it signs out        |
| `PULSE_IDLE_MINUTES`      | `25`               | Idle time before sign-out |
| `PULSE_HOST`              | `127.0.0.1`        | The address to listen on  |
| `PULSE_ORIGIN`            | none               | The address people use    |

With sign-in off, Pulse refuses to listen on anything but this computer, and it
ignores the `X-Forwarded-User` header.

## What your proxy must do

- Put the signed-in user in `X-Forwarded-User`, and strip it from what clients send.
- Once a sign-in has lapsed, answer calls to `/api/` with a 401 or a redirect. Pulse
  then shows "Your session has ended".
- Return to the address in `rd` after signing in. Pulse always adds `?rd=<screen>`
  to the sign-in address.

## Run it

```bash
npm ci && npm run build
PULSE_AUTH=on PULSE_ORIGIN=https://pulse.example.com \
  node server/server.js --port 8080 --data /path/to/data
```

`--require-user`, `--origin` and `--host` do the same as `PULSE_AUTH=on`,
`PULSE_ORIGIN` and `PULSE_HOST`.

## What changes with sign-in on

- Every request but `/healthz` needs a signed-in user.
- Pulse signs out after the idle time without activity in any of its tabs, and
  shows "Your session has ended". **Sign in again** comes back to the same screen
  and its draft. Keep the idle time below your identity provider's own session
  limit.
- It keeps the sign-in alive while you are active.
- Each person has their own unsaved drafts, and a locked report records who locked
  it.
