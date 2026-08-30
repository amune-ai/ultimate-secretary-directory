# Login + Accountability — paused 2026-08-30, resume later

## Status: implementation COMPLETE on branch `login-accountability`, NOT merged, NOT deployed to production.

Paused mid final-verification because the Apps Script editor showed "No functions"
(Run greyed out) and login on the `@HEAD` test deployment failed. Root cause was
being diagnosed — likely one of:
- a stale/dead time-trigger for `syncDataFast` (a function from the old deleted
  `bkp.html`) firing and erroring — unrelated noise, delete that trigger in the
  Triggers panel;
- `login()` returning "wrong credentials" (Login-tab row spelling / the new
  blank-`Name` guard) OR `getBootstrapData` failing right after login.
Next debugging step was: read the login page's on-screen Arabic message + check
the Executions log for a `getBootstrapData` entry + screenshot the `Login` tab.

## What was done to the live system
- **Production web app (deployment `AKfycbxIiT5WV92N6ksIYc0xCRKtegLNPCZpC-ubAFKDFGVLsfd9h0I2QQ69w5wFdCFY8X8O`, @12) — UNTOUCHED.** Still runs the pre-login "security-fixed original" and is what the 5 secretaries use. Working normally.
- Apps Script **project source** was restored (via `clasp push`) to that same
  pre-login state, so the editor is clean again. The login code is NOT in the
  project anymore — it lives only in git on the `login-accountability` branch.
- `@HEAD` test deployment now also serves the pre-login version.

## Where everything is
- Design spec: `docs/superpowers/specs/2026-08-30-login-accountability-design.md`
- Implementation plan (13 tasks, full code): `docs/superpowers/plans/2026-08-30-login-accountability.md`
- Full task-by-task record (ledger, briefs, reports): `docs/superpowers/sdd-archive-2026-08-30/`
  - `progress.md` is the ledger — read it first. It lists every task, every
    review verdict, deferred minors, and the final-review findings + fixes.
- All 13 tasks' code: `git log --oneline main..login-accountability` (12 commits,
  `b281258`..`23c9379`).

## To resume
1. `git checkout login-accountability`
2. `clasp push -f` to put the login code back into the Apps Script project.
3. Finish Task 13 of the plan: run `setup_()` then `runTests_()` in the editor,
   then the 11-item browser checklist on the `@HEAD` test URL, then diagnose the
   login failure above.
4. Outstanding from the final review (all already fixed in `23c9379`, just needs
   live verification): blank-`Name` guard, un-tick-Done cascade, client cleanups.
5. **Security TODO for the user:** the password `(redacted)` (وضحة …) was exposed
   in chat + local git history on this branch — rotate it in the `Login` tab.
   Set all `Login` passwords to 12+ chars. When ready to merge, squash-merge the
   branch (also scrubs that value from history) before any `git push`.
6. Operational: the `Login` tab `Name` column must EXACTLY match the سكرتارية
   column value in the data sheets, or that secretary sees an empty dashboard.
