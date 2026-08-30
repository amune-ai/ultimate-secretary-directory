## Task 7: Tick write glue — setRowDone / setRowSent / activity log

**Files:**
- Modify: `Activity.js` (append glue before `module.exports`)
- Modify: `Setup.js` (`runTests_()` — add pure-logic assertions for the ownership/order rules by extracting them into a testable helper)

**Interfaces:**
- Consumes: `findRowByCode_` (Task 6); `requireSession_` (Task 4); `assertKnownSheet_`, `getSpreadsheet_`, `COL`, `SHEET_COLUMN_COUNT`, `isDone_`, `isSent_` (`Code.js`); `ACTIVITY_SHEET` (Task 2).
- Produces:
  - `tickGuard_(session, row, action, value) -> void` (pure) — throws `Error('NOT_YOUR_ROW')` if `session.role !== 'admin'` and `row[COL.SECRETARIAT]` trimmed ≠ `session.name` trimmed; throws `Error('DONE_FIRST')` if `action==='sent' && value && !isDone_(row[COL.DONE])`.
  - `writeTick_(token, sheetName, code, rowHint, action, value) -> {code:string, done:boolean, sent:boolean}`.
  - `setRowDone(token, sheetName, code, rowHint, done) -> {code, done, sent}`.
  - `setRowSent(token, sheetName, code, rowHint, sent) -> {code, done, sent}`.
  - `appendActivity_(sheetName, code, session, action, oldValue, newValue) -> void` — appends `[new Date(), sheetName, code, session.username, session.name, action, oldValue, newValue]` to `ActivityLog`.

- [ ] **Step 1: Add pure `tickGuard_` assertions to `tests/activity.test.js`**

Append:

```js
global.isDone_ = v => String(v || '').trim().toLowerCase() === 'done';
const { tickGuard_ } = require('../Activity.js');

const secRow = new Array(15).fill('');
secRow[8] = 'حصة الردهان';   // I secretariat
secRow[9] = '';               // J done (blank)

const adminS = { role: 'admin', name: 'Someone', username: 'a1' };
const hessa  = { role: 'secretary', name: 'حصة الردهان', username: 'h1' };
const wadha  = { role: 'secretary', name: 'وضحة الحجرف', username: 'w1' };

// admin can do anything
assert.doesNotThrow(() => tickGuard_(adminS, secRow, 'done', true));
// owner ok
assert.doesNotThrow(() => tickGuard_(hessa, secRow, 'done', true));
// non-owner blocked
assert.throws(() => tickGuard_(wadha, secRow, 'done', true), /NOT_YOUR_ROW/);
// sent before done blocked
assert.throws(() => tickGuard_(hessa, secRow, 'sent', true), /DONE_FIRST/);
// sent allowed once done
const doneRow = secRow.slice(); doneRow[9] = 'Done';
assert.doesNotThrow(() => tickGuard_(hessa, doneRow, 'sent', true));
// un-ticking sent is never blocked by order
assert.doesNotThrow(() => tickGuard_(hessa, secRow, 'sent', false));

console.log('activity.test.js guard OK');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/activity.test.js`
Expected: FAIL — `tickGuard_ is not a function`.

- [ ] **Step 3: Append glue to `Activity.js`** (before the `module.exports` block, and add `tickGuard_` to the exports)

```js
// Pure guard: ownership + Done-before-Sent ordering.
function tickGuard_(session, row, action, value) {
  if (session.role !== 'admin' &&
      String(row[COL.SECRETARIAT]).trim() !== String(session.name).trim()) {
    throw new Error('NOT_YOUR_ROW');
  }
  if (action === 'sent' && value && !isDone_(row[COL.DONE])) {
    throw new Error('DONE_FIRST');
  }
}

function appendActivity_(sheetName, code, session, action, oldValue, newValue) {
  var sheet = getSpreadsheet_().getSheetByName(ACTIVITY_SHEET);
  if (!sheet) throw new Error('ActivityLog sheet missing');
  sheet.appendRow([
    new Date(), sheetName, String(code), session.username, session.name,
    action, String(oldValue), String(newValue)
  ]);
}

function writeTick_(token, sheetName, code, rowHint, action, value) {
  var session = requireSession_(token);
  assertKnownSheet_(sheetName);

  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('NOT_FOUND');

  var values = sheet.getRange(2, 1, lastRow - 1, SHEET_COLUMN_COUNT).getValues();
  var loc = findRowByCode_(values, code, rowHint);
  var row = values[loc.index0];

  tickGuard_(session, row, action, value);

  var valueCol = (action === 'done') ? COL.DONE : COL.SENT;
  var atCol    = (action === 'done') ? COL.DONE_AT : COL.SENT_AT;
  var byCol    = (action === 'done') ? COL.DONE_BY : COL.SENT_BY;
  var word     = (action === 'done') ? 'Done' : 'Sent';

  var oldValue = String(row[valueCol] || '');
  var newValue = value ? word : '';

  sheet.getRange(loc.sheetRow, valueCol + 1).setValue(newValue);
  sheet.getRange(loc.sheetRow, atCol + 1).setValue(value ? new Date() : '');
  sheet.getRange(loc.sheetRow, byCol + 1).setValue(value ? session.username : '');

  appendActivity_(sheetName, String(code).trim(), session, action, oldValue, newValue);

  var doneNow = (action === 'done') ? !!value : isDone_(row[COL.DONE]);
  var sentNow = (action === 'sent') ? !!value : isSent_(row[COL.SENT]);
  return { code: String(code).trim(), done: doneNow, sent: sentNow };
}

function setRowDone(token, sheetName, code, rowHint, done) {
  return writeTick_(token, sheetName, code, rowHint, 'done', !!done);
}

function setRowSent(token, sheetName, code, rowHint, sent) {
  return writeTick_(token, sheetName, code, rowHint, 'sent', !!sent);
}
```

Update the export block at the bottom of `Activity.js` to:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { findRowByCode_: findRowByCode_, tickGuard_: tickGuard_ };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node tests/activity.test.js`
Expected: both `activity.test.js OK` and `activity.test.js guard OK`.

- [ ] **Step 5: Push and smoke-test a real write**

Run: `clasp push -f`
Then paste, run, and delete this temp function in the editor (replace `<CODE>` with a real `Code` value from `UploadedData`, `<SEC>` with that row's سكرتارية):

```js
function _tmpTick() {
  var s = login('a1', 'a11');                 // admin, bypasses ownership
  Logger.log(setRowDone(s.token, 'UploadedData', '<CODE>', 0, true));
  Logger.log(setRowDone(s.token, 'UploadedData', '<CODE>', 0, false)); // undo
  logout(s.token);
}
```

Expected: first log `{code=<CODE>, done=true, sent=false}`; the `UploadedData` row shows `Done` in J, a timestamp in L, `a1` in M, then all cleared; `ActivityLog` gains two rows (`done` set then un-set). Delete `_tmpTick`.

- [ ] **Step 6: Commit**

```bash
git add Activity.js tests/activity.test.js
git commit -m "feat: setRowDone/setRowSent with ownership, ordering, activity log

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

