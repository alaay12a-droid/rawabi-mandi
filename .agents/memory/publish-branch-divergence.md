---
name: Publish branch divergence
description: How to diagnose stale Expo or Render behavior after Replit publishing creates separate Git history.
---

When requested changes exist in the Replit workspace but do not appear in Expo or a GitHub-backed host, compare the local HEAD tree and GitHub main before rebuilding or changing code. Replit Publish can create local deployment commits on a parallel history while the external main branch remains on an older tree.

**Why:** This project once had the correct client and API changes locally while GitHub main—and therefore Render—still referenced a different branch line. Repeated publishing did not synchronize those trees.

**How to apply:** Fetch the external main ref, inspect ancestry and tree differences, and reconcile without force-pushing. Keep the current verified workspace tree authoritative when it contains the requested changes, and use a merge commit to preserve both histories.