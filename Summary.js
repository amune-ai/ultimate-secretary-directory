/**
 * Admin summary, per secretary, across all 3 tabs. Current-state, not events —
 * so it matches the طباعة-section badges summed over the 3 tabs:
 *   طباعة     = her rows currently ticked طباعة (col J)
 *   أنجاز     = her rows currently ticked أنجاز (col K)
 *   خطأ انجاز = her rows ever flagged (col P)     تعديل = of those, fixed (col Q)
 *   أقدم طلب معلّق (ساعات) = age of her oldest row with no طباعة yet
 *   تراجع     = the one lifetime event count — how many un-ticks she caused
 *              (from ActivityLog; there is no "current state" for an undo)
 * Pure aggregation + a thin getAdminSummary wrapper.
 */

function aggregateSummary_(logRows, dataRowsBySheet) {
  var perSec = {};
  function bucket(name) {
    if (!perSec[name]) {
      perSec[name] = { secretary: name, done: 0, sent: 0, untick: 0, wrong: 0, fixed: 0, oldestPendingHours: 0 };
    }
    return perSec[name];
  }
  function asDate(v) {
    if (v instanceof Date) return v;
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  // code -> the row's current سكرتارية, so every ActivityLog entry is credited
  // to the row's owner (not whoever clicked). Falls back to the log's recorded
  // name if the Code no longer exists in the sheet.
  var ownerByCode = {};
  Object.keys(dataRowsBySheet || {}).forEach(function (sheetName) {
    dataRowsBySheet[sheetName].forEach(function (row) {
      var c = String(row[COL.CODE] == null ? '' : row[COL.CODE]).trim();
      var o = String(row[COL.SECRETARIAT] == null ? '' : row[COL.SECRETARIAT]).trim();
      if (c && o) ownerByCode[c] = o;
    });
  });

  // تراجع — the only event-based column: count un-tick rows in ActivityLog.
  (logRows || []).forEach(function (r) {
    if (String(r[5] || '') === 'modify') return;
    if (String(r[7] == null ? '' : r[7]) !== '') return; // keep only un-ticks (newValue empty)
    var code = String(r[2] == null ? '' : r[2]).trim();
    var sec = ownerByCode[code] || String(r[4] == null ? '' : r[4]).trim();
    if (sec) bucket(sec).untick++;
  });

  var now = Date.now();
  Object.keys(dataRowsBySheet || {}).forEach(function (sheetName) {
    dataRowsBySheet[sheetName].forEach(function (row) {
      var sec = String(row[COL.SECRETARIAT] == null ? '' : row[COL.SECRETARIAT]).trim();
      if (!sec) return;
      var b = bucket(sec);

      // current state — same predicates the طباعة-section badges use
      if (isDone_(row[COL.DONE])) b.done++;
      if (isSent_(row[COL.SENT])) b.sent++;

      // تعديل state (col P/Q): wrong = ever flagged (P set, stays after fixing);
      // fixed = of those, the ones since corrected (Q set).
      var mstate = modifyState_(row[COL.MODIFY_WRONG], row[COL.MODIFY_FIXED]);
      if (mstate === 'wrong' || mstate === 'fixed') b.wrong++;
      if (mstate === 'fixed') b.fixed++;

      // oldest still-pending (no طباعة yet)
      if (!isDone_(row[COL.DONE])) {
        var t = asDate(row[COL.TIMESTAMP]);
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
      secretary: b.secretary, done: b.done, sent: b.sent, untick: b.untick,
      wrong: b.wrong, fixed: b.fixed,
      oldestPendingHours: Math.round(b.oldestPendingHours * 10) / 10
    };
  });
}

// Called via google.script.run by the admin view. All-time, no date filter.
function getAdminSummary(token) {
  var session = requireSession_(token);
  if (session.role !== 'admin') throw new Error('AUTH');

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

  return { rows: aggregateSummary_(logRows, dataRowsBySheet) };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { aggregateSummary_: aggregateSummary_ };
}
