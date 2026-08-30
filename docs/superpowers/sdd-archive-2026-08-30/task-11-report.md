# Task 11 Report — Client: wire dashboard to bootstrap, scoped tick writes, role-based filter

Branch: `login-accountability` · File changed: `Index.html` only
Commit: `95da470` — `feat: scoped dashboard load, Code-keyed tick writes, role-based filter`

## Steps applied

### Step 1 — Remove the inlined-data global
Location: top of `<script>` (line ~328).
Before:
```js
    var TABS_DATA = <?!= tabsDataJson ?>;
```
After:
```js
    var TABS_DATA = {};
```
`TABS_CONFIG` / `COLUMN_HEADERS` template reads left untouched, as the brief specifies.

### Step 2 — Replace the `enterDashboard` stub with the real body (+ `setLastUpdated` + `loadData`)
Location: replaced the stub block (with its 2-line comment) near line 713.
Before:
```js
    // enterDashboard is defined in Task 11. Provide a stub so this task runs
    // standalone; Task 11 replaces it.
    function enterDashboard() {
      setupSecretariatFilter();
      refreshSecretariatOptions();
      renderNav();
      renderTable();
    }
```
After: real `enterDashboard()` (sets `#whoami`, hides `.filter-box` for non-admin, guards `#summaryPanel` with `if (summary)`, calls `setupSecretariatFilter()` then `loadData(true)`), plus new `setLastUpdated()` and `loadData(initial)` exactly as in the brief. `loadData` calls `getBootstrapData(SESSION.token)` when `initial` truthy else `refreshTabsData(SESSION.token)`; success sets `TABS_DATA` from `res.tabsData` or `res`, re-renders, `setLastUpdated()`, and `loadSummary()` when admin + `typeof loadSummary === 'function'`; `AUTH` failure clears `usd_token` + `showLogin(...)`, otherwise `showBanner(...)`.
Now defined at: `enterDashboard` line 714, `setLastUpdated` line 725, `loadData` line 734. Single definition each.

### Step 3 — Repoint refresh button, delete old `refreshData`
Location: line ~639.
Before: 18-line `refreshData()` that called `.refreshTabsData()` with no token and used `alert(...)`.
After:
```js
    function refreshData() { loadData(false); }
```
The `document.getElementById('refreshBtn').addEventListener('click', refreshData);` line is kept (line 641).

### Step 4 — `data-code` on rows + disable un-trackable checkboxes
Location: `buildTableMarkup`, row loop (lines ~503–521).
Row open tag before:
```js
          html += '<tr class="' + rowClasses + '" data-sheet-row="' + row.sheetRow + '">';
```
After:
```js
          var noCode = !row.code;
          html += '<tr class="' + rowClasses + '" data-sheet-row="' + row.sheetRow +
                  '" data-code="' + escapeAttr(row.code || '') + '">';
```
Checkbox cells before:
```js
          html += '<td class="tick-cell"><input type="checkbox" class="tick-checkbox" ' + (row.done ? 'checked' : '') + ' /></td>';
          if (showSentColumn) {
            html += '<td class="tick-cell"><input type="checkbox" class="tick-checkbox-sent" ' + (row.sent ? 'checked' : '') + ' /></td>';
          }
```
After: both inputs get `aria-label` ("تحديد كمنجز" / "تحديد أنجاز") and, when `noCode`, `disabled title="لا يمكن التتبع: لا يوجد Code"` — verbatim from the brief.

### Step 5 — `aria-label` on each `<table>`
Location: `buildTableMarkup` line ~491.
Before: `var html = '<table class="data-table"><thead><tr>';`
After: `var html = '<table class="data-table" aria-label="' + escapeAttr(tab.label) + '"><thead><tr>';`

### Step 6 — Send `code` + row hint from tick change handler
Location: change listener on `#tableWrap` (lines ~600–630).
- After `var tr = checkbox.closest('tr');` added `var code = tr.getAttribute('data-code');` (line 603).
- Success handler signature changed to `function (updated)`; body unchanged — `updateLocalTickState(sheetName, sheetRow, config.field, checked); renderTable();` kept (brief says leave it keyed on `sheetRow`).
- Failure handler replaced: still restores checkbox/row state, then maps `err.message` → Arabic banners for AUTH (clears token + `showLogin`), NOT_YOUR_ROW, DONE_FIRST, `NOT_FOUND|AMBIGUOUS|NO_CODE` (regex), generic fallback `showBanner('تعذّر الحفظ: ' + msg, 'error')`.
- Call tail changed from `[config.serverFn](sheetName, Number(sheetRow), checked)` to `[config.serverFn](SESSION.token, sheetName, code, Number(sheetRow), checked)`.
Old `alert('Could not save: ...')` removed.

### Step 7 — "last updated" element
Location: toolbar, immediately after the `#refreshBtn` `</button>` (line 310).
Added: `<span id="lastUpdated" class="whoami"></span>`

### Step 8 — Push
`clasp push -f` → "Pushed 7 files at 5:59:14 AM." (Index.html among them). No `clasp deploy`.

### Step 9 — Commit
`git add Index.html && git commit` with the required co-author trailer → `95da470`.

## Verification results

- **Parse check**: extracted `<script>` body, replaced `<?!= ... ?>` with `0`, `node --check` → `PARSE OK`. (Same technique as Task 10.)
- **`grep 'id="lastUpdated"' Index.html`** → `310:        <span id="lastUpdated" class="whoami"></span>` — present.
- **Duplicate-function grep** (`function (enterDashboard|loadData|refreshData|setLastUpdated)`) → count 4, one each:
  - `639: function refreshData() { loadData(false); }`
  - `714: function enterDashboard() {`
  - `725: function setLastUpdated() {`
  - `734: function loadData(initial) {`
- **Old `refreshData` body**: `grep -n 'refreshTabsData()' Index.html` → no matches. The no-arg call is gone.
- **`refreshBtn` click listener**: still present at line 641.
- **`updateLocalTickState`**: still called in the tick success handler (line 616), keyed on `sheetRow`.
- **Referenced IDs exist**: `whoami` (line 311), `refreshBtn` (305), `lastUpdated` (310), `banner`, `app`, `loginView`, `tableWrap`, `tabNav` all in markup. `summaryPanel` intentionally absent — guarded with `if (summary)` / `typeof loadSummary === 'function'` per brief (Task 12 adds it).
- **`data-code` / aria-labels**: `<tr>` `data-code` (line 505), table `aria-label` (491), checkbox `aria-label`s (516, 519), `var code = tr.getAttribute('data-code')` (603).
- **Files changed**: `Index.html` only (`git show --stat` → 1 file changed, 70 insertions(+), 31 deletions(-)).

## Concerns

- None blocking. All "replace this block" texts matched the current file cleanly; no Task 10 drift encountered.
- Browser testing (brief Step 8's login/tick/refresh/session-expiry walkthrough) not performed — no browser available; deferred to Task 13.
- `#summaryPanel` markup and `loadSummary()` come in Task 12; the guards here are inert until then, as intended.

## Report status

DONE.
