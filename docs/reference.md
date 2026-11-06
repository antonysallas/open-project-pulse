# File formats and server API

## The data folder

```text
data/
├── projects.json                  # the project list
├── projects/<id>.json             # one project's details
├── reports/<id>/
│   ├── YYYYMMDD_<id>_report.json  # a saved report
│   └── YYYYMMDD_<id>_report.pdf   # its PDF
├── brand/org-logo.svg             # the logo on your reports (or .png)
└── drafts/<key>.json              # an unsaved form (per user with sign-in)
```

## File formats

A project (`projects/<id>.json`):

```json
{
  "id": "acme-customer-portal",
  "name": "Customer Portal Launch",
  "customer": "Acme Inc.",
  "teamName": "Web team",
  "status": "in-progress",
  "startDate": "2031-04-07",
  "endDate": "2031-06-22",
  "deliveryModel": "sprint",
  "sprintDuration": 2,
  "sprints": [
    {
      "number": 1,
      "name": "Sprint 1",
      "startDate": "2031-04-07",
      "endDate": "2031-04-20",
      "goal": "Customers can sign in"
    }
  ],
  "projectGoals": ["Customers can pay their invoices online"],
  "logo": "data:image/png;base64,…",
  "logoName": "acme.png · 12 KB"
}
```

A phased project has `"deliveryModel": "milestone"` and
`"phases": [{ "name": "Discovery", "startDate": "…", "endDate": "…" }]` in place
of `sprints`; phases may overlap. Objectives in `projectGoals` are rich text
(below). Project IDs are lowercase letters, digits and dashes.

A report (`reports/<id>/YYYYMMDD_<id>_report.json`). For phased projects,
`upcomingGoals` holds the ongoing and outstanding tasks:

```json
{
  "reportDate": "2031-05-15",
  "nextReportDate": "2031-05-22",
  "currentPeriods": [2, 3],
  "status": "at-risk",
  "statusReason": "Billing waits on the <strong>test account</strong>.",
  "accomplishments": [{ "text": "Finished the sign-in page", "type": "FYI" }],
  "upcomingGoals": [{ "text": "Start the billing screens", "type": "FYI" }],
  "peopleAndProcess": [{ "text": "Need a second tester", "type": "ASK" }],
  "technology": [{ "text": "Approve the load test", "type": "APPROVAL" }],
  "draft": false
}
```

`currentPeriods` is there only when the phases were picked by hand. A sprint
project's report also holds `sprintGoal` and `nextSprintGoal`, and a sprint whose
goal is only planned has `"tentative": true`. Item text
and `statusReason` are rich text: a small HTML subset (`strong`, `em`, `ul`,
`ol`, `li`, `br`, `div`) that `src/utils/rich.ts` cleans before it is stored or
shown; anything else is dropped. Plain text is escaped, with a "Label:" lead
shown in bold.

## Server API

- `GET /api/projects`: every project's details (logo left out) and its saved
  reports, each with its status, reason and stakeholder items counted by type
- `POST /api/projects` `{project}`: creates a project
- `POST /api/projects/<id>` `{project}`: changes a project; fields left out are
  kept (close, reopen; stored as `"status": "completed"`)
- `GET /data/projects.json`: the project list
- `GET /data/projects/<id>.json`: one project's details, with its logo
- `GET /api/projects/<id>/reports`: saved report file names, newest first
- `GET /data/reports/<id>/<file>`: a saved report, JSON or PDF
- `POST /api/reports/<id>` `{filename, data, opened, version}`: saves a report's
  JSON. `opened` is the file it was opened from, `null` when it is new, and
  `version` is what its `X-Report-Version` header said then. A save that would
  replace any other report, or a date that has only a PDF, gets 409, and so does
  one based on a version that has changed since. A draft saved under a new date
  moves there; a submitted or locked report stays where it is.
- `POST /api/reports/<id>/pdf` `{filename, base64}`: saves its PDF
- `POST /api/reports/<id>/lock` `{filename, locked}`: locks a submitted report
  (`locked`, `lockedAt`, and `lockedBy` with sign-in on) or unlocks it. A save to
  a locked report or its PDF gets 409, and a save never sets the lock fields
  itself.
- `GET /api/session`: whether sign-in is on and, if so, who is signed in and where
  to sign in and out
- `GET /api/drafts/<key>`: an unsaved form, or `null`
- `POST /api/drafts/<key>` `{draft}`: keeps it; `{draft: null}` drops it
- `POST /api/editing/<key>` `{tab, leaving}`: says a form is open, and answers how
  many other tabs have it open. Kept in memory only, with no names.
- `GET /brand/org-logo`: your organisation's logo, or 204 when there is none

A project ID must be listed in `projects.json`, and file names are reduced to
letters, digits and `._()+-`, so nothing is written outside the data folder. The
server stores a project only with the fields it knows, after checking its dates,
periods and logo. Every POST must be JSON, and one sent by a page on another site
is refused. With sign-in off, the server answers only requests addressed to this
computer.
