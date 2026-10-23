# Setting up the H-1B Tracker on Cloudflare

The tracker runs as a **Cloudflare Worker** connected to this GitHub repo. It uses the same Cloudflare account as vbridgeit.com and stays on the free plan.

- Every push to `main` updates the live site.
- Every other branch, such as a pull request, gets its own **Preview** link with a separate test database.

## 1. Databases (done)

In **Storage & Databases → D1 SQL Database** there are two databases:

| Database | Used by |
|---|---|
| `hirebridge` | Live site |
| `hirebridge-preview` | Preview links |

Open each one and copy its **Database ID**, a long code like `3ab107cc-…`. Both IDs go into `wrangler.jsonc` in this repo. That file decides which database each environment uses, and it overrides anything added under **Settings → Bindings** in the dashboard.

Leave the databases empty. The tracker creates its own tables the first time it runs.

## 2. Worker and builds (done)

The Worker is called **hirebridge** and is connected to `VBridgeIT/hirebridge`. To check it, go to the Worker's **Settings → Builds**. It should show:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler preview` |
| Build command and root directory | Empty |

## 3. Turn on sign-in (Cloudflare Access)

1. In the Worker, open the **Access** tab.
2. Click **Protect this Worker behind Access**.
3. Choose **All traffic**. This protects the live site and every preview link.
4. Under **Authentication policy**, create a policy:
   - **Name:** HR users
   - **Action:** Allow
   - **Include:** Emails. List each HR user's work email, for example `hr@vbridgeit.com` and `ravitej@vbridgeit.com`.
5. Click **Apply Access**.

HR users sign in with a one-time code that Cloudflare emails them. If Zero Trust asks for a team name or plan the first time, pick a name such as `vbridgeit` and the **Free** plan. It needs a card on file but is not charged.

## 4. The allowed emails (in the repo)

The app keeps its own list of HR emails as a second lock. Someone must pass the Access policy **and** be on this list to get in, so a company email alone is not enough.

The list is `HR_EMAILS` in `wrangler.jsonc`, set once for the live site and once under `previews`. To change it, edit both lines in a pull request; the change applies when it is deployed. You do not need to add anything in the dashboard. An `ALLOWED_EMAILS` secret, if one exists, is added to this list.

## 5. Check it

1. Open **Deployments** to see the latest build. After this setup it should succeed.
2. Open the Worker's URL (`hirebridge.<your-subdomain>.workers.dev`) in a private window.
3. You should see the Cloudflare sign-in. Enter your work email, then type the code you receive. You should then see the Employees page.
4. On a preview link, the Employees page also offers **Load sample data**. The live site never does.

## Adding or removing an HR user

Change both places:

1. The Access policy (Worker → **Access** tab).
2. `HR_EMAILS` in `wrangler.jsonc` (both lines), by pull request.

## If something goes wrong

| What you see | What to check |
|---|---|
| "The tracker is not set up yet" | The page names what is missing |
| "Please sign in" | Access is not turned on for this Worker (step 3) |
| "You do not have access" | The email passes the Access policy but is not in `HR_EMAILS` |
| Build failed | Open the build log under **Deployments**. Check that the database IDs in `wrangler.jsonc` are correct |
