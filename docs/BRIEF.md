# H-1B Compliance Tracker: product brief

**Status:** pilot, internal to VBridgeIT only
**Owner:** RG (IT Projects Lead) · **Users:** VBridgeIT HR
**Date:** October 2026

## Why

VBridgeIT already files H-1Bs and keeps Public Access Files (PAFs) for its own employees. Today the dates and documents are spread across spreadsheets, email and the attorney's records. The tracker brings them into one place, so we stop missing deadlines and PAFs are faster to prepare.

The tracker is also the first slice of HireBridge. If it saves our own HR time, that is the evidence for the HireBridge go/no-go decision.

## Who uses it

Named HR users only. Each user signs in with a one-time code sent to their own work email (Cloudflare Access). There are no shared passwords, and no employee or outside access in the first version.

## Features, in build order

Each feature ships as its own pull request with a preview link. HR tries the preview before it goes live.

| # | Feature | What HR can do |
|---|---|---|
| 1 | **Employee page** | One page per H-1B employee, showing their LCAs, H-1B petitions, work authorization and I-9 reverification date, plus a history of every change |
| 2 | **PAF checklist** | For each LCA, tick off each required PAF item, record where notices were posted, and print a cover sheet. Incomplete files and files past their keep-until date are flagged |
| 3 | **Deadlines** | A dashboard of upcoming H-1B expiries, LCA expiries, I-9 reverifications and PAF retention dates, plus a weekly email to HR |
| 4 | **Change alerts** | When a worksite or job changes, a flag that a new notice, a new LCA or an amended petition may be needed, for our immigration attorney to confirm |
| 5 | **SOC code suggestion** | Paste a job description and Claude suggests an occupation (SOC) code, with its reasoning and a confidence level. A person always makes the final call |

## Screens (feature 1)

1. **Employees.** Shows every H-1B employee with their job title, worksite, H-1B valid-until date, I-9 reverification date and the next date that needs attention. It can be searched and filtered by Active or Former.
2. **Employee page.** Has four parts:
   - Profile
   - Work authorization and I-9
   - LCAs
   - H-1B petitions

   It also has a history of every change, showing who made it and when.
3. **Add or edit employee, LCA, petition.** These are plain forms. They check that dates are in order and that required fields are filled in.

## Data fields (feature 1)

**Employee**
- Full name, work email and employee ID (optional)
- Job title, hire date and status (active or former), with the end date if former
- Work authorization type and expiry date
- I-9 reverification date
- Notes

**LCA (Labor Condition Application)**
- Case number (I-200-YYDDD-NNNNNN) and status (certified, withdrawn or expired)
- Job title as filed and SOC code
- Begin date, end date and certified date
- Worksite address, city, state and ZIP
- Wage paid, with its unit (year or hour)
- Prevailing wage, with its level and source

**H-1B petition**
- USCIS receipt number and type (new, extension, amendment or transfer)
- Status (pending, approved, denied or withdrawn)
- Linked LCA
- Validity start and end dates

## Deliberately left out of the first version

- Passport, I-94, visa or other ID images or numbers
- Social Security numbers, home addresses and dates of birth
- E-Verify connection
- Filing anything with USCIS or the Department of Labor
- Employee self-service or outside users
- Later HireBridge modules such as timesheets, a document vault and a compliance chatbot

## Data protection

- Only named HR users can open the app. Every page needs a valid Cloudflare Access sign-in, and the app checks that sign-in itself as well.
- Every add, edit and delete is recorded with who made it and when.
- Pages are never cached, never indexed and cannot be framed by other sites.
- Testing uses made-up sample data only. Real cases go in only after HR signs off on the preview.
- Preview (test) and live use separate databases.

## How we will know it worked (60 days after go-live)

- HR uses it for every H-1B case.
- No H-1B, LCA or I-9 deadline is missed.
- Preparing a PAF takes noticeably less time than today.

## Disclaimer

The tracker helps HR stay organized. It does not give legal advice. Our immigration attorney confirms anything that affects a filing.

## Technical notes

- Hosting is a Cloudflare Worker with a Cloudflare D1 (SQLite) database, on the free plan. Preview links come from Cloudflare's Worker Previews.
- Pages are server-rendered HTML forms. They work without JavaScript and need no build step.
- The schema is plain SQL and can move to Postgres if this grows into the full HireBridge stack.
