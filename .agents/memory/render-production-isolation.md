---
name: Render production isolation
description: Environment boundary for development work and production migrations.
---

Treat Replit and its database as development-only. Keep Render production completely isolated: do not request or access Render credentials or its production database, and do not deploy unless explicitly authorized.

**Why:** The user requires production inspection and migrations to remain separate from Replit development work, and the two environments contain different datasets.

**How to apply:** Make development schema changes only against Replit. Store any future production migration as an explicit, idempotent file that is reviewed and run separately; never wire it into automatic startup execution.