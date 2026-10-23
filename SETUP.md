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

## 4. Add the allowed emails

The app keeps its own list of HR emails as a second lock. Someone must be on both this list and the Access policy to get in.

In the Worker, go to **Settings → Variables and secrets** and add the setting below **twice**: once with **Production** selected next to the heading, and once with **Previews Base** selected.

| Type | Name | Value |
|---|---|---|
| **Secret** | `ALLOWED_EMAILS` | The same emails as the Access policy, separated by commas |

Choose **Secret**, not Text. Deploys replace text variables with what is in `wrangler.jsonc`, but they never touch secrets.

## 5. Check it

1. Open **Deployments** to see the latest build. After this setup it should succeed.
2. Open the Worker's URL (`hirebridge.<your-subdomain>.workers.dev`) in a private window.
3. You should see the Cloudflare sign-in. Enter your work email, then type the code you receive. You should then see the Employees page.
4. On a preview link, the Employees page also offers **Load sample data**. The live site never does.

## Adding or removing an HR user

Change both places:

1. The Access policy (Worker → **Access** tab).
2. `ALLOWED_EMAILS` under Production and Previews Base.

## If something goes wrong

| What you see | What to check |
|---|---|
| "The tracker is not set up yet" | The page names what is missing. Usually `ALLOWED_EMAILS` has not been added for that environment |
| "Please sign in" | Access is not turned on for this Worker (step 3) |
| "You do not have access" | The email is in the Access policy but not in `ALLOWED_EMAILS` |
| Build failed | Open the build log under **Deployments**. Check that the database IDs in `wrangler.jsonc` are correct |
