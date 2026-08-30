## Task 9: Admin summary endpoint

**Files:**
- Modify: `Summary.js` (append `getAdminSummary` before `module.exports`)

**Interfaces:**
- Consumes: `aggregateSummary_` (Task 8); `requireSession_` (Task 4); `getSpreadsheet_`, `TABS_CONFIG`, `SHEET_COLUMN_COUNT` (`Code.js`); `ACTIVITY_SHEET` (Task 2).
- Produces:
  - `getAdminSummary(token, dateStr) -> { date:string, rows:[...] }`. `requireSession_`; throws `Error('AUTH')` if role ≠ admin. `dateStr` optional — defaults to today in script timezone.

- [ ] **Step 1: Append `getAdminSummary` to `Summary.js`**

```js
// Called via google.script.run by the admin view. dateStr 'yyyy-MM-dd' or ''.
function getAdminSummary(token, dateStr) {
  var session = requireSession_(token);
  if (session.role !== 'admin') throw new Error('AUTH');

  var tz = Session.getScriptTimeZone();
  if (!dateStr) dateStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  var ss = getSpreadsheet_();

  var logSheet = ss.getSheetByName(ACTIVITY_SHEET);
  var logRows = (logSheet && logSheet.getLastRow() > 1)
    ? logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 8).getValues()
    : [];

  var dataRowsBySheet = {};
  TABS_CONFIG.forEach(function (tab) {
    var sheet = ss.getSheetByName(tab.sheetName);
    dataRowsBySheet[tab.sheetName] = (sheet && sheet.getLastRow() > 1)
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, SHEET_COLUMN_COUNT).getValues()
      : [];
  });

  return { date: dateStr, rows: aggregateSummary_(logRows, dataRowsBySheet, dateStr, tz) };
}
```

- [ ] **Step 2: Push and smoke-test**

Run: `clasp push -f`
Paste/run/delete in the editor:

```js
function _tmpSummary() {
  var s = login('a1', 'a11');
  Logger.log(JSON.stringify(getAdminSummary(s.token, ''), null, 2));
  var sec = login('h1', 'h11');
  try { getAdminSummary(sec.token, ''); Logger.log('BUG: secretary got summary'); }
  catch (e) { Logger.log('OK secretary blocked: ' + e.message); }
  logout(s.token); logout(sec.token);
}
```

Expected: a JSON object with `date` = today and a `rows` array (one entry per secretary that has activity or pending rows); then `OK secretary blocked: AUTH`. Delete `_tmpSummary`.

- [ ] **Step 3: Commit**

```bash
git add Summary.js
git commit -m "feat: getAdminSummary endpoint (admin-only)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

