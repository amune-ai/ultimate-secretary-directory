/**
 * One-time / idempotent setup. Adds the four tracking-column headers
 * (DoneAt, DoneBy, SentAt, SentBy = columns L..O) to every data tab if
 * they are not already present. Never touches existing data. Safe to
 * re-run. Run manually from the Apps Script editor after deploying.
 */
function setup_() {
  var ss = getSpreadsheet_();
  var headers = ['DoneAt', 'DoneBy', 'SentAt', 'SentBy']; // L, M, N, O
  TABS_CONFIG.forEach(function (tab) {
    var sheet = ss.getSheetByName(tab.sheetName);
    if (!sheet) { Logger.log('setup_: missing data sheet ' + tab.sheetName); return; }
    for (var i = 0; i < headers.length; i++) {
      var col = COL.DONE_AT + 1 + i; // 12..15 (1-based)
      var cell = sheet.getRange(1, col);
      if (String(cell.getValue()).trim() === '') {
        cell.setValue(headers[i]);
        Logger.log('setup_: added header ' + headers[i] + ' to ' + tab.sheetName);
      }
    }
  });
  Logger.log('setup_: done');
}
