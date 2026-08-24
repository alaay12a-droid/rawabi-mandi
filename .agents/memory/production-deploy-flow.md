---
name: Production deploy flow
description: How to update the production server at mandi-menu-1.replit.app — what works, what doesn't
---

# Production Deploy Flow

## The rule
`suggest_deploy` only shows a UI button — it cannot trigger the deployment programmatically. The user must click **Republish** in the Replit Publishing page, then click **Approve** when DB migrations are detected.

**Why:** Replit requires user-initiated publishing. The agent cannot click UI buttons. Past sessions wasted time polling endpoints expecting automatic deployment.

**How to apply:**
1. Call `suggest_deploy` once to show the button.
2. Tell the user explicitly: "اضغط Republish (الزر الأزرق)" — don't just say "click publish."
3. If migrations exist (new DB tables added since last deploy), a second **Approve** button appears — tell the user to click it too.
4. After user confirms, poll `fetch_deployment_logs` for "Server listening" to confirm the new process started.
5. Then test the endpoints directly with curl — don't assume deploy worked.

## DB migration approval
When new tables exist in dev but not prod, Replit shows:
- ✅ Development database changes detected
- ✅ Generated migrations to apply to production db
- ✅ Database migrations validated successfully
- → "Create preview deploy" + **Approve** button

The user must click **Approve** to continue. The build won't proceed without it.

## Diagnosing stale production
- `GET /api/healthz` 200 + newer routes returning 404 = old deployment
- Check `fetch_deployment_logs` for last "Server listening" timestamp to estimate how old
- Compare which routes return 200 vs 404 against git history to narrow down the deployed commit age

## External Render deployment
When the app is hosted on Render, a successful push to the tracked GitHub branch does not prove that the service deployed. Verify both the GitHub branch commit and the app's `GET /api/version`; if the latter remains old after several minutes, use Render's manual deploy for the service and tracked branch.

**Why:** The Render service can have automatic deploys disabled or a stale service configuration, while the repository branch is already current.

**How to apply:** Confirm the service is `mandi-menu-1`, deploy the latest commit from `main`, then poll `/api/version` and inspect the served dashboard asset for the feature marker.
