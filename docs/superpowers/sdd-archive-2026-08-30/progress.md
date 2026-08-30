# SDD ledger — plan: docs/superpowers/plans/2026-08-30-login-accountability.md

Branch: login-accountability
Merge base (main): 2af5dc1916f450b0f465216d0376c3439b0150f8

## Pre-flight conflict scan
Clean — no task contradicts another or the Global Constraints; nothing plan-mandated that the review rubric treats as a defect. Node tests assert real values; pure/glue split is deliberate and documented.

## Tasks
Task 1: complete (commits 2af5dc1..b281258, review clean) — also folded in the uncommitted earlier security fixes; commit message amended to disclose.
Task 2: complete (commits b281258..a6bc6aa, review clean). DEFERRED: `setup_()` not executed — `clasp run` needs the Apps Script API (not enabled); user already created the L–O columns + ActivityLog tab manually, so it would no-op. Covered by Task 13 manual checklist / user can run it from the editor.
Task 3: complete (commits a6bc6aa..ac7a85f, review clean). auth.test.js OK (12 assertions), RED/GREEN captured.
Task 4: complete (commits ac7a85f..d7f859b, review clean; trailer verified by controller). minor (deferred): requireSession_ returns full session incl. exp (superset of documented {username,name,role}); runTests_ doesn't cover lockout/sweep/login paths (brief template omits them too). DEFERRED: editor run of runTests_() + _tmpLogin — controller can't run Apps Script editor; Task 13 checklist covers.
Task 5: complete (commits d7f859b..44bf303, review clean).
Task 6: complete (commits 44bf303..12f2f6b, review clean). activity.test.js OK (11 assertions), RED/GREEN captured.
Task 7: complete (commits 12f2f6b..7bf056c, review clean). all 4 Node suites pass incl. `activity.test.js guard OK`. Implementer removed old 3-arg setRowDone/setRowSent from Code.js (plan File-Structure mandates it; my brief under-extracted) and extended test global.COL — both correct, disclosed.
  minor (deferred, FLAG FOR USER/final review): tickGuard_ enforces done-before-sent only on SET, not UNSET — un-ticking Done while Sent is still set leaves sent='Sent' with done='' (breaks the workflow invariant). Spec-faithful, out of scope for T7. Consider blocking or auto-clearing Sent when Done is un-ticked.
  minor (deferred): writeTick_ `lastRow < 2` throws 'NOT_FOUND', same string as findRowByCode_'s code-absent case.
  DEFERRED: editor smoke test _tmpTick — Task 13 checklist.
Task 8: complete (commits 7bf056c..1ce0072, review clean; trailer verified).
Task 9: complete (commits 1ce0072..1da1128, review clean; trailer verified). getAdminSummary appended, export guard intact, all 4 Node suites still green. DEFERRED: editor smoke test _tmpSummary — Task 13 checklist.
Task 10: complete (commits 1da1128..92906fa, review clean; trailer verified). Index.html login view + banner + session/logout; script parses, all IDs present, style matches ES5. DEFERRED: browser behavior — Task 13.
Task 11: complete (commits 92906fa..95da470, review clean; trailer verified). Scoped bootstrap load, data-code + aria + disabled checkboxes, tick handler sends (token,sheet,code,hint,checked) with Arabic error banners, role-based filter hide, last-updated. minor (deferred): one-line refreshData (spec-mandated) drops the old spinning re-entrancy guard — rapid refresh clicks fire concurrent calls; setupSecretariatFilter() stacks a change listener on each relogin-without-reload (pre-existing). DEFERRED: browser behavior — Task 13.
Task 12: complete (commits 95da470..35b3bfa, review clean; trailer verified). #summaryPanel markup + CSS + loadSummary/renderSummary + date-change listener. Review found no issues. DEFERRED: browser behavior — Task 13.

## Final whole-branch review (Opus, base 2af5dc1..35b3bfa)
Architecture sound; auth gating complete; Login tab unreachable via any endpoint; tests real. 3 findings to fix + minors. Fix wave = commit 23c9379.
Re-review (base 35b3bfa..23c9379): ALL 7 findings ADDRESSED, no new breakage.
  - #1 Critical: real-looking credential `alajmi5635/xxxxxxxxx/وضحة الحجرف` was in tests/auth.test.js:8 + plan:230 → scrubbed to `w1/w11` in working tree. STILL IN LOCAL GIT HISTORY (commits 2af5dc1, ac7a85f). Nothing pushed to origin (origin/main still at 8e124d2). ACTION FOR USER: rotate that password in the real Login tab; decide on history scrub (squash-merge or filter-repo) before any `git push`.
  - #2 Important: blank Login Name failed open to full PII → guard added in checkCredentials_ + tests.
  - #3 Important: un-tick Done left row Sent-but-not-Done → cascade clear in writeTick_ + 2nd log row.
  - #4/#5/#6/#8 minor client cleanups: code-keyed updateLocalTickState, https-only pdf href, refresh re-entrancy guard, logout clears PII from memory/DOM.
  parked (out of scope, non-blocking): dup-Code in-memory render updates only first match (server still correct via rowHint); cascade-primitives test pins local isSent_/isDone_ copies; plaintext-password ceiling (accepted).

Task 13: CODE COMPLETE + reviewed clean (commits 35b3bfa..23c9379). NOT done, needs the user (no browser/editor in automation):
  - run setup_() once in the Apps Script editor (mostly no-op — user pre-made L–O cols)
  - run runTests_() in the editor → expect "runTests_: ALL PASS"
  - the 11-item browser manual checklist via the @HEAD test-deployment URL
  - rotate the exposed password in the real Login tab
  - production redeploy (clasp deploy --deploymentId AKfycbx...) ONLY after the checklist passes
  - history-scrub decision before any git push
All 4 Node suites green at 23c9379. Branch not merged. Workspace kept for the user's checklist. summary.test.js OK, all 4 suites green. minor (deferred): Summary.js docstring mentions a "getAdminSummary wrapper" not in this file (arrives T9); bucket(sec) created before action classification so a stray unrecognized-action log row could add an all-zero secretary (not possible with current writers — appendActivity_ only emits done/sent); minor DRY in the two data-row passes. shape.test.js OK + auth.test.js OK, getAllTabsData_ fully removed. minor (deferred): scope ternary `role==='admin'?null:session.name` duplicated across getBootstrapData/refreshTabsData (could be scopeFor_ helper); rewrite thinned some rationale comments in shapeSheetValues_; shape.test.js doesn't pin sheetRow values or row-side whitespace trim.
