# Login + Accountability — Design

**Date:** 2026-08-30
**Status:** Approved
**Project:** Ultimate Secretary Directory (Uploads Dashboard, Google Apps Script web app)

## Purpose

Turn the dashboard from an anonymous shared checklist into a monitoring tool.
The admin (username `a1`, عبدالرحمن المراقي) needs end-of-day, per-secretary
visibility: what each of the 5 secretaries completed, how fast, and what is
still outstanding. That requires knowing **who** ticked and **when** — neither
is recorded today.

## Constraints

- Stay on Apps Script + vanilla JS. No framework, no bundler, no database.
- Secretaries have no Google accounts → custom username/password login.
- Small user count (6). Solutions sized for that, with documented upgrade paths.

## 1. Data model

### `Login` tab (already created)

| Column | Meaning |
|---|---|
| Username | login id, trimmed, case-insensitive match |
| Password | plaintext, exact match (case-sensitive) |
| Name | display name; **must equal the سكرتارية column value** in the data sheets for row-scoping to work |

- Admin username is the constant `ADMIN_USERNAME = 'a1'` in `Code.js`. Every
  other row is a secretary. No role column in the sheet.
- Disabling a login = delete the row.

### `ActivityLog` tab (already created)

Append-only. One row per Done/Sent tick and per un-tick.

| Column | Value |
|---|---|
| timestamp | `new Date()` at write time |
| sheet | data sheet name (`UploadedData` etc.) |
| rowKey | the row's `Code` (column E) |
| username | logged-in username |
| secretaryName | logged-in display name |
| action | `done` or `sent` |
| oldValue | previous cell value (`""` or `Done`/`Sent`) |
| newValue | new cell value |

### Data sheets — new columns L–O (already created)

`DoneAt`, `DoneBy`, `SentAt`, `SentBy`. `SHEET_COLUMN_COUNT` becomes 15 (A:O).
`setup_()` verifies the four headers exist on each of the 3 tabs and adds any
that are missing; it does not touch existing data.

### Row key

The stable identifier for a row is its **`Code`** (column E), assumed unique
across all three tabs.

- Lookup: server reads the target sheet, finds the row whose `Code` matches.
- Blank `Code`: row's checkboxes are disabled client-side ("can't track — no
  Code"); server rejects any write for a blank key.
- Duplicate `Code`: server falls back to the client-sent row-number hint if it
  is among the matches; otherwise rejects with "please refresh".
- Not found: reject with "row not found — please refresh".

## 2. Authentication

### Page load

- `doGet` serves `Index.html` with **no sheet data embedded**. This removes the
  old exposure where every row sat in the page source for anonymous viewers.
- Deployment stays `access: ANYONE_ANONYMOUS`, `executeAs: USER_DEPLOYING` — the
  page must be reachable so the login form can render. Custom auth is the gate.
- The page opens on a login view. A dashboard view is hidden until authenticated.

### Session lifecycle

- On load, client reads `localStorage.sessionToken`. If present it calls
  `resumeSession(token)`; a valid token returns `{name, role}` and the dashboard
  shows. Invalid/expired → login view.
- `login(username, password)`:
  - Check lockout: `CacheService` script cache, key `lock_<username>`, integer
    count, 15-minute TTL. If ≥ 5 → return `{error: 'locked'}`.
  - Read `Login` tab. Match `Username` (trim + lowercase). Compare `Password`
    exactly. On mismatch: increment `lock_<username>`, return
    `{error: 'bad_credentials'}`.
  - On success: clear `lock_<username>`; generate
    `token = Utilities.getUuid() + Utilities.getUuid()`; store in Script
    Properties key `sess_<token>` → JSON `{username, name, role, exp}` where
    `exp = Date.now() + 8h`. Opportunistically sweep and delete expired
    `sess_*` properties. Return `{token, name, role}`.
- `requireSession_(token)` — used by every other server function: load
  `sess_<token>`, throw if missing or `exp < now`, otherwise bump `exp` by 8h
  (sliding), write back, return the session object.
- `logout(token)`: delete `sess_<token>`. Client clears `localStorage`.

### Endpoint auth summary

| Function | Auth |
|---|---|
| `login`, `resumeSession` | none (login has lockout) |
| `getBootstrapData` | `requireSession_` |
| `setRowDone`, `setRowSent` | `requireSession_` + ownership |
| `getAdminSummary` | `requireSession_` + role `admin` |
| `logout` | token, best-effort |

