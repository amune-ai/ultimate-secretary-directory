/**
 * Done / أنجاز(Sent) tick writes. Locates the target row by its immutable
 * Code (column E) rather than a row number, stamps DoneAt/DoneBy or
 * SentAt/SentBy, and appends an ActivityLog row.
 *
 * Slice 3: the engine (writeTick_) is here and testable via the editor
 * (tryTick). The public setRowDone/setRowSent entry points still live in
 * Code.js with their old 3-arg signature so the current web app keeps
 * working; slice 5 swaps them for the token-based versions.
 */

// values: raw A2:O 2D array. rowHint: 1-based sheet row from the client, used
// only to disambiguate a duplicate Code. Returns {index0, sheetRow}.
function findRowByCode_(values, code, rowHint) {
  var wanted = String(code == null ? '' : code).trim();
  if (wanted === '') throw new Error('NO_CODE');

  var matches = [];
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][COL.CODE]).trim() === wanted) matches.push(i);
  }
  if (matches.length === 1) return { index0: matches[0], sheetRow: matches[0] + 2 };
  if (matches.length === 0) throw new Error('NOT_FOUND');

  var hintIdx0 = Number(rowHint) - 2;
  if (matches.indexOf(hintIdx0) !== -1) return { index0: hintIdx0, sheetRow: hintIdx0 + 2 };
  throw new Error('AMBIGUOUS');
}

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

  // Un-ticking Done cascades to Sent: a row must never be Sent-but-not-Done.
  if (action === 'done' && !value && isSent_(row[COL.SENT])) {
    sheet.getRange(loc.sheetRow, COL.SENT + 1).setValue('');
    sheet.getRange(loc.sheetRow, COL.SENT_AT + 1).setValue('');
    sheet.getRange(loc.sheetRow, COL.SENT_BY + 1).setValue('');
    appendActivity_(sheetName, String(code).trim(), session, 'sent', 'Sent', '');
  }

  var doneNow = (action === 'done') ? !!value : isDone_(row[COL.DONE]);
  var sentNow = (action === 'sent') ? !!value
              : (action === 'done' && !value ? false : isSent_(row[COL.SENT]));
  return { code: String(code).trim(), done: doneNow, sent: sentNow };
}

// Public entry points, called from the client as
//   google.script.run.setRowDone(token, sheetName, code, sheetRowHint, checked)
function setRowDone(token, sheetName, code, rowHint, done) {
  return writeTick_(token, sheetName, code, rowHint, 'done', !!done);
}

function setRowSent(token, sheetName, code, rowHint, sent) {
  return writeTick_(token, sheetName, code, rowHint, 'sent', !!sent);
}

// تعديل — a 3-state marker on col P ("Wrong") / col Q ("Fixed").
//   state 'wrong': P = "Wrong", Q = ""
//   state 'fixed': P = "Wrong" (kept), Q = "Fixed"
//   state 'none' : P = "", Q = ""
// Returns { code, modify }.
function setRowModify(token, sheetName, code, rowHint, state) {
  if (state !== 'none' && state !== 'wrong' && state !== 'fixed') throw new Error('BAD_STATE');
  var session = requireSession_(token);
  assertKnownSheet_(sheetName);

  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('NOT_FOUND');

  if (session.role !== 'admin') throw new Error('ADMIN_ONLY'); // secretaries see it, can't change it

  var values = sheet.getRange(2, 1, lastRow - 1, SHEET_COLUMN_COUNT).getValues();
  var loc = findRowByCode_(values, code, rowHint);
  var row = values[loc.index0];

  var prev = modifyState_(row[COL.MODIFY_WRONG], row[COL.MODIFY_FIXED]);
  sheet.getRange(loc.sheetRow, COL.MODIFY_WRONG + 1).setValue(state === 'none' ? '' : 'Wrong');
  sheet.getRange(loc.sheetRow, COL.MODIFY_FIXED + 1).setValue(state === 'fixed' ? 'Fixed' : '');

  appendActivity_(sheetName, String(code).trim(), session, 'modify', prev, state);

  return { code: String(code).trim(), modify: state };
}
