/**
 * Page 2 — "استفسارات و طلبات الأطباء". Same login-scoped monitoring as the
 * original dashboard (page 1), but reading a single tab, "SecActions" (kept
 * filled by the standalone syncDataFast() job), with a different column
 * layout: no Code column, no PDF column.
 *
 * ponytail: SecActions has no dedicated Code column, and syncDataFast()
 * clears + rewrites its A:H block on every sync, so a row's physical
 * position isn't stable either. The stable row key here is a synthetic
 * "Timestamp|ID" string (rowKey2_) recomputed live on every read/write,
 * instead of a stored Code. It collides only if two rows share the exact
 * same timestamp AND ID — degrades the same way a duplicate Code would
 * (AMBIGUOUS, resolved by the row-number hint the client already sends).
 */

var TABS_CONFIG2 = [
  { sheetName: 'SecActions', label: 'المواضيع', headerBg: '#006391', headerColor: '#FFFFFF' }
];

// Display order in page 2's tables. No Code / PDF Links columns.
var COLUMN_HEADERS2 = ['Timestamp', 'Name', 'ID', 'Center', 'Message', 'السكرتارية', 'استلام', 'أنجاز', 'تعديل'];

// Column layout of the SecActions tab (0-based). A:H come from the synced
// source (only A, B, C, D, G, H are used); L:Q are this app's own tracking
// columns, laid out identically to COL (page 1) so setup()/modifyState_ etc.
// work unchanged.
var COL2 = {
  TIMESTAMP: 0,     // A
  NAME: 1,          // B
  ID: 2,            // C
  MESSAGE: 3,       // D
  CENTER: 6,        // G
  SECRETARIAT: 7,   // H
  DONE: 9,          // J
  SENT: 10,         // K
  DONE_AT: 11,      // L
  DONE_BY: 12,      // M
  SENT_AT: 13,      // N
  SENT_BY: 14,      // O
  MODIFY_WRONG: 15, // P
  MODIFY_FIXED: 16, // Q
  ERASED: 17        // R  "مسح" — admin-only soft-hide, see setRowErased2 in Activity2.js
};
var SHEET_COLUMN_COUNT2 = 18; // A:R

function isErased_(value) {
  return String(value || '').trim().toLowerCase() === 'erased';
}

function assertKnownSheet2_(sheetName) {
  var known = TABS_CONFIG2.some(function (t) { return t.sheetName === sheetName; });
  if (!known) throw new Error('Unknown sheet: ' + sheetName);
}

// Synthetic stable key — see the ponytail note at the top of this file.
function rowKey2_(row) {
  return String(timestampValue_(row[COL2.TIMESTAMP])) + '|' + String(row[COL2.ID] == null ? '' : row[COL2.ID]).trim();
}

// Pure: raw A2:Q values -> display rows, newest first. scope filters by the
// السكرتارية column (trimmed, both sides); falsy scope = no filter.
function shapeSheetValues2_(values, scope) {
  var wantScope = scope ? String(scope).trim() : '';
  return values
    .map(function (row, i) { return { row: row, sheetRow: i + 2 }; })
    .filter(function (item) {
      // SecActions is synced from an open-ended source range, which pulls
      // the source sheet's full row extent (often ~1000 rows) — most of it
      // blank. A stray formatting artifact/whitespace cell anywhere in the
      // 17-wide row is enough to look "non-empty", so check the two fields
      // a row actually needs (Timestamp + ID) instead of any of the 17.
      var ts = item.row[COL2.TIMESTAMP];
      var id = String(item.row[COL2.ID] == null ? '' : item.row[COL2.ID]).trim();
      return (ts !== '' && ts !== null) && id !== '';
    })
    .filter(function (item) {
      return !wantScope || String(item.row[COL2.SECRETARIAT]).trim() === wantScope;
    })
    .filter(function (item) {
      // مسح (erased) rows are an admin-only soft-hide: a scoped (secretary)
      // read never sees them; an unscoped (admin) read keeps them, flagged.
      return !wantScope || !isErased_(item.row[COL2.ERASED]);
    })
    .sort(function (a, b) {
      return timestampValue_(b.row[COL2.TIMESTAMP]) - timestampValue_(a.row[COL2.TIMESTAMP]);
    })
    .map(function (item) {
      var row = item.row;
      return {
        sheetRow: item.sheetRow,
        code: rowKey2_(row),
        done: isDone_(row[COL2.DONE]),
        sent: isSent_(row[COL2.SENT]),
        modify: modifyState_(row[COL2.MODIFY_WRONG], row[COL2.MODIFY_FIXED]),
        erased: isErased_(row[COL2.ERASED]),
        cells: [
          formatTimestamp_(row[COL2.TIMESTAMP]),
          row[COL2.NAME] || '',
          row[COL2.ID] || '',
          row[COL2.CENTER] || '',
          row[COL2.MESSAGE] || '',
          row[COL2.SECRETARIAT] || ''
        ]
      };
    });
}

function getSheetRows2_(ss, sheetName, scope) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, SHEET_COLUMN_COUNT2).getValues();
  return shapeSheetValues2_(values, scope);
}

function readAllTabs2_(scope) {
  var ss = getSpreadsheet_();
  var out = {};
  TABS_CONFIG2.forEach(function (tab) {
    out[tab.sheetName] = getSheetRows2_(ss, tab.sheetName, scope);
  });
  return out;
}

function getBootstrapData2(token) {
  var session = requireSession_(token);
  return {
    tabsConfig: TABS_CONFIG2,
    columnHeaders: COLUMN_HEADERS2,
    tabsData: readAllTabs2_(session.role === 'admin' ? null : session.name),
    name: session.name,
    role: session.role
  };
}

function refreshTabsData2(token) {
  var session = requireSession_(token);
  return readAllTabs2_(session.role === 'admin' ? null : session.name);
}
