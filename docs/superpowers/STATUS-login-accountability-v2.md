# Login + Accountability — status

**Live in production** (deployment `AKfycbxIiT5WV92N6ksIYc0xCRKtegLNPCZpC-ubAFKDFGVLsfd9h0I2QQ69w5wFdCFY8X8O`, currently **@56**).
`main` holds the full history. `git push` to back up to GitHub.

The app now has **two pages** inside the single `#app` div (`#page1` /
`#page2`, shown/hidden via the `hidden` attribute), toggled by an
"استفسارات" button in page 1's toolbar and a "المستندات" button in page 2's.
See "Page 2" below for what it is, and Session 7 in the build log for how
it was built.

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
- **Toolbar** (3 zones): page title on the right · centre group = ⟳ refresh +
  bold 14px logged-in name + (admin) the سكرتارية filter + (secretary) her own
  Progres 1 & 2 bars · far left = "آخر تحديث HH:MM" then the red-`#a64d79`
  **خروج** button.
- Secretary: sees only her own rows across the 3 tabs, تعديل button disabled
  (view-only), and gets her own **Progres 1 + 2** bars in the toolbar
  (recomputed locally from her scoped `TABS_DATA` on every tick — no round-trip).
- **Table search** (`#rowSearch`, both roles): on the tab row, right after the
  "إعلام عودة uploads" tab. Free-text, live-filters *both* the Pending and طباعة
  tables — matches any cell or the row's `Code`, case-insensitive; resets the
  طباعة pager to page 1. Client-side over the already-scoped `TABS_DATA`.
