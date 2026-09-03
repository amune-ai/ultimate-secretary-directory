# Build Log — Login + Accountability

A narrative record of how the login / per-secretary accountability feature was
designed, built, and shipped. Two working sessions on 2026-08-30 → 2026-08-31.

## The problem it solves

The "Uploads Dashboard" web app was an anonymous shared checklist: anyone with
the URL saw all rows (names, national IDs, sick-leave records) and could tick
`Done` / `أنجاز` on any row. The admin (1 person) wanted to monitor 5
secretaries — who did what, when — but the app recorded neither identity nor
time. It also had two security holes (an unvalidated `sheetName` on the write
endpoints, and a `</script>` breakout via embedded data), which were fixed
first.

## Design decisions

- **Custom username/password login**, because the secretaries have no Google
  accounts. `Login` tab: `Username | Password | Name`. Passwords are plaintext
  — a deliberate, documented ceiling: the sheet only lives with the admin, and
  the alternative (rolling a KDF in Apps Script) wasn't worth it. Upgrade path
  noted in `Auth.js`.
- **Sessions** = random token (two UUIDs) in Script Properties, 8h sliding
  expiry, deleted on logout. Brute-force lockout: 5 wrong tries per username →
  15-minute block (CacheService).
- **Per-secretary scoping**: a secretary sees only rows whose `سكرتارية`
  column equals their `Login` `Name`; `a1` is the admin and sees everything.
  Enforced server-side on both reads and writes.
- **Stable row key = column E `Code`**, not the sheet row number — so a tick
  can't land on the wrong row after a sort/insert.
- **Accountability data**: every tick stamps `DoneAt/DoneBy/SentAt/SentBy`
  (new columns L:O) and appends to an `ActivityLog` tab
  (`timestamp|sheet|code|username|name|action|old|new`). Un-ticking `Done`
  cascades to clear `Sent` (a row must never be Sent-but-not-Done).
- **Admin summary panel**: per-secretary Done/Sent/un-tick counts for a chosen
  day, average Done→Sent minutes, oldest still-pending request age.
- Deliberately **stayed on Apps Script + vanilla JS** — no framework, no
  build step, no database. Sized for 6 users.

## How it was built

**First attempt** (2026-08-30): a full 13-task plan executed with
subagent-driven development — spec, plan, task-by-task implementation with
per-task code review and a final whole-branch review (Opus). All code written
and reviewed on branch `login-accountability`. The full record — ledger,
per-task briefs, per-task and final review reports — is in
`sdd-archive-2026-08-30/`.

Then live verification stalled: the Apps Script editor showed **"No functions"**
with Run greyed out, and browser login appeared to fail. The session was paused
and the project reverted to the pre-login state so the admin could keep working.

**Second attempt** (2026-08-31): rebuilt on branch `login-accountability-v2`
in **5 incremental slices**, pushing and verifying each in the live editor /
test deployment before the next:

1. L:O column constants + `setup()` — additive, no behavior change.
2. `Auth.gs` — login / sessions / lockout. Verified with an editor `runTests`.
3. Scoped reads (`getBootstrapData`) + tick engine (`Activity.gs writeTick_`).
   Editor tests confirmed a secretary sees 28 rows vs the admin's 185, and
   that a tick writes L:O + appends to `ActivityLog`.
4. `Summary.gs getAdminSummary` — verified the per-secretary rollup.
5. Client (`Index.html`) — login form, session resume, scoped dashboard,
   Code-keyed ticks, admin summary panel.

## The two red herrings that cost the most time

1. **"No functions" / greyed Run.** The Apps Script editor's Run dropdown
   does **not** list `_`-suffixed function names, and it only shows functions
   from the *currently open file*. A file (`Setup.gs`) whose only functions
   were `setup_` / `runTests_` therefore showed "No functions". The project
   was never broken. Fix: name editor-runnable helpers without a trailing
   underscore.

2. **"Login page stays".** Login and the post-login data fetch worked the
   whole time — but `.login-view { display: flex }` in the CSS overrode the
   `hidden` attribute (author class beats the UA `[hidden]{display:none}`
   rule), so the login form stayed on screen sitting on top of the
   fully-loaded dashboard. One-line fix:
   `[hidden] { display: none !important; }`.

## Also restored

`syncDataFast` — a standalone job that pulls the `DocName` tab from an
external "أسماء الاطباء" spreadsheet. It had only survived in a deleted
backup file; its time trigger was erroring. Recovered verbatim into `Code.js`.

## Shipped

2026-08-31 — deployed to production deployment
`AKfycbxIiT5WV92N6ksIYc0xCRKtegLNPCZpC-ubAFKDFGVLsfd9h0I2QQ69w5wFdCFY8X8O`
as `@13`. `login-accountability-v2` fast-forward merged to `main`.

## Left to the admin (not code)

- Rotate the وضحة password (it was exposed during debugging).
- Hand each secretary their username + password from the `Login` tab.
- Optionally lengthen the short passwords.
- If a secretary sees an empty dashboard: their `Login` `Name` doesn't match
  the `سكرتارية` column spelling on their rows — fix the Name to match.

## Known ceilings (deliberate, still open)

- Plaintext passwords in the `Login` tab.
- Sliding sessions with no absolute lifetime cap.
- `setup` / `runTests` are callable anonymously (low harm — idempotent /
  throwaway).
