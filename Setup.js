/**
 * One-time / idempotent setup. Adds the tracking-column headers
 * (DoneAt, DoneBy, SentAt, SentBy = L..O; ModifyWrong, ModifyFixed = P, Q)
 * to every data tab if they are not already present. Never touches existing
 * data. Safe to re-run. Run manually from the Apps Script editor.
 */
function setup() {
  var ss = getSpreadsheet_();
  var headerByCol = {}; // 0-based COL index -> header text
  headerByCol[COL.DONE_AT] = 'DoneAt';
  headerByCol[COL.DONE_BY] = 'DoneBy';
  headerByCol[COL.SENT_AT] = 'SentAt';
  headerByCol[COL.SENT_BY] = 'SentBy';
  headerByCol[COL.MODIFY_WRONG] = 'ModifyWrong';
  headerByCol[COL.MODIFY_FIXED] = 'ModifyFixed';

  TABS_CONFIG.forEach(function (tab) {
    var sheet = ss.getSheetByName(tab.sheetName);
    if (!sheet) { Logger.log('setup: missing data sheet ' + tab.sheetName); return; }
    Object.keys(headerByCol).forEach(function (idx0) {
      var cell = sheet.getRange(1, Number(idx0) + 1);
      if (String(cell.getValue()).trim() === '') {
        cell.setValue(headerByCol[idx0]);
        Logger.log('setup: added header ' + headerByCol[idx0] + ' to ' + tab.sheetName);
      }
    });
  });
  Logger.log('setup: done');
}

/**
 * Editor test runner for the auth layer. Run from the Apps Script editor,
 * then read the execution log: "runTests: ALL PASS" or a thrown assertion.
 */
function runTests() {
  function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      throw new Error('FAIL ' + msg + ' -> got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b));
    }
  }
  function truthy(v, msg) { if (!v) throw new Error('FAIL ' + msg); }
  function throws(fn, msg) {
    var t = false; try { fn(); } catch (e) { t = true; }
    if (!t) throw new Error('FAIL (expected throw) ' + msg);
  }

  // checkCredentials_ against fake rows
  var rows = [
    { username: 'a1', password: 'a11', name: 'Admin Name' },                       // admin via safety-net
    { username: 'h1', password: 'h11', name: 'Test Secretary' },                   // secretary (no Role)
    { username: 'b1', password: 'b11', name: 'Boss Two', role: 'Admin' },          // admin via Role column
    { username: 'c1', password: 'c11', name: 'Sec Three', role: 'secretary' }      // explicit secretary
  ];
  eq(checkCredentials_(rows, 'A1', 'a11').role, 'admin', 'admin via safety-net');
  eq(checkCredentials_(rows, 'h1', 'h11').role, 'secretary', 'secretary (no Role cell)');
  eq(checkCredentials_(rows, 'b1', 'b11').role, 'admin', 'admin via Role column');
  eq(checkCredentials_(rows, 'c1', 'c11').role, 'secretary', 'explicit secretary Role');
  eq(checkCredentials_(rows, 'h1', 'wrong'), null, 'wrong password rejected');
  eq(checkCredentials_(rows, 'ghost', 'x'), null, 'unknown user rejected');
  eq(checkCredentials_([{ username: 's', password: 'p', name: '  ' }], 's', 'p'), null, 'blank-name secretary rejected');

  // session round-trip through Script Properties
  var made = createSession_({ username: 'h1', name: 'Test', role: 'secretary' });
  truthy(made.token && made.token.length > 30, 'token generated');
  eq(requireSession_(made.token).username, 'h1', 'requireSession_ returns the session');
  logout(made.token);
  throws(function () { requireSession_(made.token); }, 'session invalid after logout');

  Logger.log('runTests: ALL PASS');
}