- Admin: all rows, filter dropdown, and a collapsible **summary panel**
  ("ملخص لكل سكرتارية") — collapsed by default (`+` / `−`, remembered per browser).
  All-time, all-3-tabs, no date filter. Per secretary, **credited to the row's
  سكرتارية** (looked up by the row's `Code`), not whoever clicked:
  - **Visible columns:** السكرتارية | Pending | طباعة | أنجاز | خطأ انجاز | تعديل | Progres 1 | Progres 2.
    Pending = her rows with no طباعة tick yet (all 3 tabs).
    طباعة/أنجاز = rows *currently* ticked (same predicate as the طباعة-section
    badges, summed over the 3 tabs); خطأ انجاز = rows ever flagged (col P);
    تعديل = of those, since fixed (col Q).
  - **Hidden columns** (server still returns them — `<th>`/`<td>` commented in
    the markup): **تراجع** (lifetime un-tick event count) and
    **أقدم طلب معلّق (ساعات)** (age of the oldest row with no طباعة yet).
  - **Progres 1** — 3-segment bar over her total rows, pipeline معلّق(grey) →
    طباعة-not-yet-أنجاز(green) → أنجاز(navy), mirrored right-to-left (معلّق on
    the right). Counts `p·g·s` shown next to the bar; % = أنجاز ÷ (معلّق+طباعة)
    = أنجاز ÷ total. Layout: `[counts] [bar] [%]` (`.pbar-cell-rev`).
  - **Progres 2** — same treatment: 2-segment bar خطأ‑انجاز(red, still
    unfixed) → تعديل(yellow), mirrored right-to-left. % = تعديل ÷ خطأ انجاز
    (unchanged math, only the layout matches Progres 1 now).
  - Both bars: `denominator == 0` → empty grey bar, label "—".
- Each tab shows **Pending** and **طباعة** (was "Done") tables. The طباعة column header
  reads طباعة in both. The طباعة table:
  - header badges: `طباعة N` (green), `أنجاز N` (navy), `خطأ انجاز N` (red = rows ever
    flagged, col P set), `تعديل N` (`#e69138` = rows since fixed, col Q set).
  - paginated **3 calendar days per page**, numbered pager `1 2 3 …`.
  - last column **تعديل**: admin clicks cycle **✕ Wrong** (red, row flashes, writes col P)
    ↔ **✓ Fixed** (`#e69138`, writes col Q; P kept). Logs a `modify` row each click.
- Any tick (طباعة / أنجاز / تعديل) reloads the admin summary panel too.

## Page 2 — استفسارات و طلبات الأطباء
A second, parallel page (same login, same `#app`) reading a different sheet
tab — `SecActions` — instead of the 3 upload tabs. Reachable from either
page via the استفسارات / المستندات toggle buttons; loads eagerly at login
(not lazily on first visit) so its pending-count badge on the استفسارات
button is right immediately.

- **Server**: `Page2.gs` (`TABS_CONFIG2`, `COL2`, `SHEET_COLUMN_COUNT2=18`,
  `getBootstrapData2` / `refreshTabsData2`), `Activity2.gs` (`setRowDone2` /
  `setRowSent2` / `setRowModify2` / `setRowErased2`), `Summary2.gs`
  (`getAdminSummary2`) — all separate from page 1's endpoints, so page 1's
  live code paths were never touched building this.
- **No `Code` column** on `SecActions` (unlike the 3 upload tabs), so rows
  are keyed by a synthetic `Timestamp|ID` string (`rowKey2_`) instead of a
  stored value — recomputed live on every read/write. Collides only if two
  rows share the exact same Timestamp *and* ID (same AMBIGUOUS fallback as
  page 1's Code lookup).
- **Sheet layout** (`SecActions`, A:R): A–D and G–H come from the
  `syncDataFast()` sync job (Timestamp/Name/ID/Message/…/Center/السكرتارية);
  J `استلام` (was طباعة), K أنجاز, L–O `DoneAt/DoneBy/SentAt/SentBy`, P/Q
  `ModifyWrong/ModifyFixed` (تعديل — data still tracked, just hidden from
  page 2's own UI, see below), **R `Erased`** (مسح, admin-only, see below).
- **Table 1 (Pending/استفسارات)**: headers Timestamp/Name/ID/Center/
  Message/السكرتارية/استلام, no PDF column. Paginated 3 calendar days per
  page, same as page 1's Done table, with its own independent page counter.
  Admin-only extra column **مسح**: ticking it dims the row grey for admin
  (reversible) and — server-side, not just CSS — **excludes the row
  entirely** from what a scoped (secretary) read returns, so the secretary
  never sees it at all until admin unticks it.
- **Table 2 (استلام)**: same headers + أنجاز, no تعديل column/button (hidden
  per admin's request — the underlying `setRowModify2`/P·Q data still
  exists, just no UI for it on page 2). Same day-based pagination as
  table 1.
- **Summary panel** ("ملخص لكل سكرتارية", admin-only): trimmed down to just
  السكرتارية | Pending | استلام | Progres 1 (أنجاز, خطأ انجاز, تعديل, and
  Progres 2 columns removed per admin's request — page 1's summary panel
  still has all 8 columns, unchanged).
- **استفسارات button pending badge**: white pill on the button showing the
  true total pending count from `TABS_DATA2` (role-scoped server-side —
  total for admin, own rows for a secretary), independent of whatever
  search/filter is applied to the visible table.
- **Blank-row bug (fixed)**: `SecActions` is synced from an open-ended
  `"A1:H"` source range, which pulls the source sheet's full row extent
  (~1000 rows, mostly blank) — a stray formatting/whitespace cell was
  enough to look "non-empty" under the naive filter. Fixed by requiring a
  real Timestamp *and* ID instead of "any of the 17(→18) columns non-empty".
- **Session keep-alive**: added because a tab left open-but-idle for 8h+
  (the session TTL) would correctly but annoyingly expire mid-work. Now
  pings `resumeSession` every 20 min while logged in, on either page, so
  only a genuinely closed/idle tab times out. Not page-2-specific — the two
  pages share one token and one `requireSession_` code path throughout.

## Known ceilings (deliberate)
- Plaintext passwords in the `Login` tab.
- Sliding sessions, no absolute cap (mitigated by the keep-alive above, which
  only prevents *premature* expiry of a tab still in use).
- `setup` / `runTests` callable anonymously (idempotent / throwaway — low harm).
- No `LockService` around tick writes (fine at ~6 users on distinct rows).
- خطأ انجاز / تعديل count *rows* (col P/Q set), not per-occurrence re-flags — a per-time
  tally would come from the `ActivityLog` `modify` rows instead.
- Page 2's `rowKey2_` (Timestamp+ID) collides on an exact duplicate pair —
  degrades the same way a duplicate Code would on page 1.

## On the admin (not code)
- Rotate the وضحة password in the `Login` tab (was exposed during debugging; scrubbed
  from git history but change it anyway).
- Give each secretary their username + password.
- A secretary seeing an empty dashboard = her `Login` `Name` doesn't exactly match the
  سكرتارية column on her rows (applies to `SecActions`' السكرتارية column too).
- `SecActions` needs at least 18 columns (A:R) for page 2 to read it — run
  `setup()` from the editor if it errors on load; `setup()` also stamps the
  `Erased` header into R1 and the usual L:O/P:Q headers.
