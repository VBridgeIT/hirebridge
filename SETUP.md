# Setting up the H-1B Tracker on Cloudflare

This is a one-time setup, done in the Cloudflare dashboard with the same account as vbridgeit.com. It takes about 20 minutes, and everything used is on the free plan. Cloudflare Zero Trust needs a card on file, but the free plan is not charged.

You will create:

| Piece | What it is for |
|---|---|
| Two D1 databases | One for live data, and one for preview (test) links, so testing never touches real records |
| A Pages project | Hosts the app from this GitHub repo |
| A Cloudflare Access application | The sign-in screen. Each HR user gets a one-time code by email |

## 1. Create the databases

1. Go to **Workers & Pages → D1 SQL Database → Create database**.
2. Create one named `hirebridge`.
3. Create a second one named `hirebridge-preview`.

You do not need to create any tables. The app sets them up itself the first time it runs.

## 2. Create the Pages project

1. Go to **Workers & Pages → Create → Pages → Connect to Git**, and choose **VBridgeIT/hirebridge**.
2. Use these build settings:
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `public`
3. Click **Save and Deploy**. The first deploy will show "The tracker is not set up yet" until steps 3 to 5 are done. That is expected.

## 3. Connect the databases

1. In the Pages project, go to **Settings → Bindings → Add → D1 database**.
2. For **Production**, set the variable name to `DB` and choose the `hirebridge` database.
3. Switch to **Preview** and add the same binding again: variable name `DB`, database `hirebridge-preview`.

## 4. Turn on sign-in (Cloudflare Access)

1. Open **Zero Trust** from the dashboard sidebar. If asked, pick a team name such as `vbridgeit` and the **Free** plan.
2. Go to **Settings → Authentication**. Check that **One-time PIN** is listed as a login method; it is on by default.
3. Go to **Access → Applications → Add an application → Self-hosted**, and fill it in:
   - **Application name:** H-1B Tracker
   - **Session duration:** 8 hours
   - **Public hostnames:** add both of these:
     - `hirebridge.pages.dev`
     - `*.hirebridge.pages.dev`, which covers preview links
   - **Policy:** name it "HR users", set the action to **Allow**, and add an **Include** rule of type **Emails** listing each HR user's work email. For example, `hr@vbridgeit.com` and `ravitej@vbridgeit.com`.
4. Save the application, then open it again. Copy the **Application Audience (AUD) Tag**, which is a long string of letters and numbers.
5. Go to **Settings → Custom Pages** (or the Zero Trust overview) and note your **team domain**. It looks like `vbridgeit.cloudflareaccess.com`.

## 5. Add the settings

In the Pages project, go to **Settings → Variables and Secrets**.

**Production**

| Name | Value |
|---|---|
| `ACCESS_TEAM_DOMAIN` | Your team domain, e.g. `vbridgeit.cloudflareaccess.com` |
| `ACCESS_AUD` | The AUD tag from step 4 (add it as a **Secret**) |
| `ALLOWED_EMAILS` | The same emails as the Access policy, separated by commas |

**Preview**

Add the same three settings, plus one more:

| Name | Value |
|---|---|
| `ALLOW_SAMPLE_DATA` | `1`. This shows the "Load sample data" button on preview links only |

Never set `ALLOW_SAMPLE_DATA` or `DEV_USER_EMAIL` for Production.

## 6. Redeploy and check

1. Go to **Deployments**, open the latest one, and click **Retry deployment** so the settings take effect.
2. Open `https://hirebridge.pages.dev` in a private window.
3. You should see the Cloudflare sign-in. Enter your work email and type the code you receive. You should then see the Employees page.
4. Try an email that is not on the list. Cloudflare should refuse to send a code.

## Adding or removing an HR user

Make the change in both places:

1. The Access policy (Zero Trust → Access → Applications → H-1B Tracker → Policies).
2. `ALLOWED_EMAILS` in the Pages settings, for both Production and Preview. Then redeploy.

The app checks both, so someone has to be on both lists to get in.

## If something goes wrong

| What you see | What to check |
|---|---|
| "The tracker is not set up yet" | The page names the missing setting. Add it, then redeploy |
| "Please sign in" | The Access application does not cover this address, or `ACCESS_AUD` / `ACCESS_TEAM_DOMAIN` is wrong |
| "You do not have access" | The email is in the Access policy but not in `ALLOWED_EMAILS` |