## 3. Authorization

- **Secretary:** `getBootstrapData` returns all 3 tabs, each filtered
  server-side to rows where سكرتارية === `session.name`. Writes are re-checked:
  a secretary editing a row whose سكرتارية is not their name → throw
  "not your row".
- **Admin:** unfiltered data for all tabs, plus `getAdminSummary` access. Can
  tick any row.
- Order enforcement (server-side): `setRowSent(..., true)` throws if the target
  row is not currently `Done`.
- The سكرتارية filter dropdown is **hidden for secretaries** (their data is
  already scoped to one name) and shown only for the admin.

## 4. Tick write flow

`setRowDone(token, sheetName, rowKey, rowHint, done)`
(`setRowSent` identical, different column/action/word):

1. `requireSession_(token)`.
2. `assertKnownSheet_(sheetName)` (existing guard).
3. Locate row by `rowKey` (see Row key rules).
4. If secretary and row سكرتارية ≠ `session.name` → throw.
5. If `sent` and row not `Done` → throw.
6. Capture `oldValue`. Write J/K = `done ? 'Done'/'Sent' : ''`. Write the
   matching At/By pair: set → `new Date()` + `session.username`; un-tick →
   clear both.
7. Append `ActivityLog` row.
8. Return the refreshed row object for the client to re-render.

## 5. Admin summary panel

- Rendered only when `role === 'admin'`, at the top of the dashboard.
- Native `<input type="date">`, default today (timezone Asia/Riyadh).
- `getAdminSummary(token, dateStr)` reads `ActivityLog` for that date and the
  current data sheets, returns per-secretary:
  - Done count, Sent count, un-tick count (from log `action`/`newValue`).
  - Average minutes between `DoneAt` and `SentAt` for rows whose `SentAt` falls
    on that date.
  - Oldest still-pending request: min `Timestamp` among that secretary's rows
    with no `Done`, expressed as age in hours.
- Rendered as a plain table. No charts.

## 6. Folded-in cleanup

- Delete `bkp.html` and `BKP1Codegs.html` from the repo; `clasp push -f` drops
  them from the Apps Script project.
- Replace both `alert()` calls with an inline dismissible `#banner` element.
- Add `aria-label` to Done/Sent checkboxes and an `aria-label` on each table.
- Hide the سكرتارية filter for secretaries; keep it for the admin.
- Show "logged in as <name>" and a logout button in the toolbar.
- Show "Last updated HH:MM" next to the refresh button, set on every data load.

## 7. Testing

`runTests_()` in `Code.js`, run manually from the editor. Asserts:

- password check: correct pair passes, wrong password fails, unknown user fails.
- session: create → `requireSession_` returns it; expired `exp` → throws;
  `logout` → subsequent `requireSession_` throws.
- row-key lookup: known `Code` resolves; unknown → throws; blank → throws.
- ownership: secretary vs own row passes, vs other row throws.
- order: `sent` on a non-Done row throws.
- summary aggregation: on a fixed fake `ActivityLog` array, counts and average
  latency match hand-computed values.

Manual checklist:

- Log in as a secretary → only their centers' rows in all 3 tabs.
- Tick Done → row turns green, `ActivityLog` gains a row, `DoneAt`/`DoneBy`
  filled.
- Tick أنجاز before Done → rejected with a message.
- Un-tick Done → `ActivityLog` row, `DoneAt`/`DoneBy` cleared.
- Log in as `a1` → all rows, summary panel, date picker changes the numbers.
- 5 bad logins → 15-minute lockout message.

## Known ceilings (deliberate)

| Shortcut | Ceiling | Upgrade path |
|---|---|---|
| Plaintext passwords in `Login` tab | Anyone with the spreadsheet sees them | Hash-on-entry (`onEdit` salts + SHA-256, blanks the cell) |
| Per-username login lockout | A real user can be locked out by someone failing 5 times | Add per-client tracking if it is ever abused |
| Sessions in Script Properties | Fine for ~dozens of users | Move to a `Sessions` sheet or Firestore |
| `Code`-based row lookup reads the sheet each write | O(rows) per tick | Cache a `Code → row` map with short TTL |
| Full re-read on load/refresh, no pagination | Slow past a few thousand rows | `CacheService` + per-tab lazy load |
