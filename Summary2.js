/**
 * Admin summary for page 2 (السكرتارية breakdown over the SecActions tab).
 * Mirrors Summary.js's aggregateSummary_ exactly, scoped to COL2/TABS_CONFIG2,
 * keyed by the synthetic rowKey2_ instead of a stored Code.
 */

function aggregateSummary2_(logRows, dataRowsBySheet) {
  var perSec = {};
  function bucket(name) {
    if (!perSec[name]) {
      perSec[name] = { secretary: name, pending: 0, done: 0, sent: 0, untick: 0, wrong: 0, fixed: 0, oldestPendingHours: 0 };
    }
    return perSec[name];
  }
  function asDate(v) {
    if (v instanceof Date) return v;
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  // key -> the row's current سكرتارية, so every ActivityLog entry is credited
  // to the row's owner (not whoever clicked).
  var ownerByKey = {};
  Object.keys(dataRowsBySheet || {}).forEach(function (sheetName) {
    dataRowsBySheet[sheetName].forEach(function (row) {
      var k = rowKey2_(row);
      var o = String(row[COL2.SECRETARIAT] == null ? '' : row[COL2.SECRETARIAT]).trim();
      if (k && o) ownerByKey[k] = o;
    });
  });

  var known = {};
  TABS_CONFIG2.forEach(function (t) { known[t.sheetName] = true; });

  // تراجع — the only event-based column: count un-tick rows in ActivityLog.
  (logRows || []).forEach(function (r) {
    if (!known[String(r[1] || '')]) return; // page-2 sheets only, not page 1's
    if (String(r[5] || '') === 'modify' || String(r[5] || '') === 'erase') return;
    if (String(r[7] == null ? '' : r[7]) !== '') return; // keep only un-ticks (newValue empty)
    var key = String(r[2] == null ? '' : r[2]).trim();
    var sec = ownerByKey[key] || String(r[4] == null ? '' : r[4]).trim();
    if (sec) bucket(sec).untick++;
  });

  var now = Date.now();
  Object.keys(dataRowsBySheet || {}).forEach(function (sheetName) {
    dataRowsBySheet[sheetName].forEach(function (row) {
      var sec = String(row[COL2.SECRETARIAT] == null ? '' : row[COL2.SECRETARIAT]).trim();
      if (!sec) return;
      var b = bucket(sec);

      if (isDone_(row[COL2.DONE])) b.done++;
      if (isSent_(row[COL2.SENT])) b.sent++;

      var mstate = modifyState_(row[COL2.MODIFY_WRONG], row[COL2.MODIFY_FIXED]);
      if (mstate === 'wrong' || mstate === 'fixed') b.wrong++;
      if (mstate === 'fixed') b.fixed++;

      if (!isDone_(row[COL2.DONE])) {
        b.pending++;
        var t = asDate(row[COL2.TIMESTAMP]);
        if (t) {
          var hrs = (now - t.getTime()) / 3600000;
          if (hrs > b.oldestPendingHours) b.oldestPendingHours = hrs;
        }
      }
    });
  });

  return Object.keys(perSec).sort().map(function (k) {
    var b = perSec[k];
    return {
      secretary: b.secretary, pending: b.pending, done: b.done, sent: b.sent, untick: b.untick,
      wrong: b.wrong, fixed: b.fixed,
      oldestPendingHours: Math.round(b.oldestPendingHours * 10) / 10
    };
  });
}

// Called via google.script.run by the admin view. All-time, no date filter.
function getAdminSummary2(token) {
  var session = requireSession_(token);
  if (session.role !== 'admin') throw new Error('AUTH');

  var ss = getSpreadsheet_();

  var logSheet = ss.getSheetByName(ACTIVITY_SHEET);
  var logRows = (logSheet && logSheet.getLastRow() > 1)
    ? logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 8).getValues()
    : [];

  var dataRowsBySheet = {};
  TABS_CONFIG2.forEach(function (tab) {
    var sheet = ss.getSheetByName(tab.sheetName);
    dataRowsBySheet[tab.sheetName] = (sheet && sheet.getLastRow() > 1)
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, SHEET_COLUMN_COUNT2).getValues()
      : [];
  });

  return { rows: aggregateSummary2_(logRows, dataRowsBySheet) };
}
