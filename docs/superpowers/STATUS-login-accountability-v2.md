# Login + Accountability — status

**Live in production** (deployment `AKfycbxIiT5WV92N6ksIYc0xCRKtegLNPCZpC-ubAFKDFGVLsfd9h0I2QQ69w5wFdCFY8X8O`, currently **@28**).
`main` holds the full history. `git push` to back up to GitHub.

## Server files (Apps Script, concatenated into one scope by clasp)
- `Code.gs` — config (`ADMIN_USERNAME='a1'`, `LOGIN_SHEET`, `ACTIVITY_SHEET`, session/lockout
  consts), `COL` map (A:Q), `SHEET_COLUMN_COUNT=17`, `doGet` (no embedded data), scoped
  reads (`getBootstrapData`, `refreshTabsData`, `shapeSheetValues_`, `modifyState_`),
  `assertKnownSheet_`, plus the standalone `syncDataFast` (DocName sync — unrelated).
- `Auth.gs` — `login` / `resumeSession` / `logout`, `checkCredentials_` (plaintext vs
  `Login` tab), sessions in Script Properties (8h sliding), per-username lockout
  (5 tries / 15 min in CacheService).
- `Activity.gs` — `writeTick_` (Code-keyed طباعة/أنجاز writes, stamps L:O, appends
  `ActivityLog`, un-tick-طباعة cascades to clear أنجاز), public `setRowDone` / `setRowSent`,
  and `setRowModify` (admin-only, cols P/Q).
- `Summary.gs` — `getAdminSummary` + pure `aggregateSummary_`.
- `Setup.gs` — `setup` (idempotent: adds L:O + P/Q headers to the 3 data tabs) and
  `runTests` (in-editor auth self-test). Both non-underscore so the editor Run menu
  lists them (it hides `_`-suffixed names — that quirk cost hours in slice 1).

## Sheet layout
- Data tabs `UploadedData` / `UploadedVacations` / `UploadedEqrarawdah`:
  A..K original, L `DoneAt`, M `DoneBy`, N `SentAt`, O `SentBy`,
  **P `ModifyWrong` ("Wrong")**, **Q `ModifyFixed` ("Fixed")**.
- `Login` tab: **Username | Password | Name | Role**. `Role` = `admin` or blank.
  `a1` is a hardwired safety-net admin regardless of its Role cell.
- `ActivityLog` tab: `timestamp | sheet | code | username | name | action | old | new`
  (`action` ∈ `done` / `sent` / `modify`).

## Client (`Index.html`) — current behaviour
- Login form; session remembered in `localStorage.usd_token`.
- Secretary: sees only her own rows across the 3 tabs, no سكرتارية filter, تعديل button
  disabled (view-only).
- Admin: all rows, filter dropdown, and a collapsible **summary panel**
  ("ملخص لكل سكرتارية") — collapsed by default (`+` / `−`, remembered per browser).
  All-time, all-3-tabs, no date filter. Per secretary, **credited to the row's
  سكرتارية** (looked up by the row's `Code`), not whoever clicked:
  - **Visible columns:** السكرتارية | طباعة | أنجاز | خطأ انجاز | تعديل.
    طباعة/أنجاز = rows *currently* ticked (same predicate as the طباعة-section
    badges, summed over the 3 tabs); خطأ انجاز = rows ever flagged (col P);
    تعديل = of those, since fixed (col Q).
  - **Hidden columns** (server still returns them — `<th>`/`<td>` commented in
    the markup): **تراجع** (lifetime un-tick event count) and
    **أقدم طلب معلّق (ساعات)** (age of the oldest row with no طباعة yet).
- Each tab shows **Pending** and **طباعة** (was "Done") tables. The طباعة column header
  reads طباعة in both. The طباعة table:
  - header badges: `طباعة N` (green), `أنجاز N` (navy), `خطأ انجاز N` (red = rows ever
    flagged, col P set), `تعديل N` (`#e69138` = rows since fixed, col Q set).
  - paginated **3 calendar days per page**, numbered pager `1 2 3 …`.
  - last column **تعديل**: admin clicks cycle **✕ Wrong** (red, row flashes, writes col P)
    ↔ **✓ Fixed** (`#e69138`, writes col Q; P kept). Logs a `modify` row each click.
- Any tick (طباعة / أنجاز / تعديل) reloads the admin summary panel too.

## Known ceilings (deliberate)
- Plaintext passwords in the `Login` tab.
- Sliding sessions, no absolute cap.
- `setup` / `runTests` callable anonymously (idempotent / throwaway — low harm).
- No `LockService` around tick writes (fine at ~6 users on distinct rows).
- خطأ انجاز / تعديل count *rows* (col P/Q set), not per-occurrence re-flags — a per-time
  tally would come from the `ActivityLog` `modify` rows instead.

## On the admin (not code)
- Rotate the وضحة password in the `Login` tab (was exposed during debugging; scrubbed
  from git history but change it anyway).
- Give each secretary their username + password.
- A secretary seeing an empty dashboard = her `Login` `Name` doesn't exactly match the
  سكرتارية column on her rows.
