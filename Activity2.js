/**
 * Page 2 (SecActions) tick writes. Mirrors Activity.js exactly, except rows
 * are located by the synthetic rowKey2_ (Timestamp|ID — see the ponytail
 * note in Page2.js) instead of a stored Code column.
 */

// values: raw A2:Q 2D array. rowHint: 1-based sheet row from the client, used
// only to disambiguate a duplicate key. Returns {index0, sheetRow}.
function findRowByCode2_(values, code, rowHint) {
  var wanted = String(code == null ? '' : code).trim();
  if (wanted === '') throw new Error('NO_CODE');

  var matches = [];
  for (var i = 0; i < values.length; i++) {
    if (rowKey2_(values[i]) === wanted) matches.push(i);
  }
  if (matches.length === 1) return { index0: matches[0], sheetRow: matches[0] + 2 };
  if (matches.length === 0) throw new Error('NOT_FOUND');

  var hintIdx0 = Number(rowHint) - 2;
  if (matches.indexOf(hintIdx0) !== -1) return { index0: hintIdx0, sheetRow: hintIdx0 + 2 };
  throw new Error('AMBIGUOUS');
}

// Pure guard: ownership + Done-before-Sent ordering.
function tickGuard2_(session, row, action, value) {
  if (session.role !== 'admin' &&
      String(row[COL2.SECRETARIAT]).trim() !== String(session.name).trim()) {
    throw new Error('NOT_YOUR_ROW');
  }
  if (action === 'sent' && value && !isDone_(row[COL2.DONE])) {
    throw new Error('DONE_FIRST');
  }
}

function appendActivity2_(sheetName, code, session, action, oldValue, newValue) {
  var sheet = getSpreadsheet_().getSheetByName(ACTIVITY_SHEET);
  if (!sheet) throw new Error('ActivityLog sheet missing');
  sheet.appendRow([
    new Date(), sheetName, String(code), session.username, session.name,
    action, String(oldValue), String(newValue)
  ]);
}

function writeTick2_(token, sheetName, code, rowHint, action, value) {
  var session = requireSession_(token);
  assertKnownSheet2_(sheetName);

  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('NOT_FOUND');

  var values = sheet.getRange(2, 1, lastRow - 1, SHEET_COLUMN_COUNT2).getValues();
  var loc = findRowByCode2_(values, code, rowHint);
  var row = values[loc.index0];

  tickGuard2_(session, row, action, value);

  var valueCol = (action === 'done') ? COL2.DONE : COL2.SENT;
  var atCol    = (action === 'done') ? COL2.DONE_AT : COL2.SENT_AT;
  var byCol    = (action === 'done') ? COL2.DONE_BY : COL2.SENT_BY;
  var word     = (action === 'done') ? 'Done' : 'Sent';

  var oldValue = String(row[valueCol] || '');
  var newValue = value ? word : '';

  sheet.getRange(loc.sheetRow, valueCol + 1).setValue(newValue);
  sheet.getRange(loc.sheetRow, atCol + 1).setValue(value ? new Date() : '');
  sheet.getRange(loc.sheetRow, byCol + 1).setValue(value ? session.username : '');

  appendActivity2_(sheetName, String(code).trim(), session, action, oldValue, newValue);

  // Un-ticking Done cascades to Sent: a row must never be Sent-but-not-Done.
  if (action === 'done' && !value && isSent_(row[COL2.SENT])) {
    sheet.getRange(loc.sheetRow, COL2.SENT + 1).setValue('');
    sheet.getRange(loc.sheetRow, COL2.SENT_AT + 1).setValue('');
    sheet.getRange(loc.sheetRow, COL2.SENT_BY + 1).setValue('');
    appendActivity2_(sheetName, String(code).trim(), session, 'sent', 'Sent', '');
  }

  var doneNow = (action === 'done') ? !!value : isDone_(row[COL2.DONE]);
  var sentNow = (action === 'sent') ? !!value
              : (action === 'done' && !value ? false : isSent_(row[COL2.SENT]));
  return { code: String(code).trim(), done: doneNow, sent: sentNow };
}

// Public entry points, called from the client as
//   google.script.run.setRowDone2(token, sheetName, code, sheetRowHint, checked)
function setRowDone2(token, sheetName, code, rowHint, done) {
  return writeTick2_(token, sheetName, code, rowHint, 'done', !!done);
}

function setRowSent2(token, sheetName, code, rowHint, sent) {
  return writeTick2_(token, sheetName, code, rowHint, 'sent', !!sent);
}

// تعديل — same 3-state marker as page 1 (col P "Wrong" / col Q "Fixed").
function setRowModify2(token, sheetName, code, rowHint, state) {
  if (state !== 'none' && state !== 'wrong' && state !== 'fixed') throw new Error('BAD_STATE');
  var session = requireSession_(token);
  assertKnownSheet2_(sheetName);

  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('NOT_FOUND');

  if (session.role !== 'admin') throw new Error('ADMIN_ONLY'); // secretaries see it, can't change it

  var values = sheet.getRange(2, 1, lastRow - 1, SHEET_COLUMN_COUNT2).getValues();
  var loc = findRowByCode2_(values, code, rowHint);
  var row = values[loc.index0];

  var prev = modifyState_(row[COL2.MODIFY_WRONG], row[COL2.MODIFY_FIXED]);
  sheet.getRange(loc.sheetRow, COL2.MODIFY_WRONG + 1).setValue(state === 'none' ? '' : 'Wrong');
  sheet.getRange(loc.sheetRow, COL2.MODIFY_FIXED + 1).setValue(state === 'fixed' ? 'Fixed' : '');

  appendActivity2_(sheetName, String(code).trim(), session, 'modify', prev, state);

  return { code: String(code).trim(), modify: state };
}

// مسح — admin-only soft-hide on page 2's Pending table. Dims the row for
// admin; a secretary's next read excludes it entirely (see shapeSheetValues2_).
// Reversible: unchecking restores normal color for admin and visibility for
// the owning secretary.
function setRowErased2(token, sheetName, code, rowHint, erased) {
  var session = requireSession_(token);
  assertKnownSheet2_(sheetName);
  if (session.role !== 'admin') throw new Error('ADMIN_ONLY');

  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('NOT_FOUND');

  var values = sheet.getRange(2, 1, lastRow - 1, SHEET_COLUMN_COUNT2).getValues();
  var loc = findRowByCode2_(values, code, rowHint);
  var row = values[loc.index0];

  var oldValue = String(row[COL2.ERASED] || '');
  var newValue = erased ? 'Erased' : '';
  sheet.getRange(loc.sheetRow, COL2.ERASED + 1).setValue(newValue);

  appendActivity2_(sheetName, String(code).trim(), session, 'erase', oldValue, newValue);

  return { code: String(code).trim(), erased: !!erased };
}
