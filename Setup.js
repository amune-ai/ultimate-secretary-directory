/**
 * One-time / idempotent setup. Adds the four tracking-column headers
 * (DoneAt, DoneBy, SentAt, SentBy = columns L..O) to every data tab if
 * they are not already present. Never touches existing data. Safe to
 * re-run. Run manually from the Apps Script editor after deploying.
 */
function setup() {
  var ss = getSpreadsheet_();
  var headers = ['DoneAt', 'DoneBy', 'SentAt', 'SentBy']; // L, M, N, O
  TABS_CONFIG.forEach(function (tab) {
    var sheet = ss.getSheetByName(tab.sheetName);
    if (!sheet) { Logger.log('setup: missing data sheet ' + tab.sheetName); return; }
    for (var i = 0; i < headers.length; i++) {
      var col = COL.DONE_AT + 1 + i; // 12..15 (1-based)
      var cell = sheet.getRange(1, col);
      if (String(cell.getValue()).trim() === '') {
        cell.setValue(headers[i]);
        Logger.log('setup: added header ' + headers[i] + ' to ' + tab.sheetName);
      }
    }
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
    { username: 'a1', password: 'a11', name: 'Admin Name' },
    { username: 'h1', password: 'h11', name: 'Test Secretary' }
  ];
  eq(checkCredentials_(rows, 'A1', 'a11').role, 'admin', 'admin role');
  eq(checkCredentials_(rows, 'h1', 'h11').role, 'secretary', 'secretary role');
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

/**
 * Prints the Login tab exactly as the server reads it — username and name
 * verbatim, password as a character count plus a "quoted" copy so stray
 * spaces are visible. Use it to confirm each Name matches the سكرتارية
 * column spelling. (Execution log is visible only to you.)
 */
function dumpLogin() {
  var rows = readLoginRows_();
  Logger.log('Login tab: ' + rows.length + ' row(s)');
  rows.forEach(function (r, i) {
    Logger.log(
      'row ' + (i + 2) + ' | username="' + r.username + '"' +
      ' | password ' + String(r.password).length + ' chars ["' + r.password + '"]' +
      ' | name="' + r.name + '"'
    );
  });
}

/**
 * Real end-to-end login test. Put a genuine username + password below,
 * Run, read the log:
 *   {"ok":true,"role":"...","name":"..."}  -> login works
 *   {"ok":false,"error":"bad_credentials"} -> username/password mismatch
 *   {"ok":false,"error":"locked"}          -> 5 bad tries, wait 15 min
 */
function tryLogin() {
  var USERNAME = 'PUT_USERNAME_HERE';
  var PASSWORD = 'PUT_PASSWORD_HERE';
  var res = login(USERNAME, PASSWORD);
  Logger.log(JSON.stringify(res));
}

/**
 * Logs in with the credentials below, then calls getBootstrapData with that
 * token — the exact server path that runs right after login in the browser.
 * Logs the role, name, and how many rows each tab returns (scoped for a
 * secretary, everything for the admin).
 */
function tryBootstrap() {
  var USERNAME = 'PUT_USERNAME_HERE';
  var PASSWORD = 'PUT_PASSWORD_HERE';
  var lg = login(USERNAME, PASSWORD);
  if (!lg.ok) { Logger.log('login failed: ' + JSON.stringify(lg)); return; }
  var data = getBootstrapData(lg.token);
  Logger.log('role=' + data.role + '  name="' + data.name + '"');
  Object.keys(data.tabsData).forEach(function (k) {
    Logger.log(k + ': ' + data.tabsData[k].length + ' row(s)');
  });
  logout(lg.token);
}

/**
 * Logs in, then sets Done on one row (by its Code / column E value) and
 * clears it again — exercising writeTick_ + the ActivityLog append. Fill in
 * a real CODE from column E of a row in the chosen SHEET.
 */
function tryTick() {
  var USERNAME = 'PUT_USERNAME_HERE';
  var PASSWORD = 'PUT_PASSWORD_HERE';
  var SHEET = 'UploadedData';
  var CODE = 'PUT_A_REAL_CODE_FROM_COLUMN_E';
  var lg = login(USERNAME, PASSWORD);
  if (!lg.ok) { Logger.log('login failed: ' + JSON.stringify(lg)); return; }
  Logger.log('set Done  -> ' + JSON.stringify(writeTick_(lg.token, SHEET, CODE, 0, 'done', true)));
  Logger.log('clear Done -> ' + JSON.stringify(writeTick_(lg.token, SHEET, CODE, 0, 'done', false)));
  logout(lg.token);
}
