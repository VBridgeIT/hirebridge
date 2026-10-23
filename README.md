# HireBridge: H-1B Compliance Tracker (pilot)

This is VBridgeIT's internal tracker for H-1B employees: their LCAs, H-1B approvals and I-9 reverification dates, with a full change history. It is the first slice of HireBridge, tested on our own cases before anyone else sees it.

- **What and why:** [docs/BRIEF.md](docs/BRIEF.md)
- **Cloudflare setup (one time):** [SETUP.md](SETUP.md)

> The tracker helps HR stay organized. It is not legal advice; our immigration attorney confirms anything that affects a filing.

## Status

| Feature | State |
|---|---|
| 1. Employee page: profile, LCAs, petitions, key dates, history | Built |
| 2. Public Access File checklist and cover sheet | Next |
| 3. Deadlines dashboard and weekly email | Planned |
| 4. Change alerts | Planned |
| 5. SOC code suggestion (Claude) | Planned |

## How it is built

- **Cloudflare Pages Functions** render plain HTML pages. There is no JavaScript in the browser and no build step.
- **Cloudflare D1** (SQLite) stores the data. The app applies its own schema changes, which live in `src/db.js`.
- **Cloudflare Access** handles sign-in with one-time email codes. The app also verifies the Access token and checks an allow-list of HR emails (`src/auth.js`).
- Every add, edit and delete is written to `audit_log` in the same transaction as the change. Edits use a version check, so two people editing the same record cannot overwrite each other.

```
functions/[[path]].js   entry point (all routes except /assets)
src/app.js              routing and page handlers
src/auth.js             Access token check and allow-list
src/db.js               schema, migrations, queries, audit log
src/fields.js           form fields and validation rules
src/status.js           current LCA/approval, key dates, record warnings
src/views/              HTML templates
src/sample.js           made-up sample employees (preview sites only)
public/                 CSS, fonts, logo
tests/unit/             node:test unit tests
tests/e2e/              Playwright end-to-end checks
```

## Running it locally

You need Node 20 or later, and Python 3 with Playwright for the end-to-end checks.

```bash
cp .dev.vars.example .dev.vars   # signs you in as hr@vbridgeit.com on localhost only
npm run dev                      # http://localhost:8790
npm test                         # unit tests
npm run test:e2e                 # starts a throwaway copy on :8791 with an empty database
```

On localhost the app signs you in as `DEV_USER_EMAIL`. That shortcut is ignored on any other hostname.

## Data rules

- No passport, I-94, visa or Social Security numbers, home addresses or dates of birth.
- Real employee data goes only into the live database, after HR has signed off on the preview.
- Preview links use a separate database. They can load clearly marked sample employees, whose case and receipt numbers are made up and use 999 / 9999 patterns.