- No `LockService` around tick writes (fine at 6 users on mostly-distinct rows).

---

## Session 2 (2026-08-31, after the initial ship) — iterative changes

Worked directly on `main`, one change per commit, each pushed to `@HEAD`, tested
by the admin, then deployed to production (`clasp deploy` is run by the admin —
the agent's permission classifier blocks both `clasp deploy` and `git push`).
Production moved @13 → @23 over these.

**Admins**
- `Login` tab gained a **`Role`** column (`admin` / blank). Any number of admins
  now; `a1` stays a hardwired safety-net admin. `checkCredentials_` reads the
  cell; `readLoginRows_` reads A:D defensively (`Math.min(4, maxColumns)`).

**Summary panel ("ملخص اليوم لكل سكرتارية")**
- `منجز` → `طباعة`; dropped the "متوسط الدقائق (منجز→أنجاز)" column and its
  server-side latency computation.
- Added a **collapse/expand toggle** (`+` / `−`), **collapsed by default**,
  remembered per browser (`localStorage usd_summary_collapsed`).
- Added per-secretary **`خطأ انجاز`** (red) and **`تعديل`** (`#e69138`) columns,
  live from cols P/Q. `خطأ انجاز` = rows *ever* flagged (P set, stays counted
  after fixing); `تعديل` = of those, the ones since fixed (Q set).
- The panel now reloads after *any* tick (previously only on refresh / date
  change), so its columns stay live.

**طباعة table (was "Done" — table 3)**
- Section title dropped; two matching badges **`طباعة N`** (green) + **`أنجاز N`**
  (navy), later joined by **`خطأ انجاز N`** (red) + **`تعديل N`** (`#e69138`).
- **Pagination** by calendar day — **3 days per page** — with a numbered pager
  (`1 2 3 …`, current page highlighted). Page resets on tab switch / filter /
  refresh.
- New last column **`تعديل`**: a 3-state control.
  - First click (from untouched) → **✕ Wrong**: writes `Wrong` to **col P**,
    row font red + flashing (`@keyframes modblink`).
  - Click again → **✓ Fixed**: writes `Fixed` to **col Q**, **col P keeps
    `Wrong`**, row font `#e69138`.
  - After that it loops Wrong ↔ Fixed only (no clear-to-none from the button —
    col P is a permanent tally for the `خطأ انجاز` count).
  - **Admin-only**: `setRowModify` throws `ADMIN_ONLY` for non-admins; the button
    renders disabled for secretaries (they still see the ✕/✓ state and the row
    colour).
  - Each click appends a `modify` row to `ActivityLog` (old→new state).
- The checkbox column header "Done" was renamed **طباعة** in both the Pending and
  طباعة tables (via `COLUMN_HEADERS`).

**Data model**
- `COL` extended: `MODIFY_WRONG` = P (15), `MODIFY_FIXED` = Q (16).
  `SHEET_COLUMN_COUNT` 15 → 17. `setup` now also adds `ModifyWrong` /
  `ModifyFixed` headers. `modifyState_(p, q)` → `'fixed'` / `'wrong'` / `'none'`.

**Bugs fixed during the session**
- `خطأ انجاز` was dropping to 0 when a row was marked Fixed — changed to count
  every row whose col P is set (`wrong` OR `fixed` state).
- Summary panel showed stale counts after a tick — added a post-tick reload.

**Colour history of the Fixed state:** navy → `#8a6d00` (dark yellow) → `#e69138`.

---

## Session 3 (2026-09-04) — summary panel reworked

Production @25 → @28. Same workflow (agent edits + `clasp push` to @HEAD;
admin runs `clasp deploy` and `git push`).

- **Renamed** "ملخص اليوم لكل سكرتارية" → **"ملخص لكل سكرتارية"**.
- **Removed the date picker.** طباعة / أنجاز had been counted per selected day
  from `ActivityLog`; the admin wanted totals, so the day concept went away —
  first to all-time event totals, then (see below) to current-state.
- **Attribution fixed:** counts are now credited to the **row's سكرتارية**
  (via a `Code → سكرتارية` lookup built from the sheet), not to whoever was
  logged in when they clicked. Retroactive — every historical `ActivityLog`
  entry re-attributes; falls back to the name recorded at the time if the
  `Code` no longer exists.
- **طباعة / أنجاز are now current-state**, not event counts: "her rows
  currently ticked طباعة / أنجاز", summed across the 3 tabs — so the panel
  equals the sum of the 3 tabs' طباعة-section badges (no filter). خطأ انجاز /
  تعديل were already current-state (cols P/Q). **تراجع** is the lone exception
  and stays an event count (an "undo" has no current state) — computed from
  `ActivityLog` un-tick rows (`action` done/sent, `newValue` empty), which
  double-counts the طباعة→أنجاز cascade.
- **Hid two columns** (`<th>`/`<td>` left as comments, server payload
  unchanged): **تراجع** and **أقدم طلب معلّق (ساعات)**. Visible set is now
  السكرتارية | طباعة | أنجاز | خطأ انجاز | تعديل.

`Summary.gs` no longer has `dateInTz_` (dead after the date filter was removed);
`getAdminSummary` takes just `token`.
