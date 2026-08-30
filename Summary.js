/**
 * Admin summary: per-secretary Done(طباعة)/Sent(أنجاز)/un-tick(تراجع) counts
 * for a given day, plus the oldest still-pending request age (live, in hours).
 * Pure aggregation + a thin getAdminSummary wrapper.
 */

function dateInTz_(dateObj, tz) {
  if (typeof Utilities !== 'undefined' && Utilities && Utilities.formatDate) {
    return Utilities.formatDate(dateObj, tz, 'yyyy-MM-dd');
  }
  return dateObj.toISOString().slice(0, 10); // Node tests use UTC dates
}

function aggregateSummary_(logRows, dataRowsBySheet, dateStr, tz) {
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

  (logRows || []).forEach(function (r) {
    var when = asDate(r[0]);
    if (!when || dateInTz_(when, tz) !== dateStr) return;
    var sec = String(r[4] == null ? '' : r[4]).trim();
    if (!sec) return;
    var action = String(r[5] || '');
    var newVal = String(r[7] == null ? '' : r[7]);
    var b = bucket(sec);
    if (newVal === '') { b.untick++; return; }
    if (action === 'done') b.done++;
    else if (action === 'sent') b.sent++;
  });

  var now = Date.now();
  Object.keys(dataRowsBySheet || {}).forEach(function (sheetName) {
    dataRowsBySheet[sheetName].forEach(function (row) {
      var sec = String(row[COL.SECRETARIAT] == null ? '' : row[COL.SECRETARIAT]).trim();
      if (!sec) return;
      var b = bucket(sec);

      // current تعديل state (col P/Q) — live, not date-filtered
      var mstate = modifyState_(row[COL.MODIFY_WRONG], row[COL.MODIFY_FIXED]);
      if (mstate === 'wrong') b.wrong++;
      else if (mstate === 'fixed') b.fixed++;

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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { dateInTz_: dateInTz_, aggregateSummary_: aggregateSummary_ };
}
