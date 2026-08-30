/**
 * ============================================================
 * UPLOADS DASHBOARD — Web App
 * ============================================================
 * Shows 3 sheet tabs (UploadedData, UploadedVacations,
 * UploadedEqrarawdah) as a tabbed web app with custom labels,
 * custom header colors, a PDF icon that opens the file in a new
 * browser window, a "Done" tick column that turns the row green
 * and writes "Done" into column J, and an "أنجاز" tick column
 * that turns the row navy and writes "Sent" into column K.
 *
 * SETUP:
 * 1. Open your Google Sheet.
 * 2. Extensions > Apps Script.
 * 3. Replace the default Code.gs content with this file.
 * 4. Add a new HTML file named exactly "Index" and paste the
 *    Index.html content into it.
 * 5. Deploy > New deployment > type: Web app.
 *      - Execute as: Me
 *      - Who has access: choose based on who should view it
 *        (Anyone / Anyone within your org / Only myself)
 * 6. Click Deploy, authorize the requested permissions, and
 *    open the resulting web app URL.
 *
 * NOTE: Because this script is opened from inside the sheet
 * (Extensions > Apps Script), it is "bound" to that spreadsheet,
 * so getSpreadsheet_() below will automatically use it — no ID
 * needed. SPREADSHEET_ID is kept only as a fallback in case you
 * ever copy this into a standalone script project instead.
 */

var SPREADSHEET_ID = '1siA7v8Ib3tWyI-GNUHr-baUK2o61qQtZVWxsHcZBShA';

// --- Login + session config (added incrementally, slice 2) ---
var ADMIN_USERNAME = 'a1';       // this username gets the admin view; everyone else is a secretary
var LOGIN_SHEET = 'Login';       // tab layout: Username | Password | Name
var ACTIVITY_SHEET = 'ActivityLog'; // append-only audit: timestamp|sheet|code|username|name|action|old|new

var SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h, slid forward on each authenticated call
var SESSION_PREFIX = 'sess_';            // Script Property key prefix for sessions

var LOCKOUT_MAX = 5;         // wrong tries before a username is blocked
var LOCKOUT_WINDOW_S = 900;  // block duration in seconds (15 min)

var TABS_CONFIG = [
  {
    sheetName: 'UploadedData',
    label: 'Sick leaves uploads',
    headerBg: '#D32F2F',   // red
    headerColor: '#FFFFFF' // white
  },
  {
    sheetName: 'UploadedVacations',
    label: 'Vacations uploads',
    headerBg: '#FFC107',   // yellow
    headerColor: '#000000' // black
  },
  {
    sheetName: 'UploadedEqrarawdah',
    label: 'إعلام عودة uploads',
    headerBg: '#000080',   // navy
    headerColor: '#FFFFFF' // white
  }
];

// Display order in the web app. "Done" and "أنجاز" are the tick/checkbox columns.
var COLUMN_HEADERS = ['Timestamp', 'Name', 'ID', 'Center', 'Summary Dropdown', 'سكرتارية', 'Code', 'PDF Links', 'Done', 'أنجاز'];

// Where each field actually lives in the sheet (0-based index within
// the A:K range read below). Column B is currently unused.
var COL = {
  TIMESTAMP: 0, // A
  ID: 2,        // C
  SUMMARY: 3,   // D
  CODE: 4,      // E
  PDF: 5,       // F
  NAME: 6,      // G
  CENTER: 7,    // H
  SECRETARIAT: 8, // I
  DONE: 9,      // J
  SENT: 10,     // K
  DONE_AT: 11,  // L  (accountability columns, added incrementally)
  DONE_BY: 12,  // M
  SENT_AT: 13,  // N
  SENT_BY: 14   // O
};
var SHEET_COLUMN_COUNT = 15; // A:O  (includes the L:O accountability columns)

function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  template.tabsConfigJson = JSON.stringify(TABS_CONFIG);
  template.columnHeadersJson = JSON.stringify(COLUMN_HEADERS);
  // Escape "<" so a cell containing "</script>" can't break out of the
  // inline <script> block in Index.html. "<" still parses as "<".
  template.tabsDataJson = JSON.stringify(getAllTabsData_()).replace(/</g, '\\u003c');
  return template.evaluate()
    .setTitle('Uploads Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getSpreadsheet_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (err) {
    // not bound to a spreadsheet, fall through to openById
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// Public entry point the client calls (via google.script.run) to re-pull
// fresh data from the sheet without reloading the whole page. Apps Script
// won't let client code call a function whose name ends in "_", which is
// why getAllTabsData_() itself can't be called directly from Index.html.
function refreshTabsData() {
  return getAllTabsData_();
}

// The web app is deployed with anonymous access, so anyone can call the
// functions below. Reject any sheetName that isn't one of our configured
// tabs before writing anything.
function assertKnownSheet_(sheetName) {
  var known = TABS_CONFIG.some(function (t) { return t.sheetName === sheetName; });
  if (!known) throw new Error('Unknown sheet: ' + sheetName);
}

// Public entry point the client calls when the tick checkbox is toggled.
// Writes "Done" (or clears it) into column J of that exact row.
// sheetRow is the real 1-based row number in the sheet, returned to the
// client as part of each row's data so it round-trips back here.
function setRowDone(sheetName, sheetRow, done) {
  assertKnownSheet_(sheetName);
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  sheet.getRange(sheetRow, COL.DONE + 1).setValue(done ? 'Done' : '');
  return true;
}

// Same idea as setRowDone(), for the "أنجاز" tick column. Writes "Sent"
// (or clears it) into column K of that exact row.
function setRowSent(sheetName, sheetRow, sent) {
  assertKnownSheet_(sheetName);
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  sheet.getRange(sheetRow, COL.SENT + 1).setValue(sent ? 'Sent' : '');
  return true;
}

// Unscoped read of all tabs — used by the current (pre-login) doGet embed and
// the no-arg refreshTabsData. Superseded by getBootstrapData once the client
// sends a token (slice 5).
function getAllTabsData_() {
  return readAllTabs_(null);
}

// scope = a secretary name to filter to, or null/'' for everything (admin).
function readAllTabs_(scope) {
  var ss = getSpreadsheet_();
  var out = {};
  TABS_CONFIG.forEach(function (tab) {
    out[tab.sheetName] = getSheetRows_(ss, tab.sheetName, scope);
  });
  return out;
}

// requireSession_ + per-role scoping. The client calls this after login (slice 5).
function getBootstrapData(token) {
  var session = requireSession_(token);
  return {
    tabsData: readAllTabs_(session.role === 'admin' ? null : session.name),
    name: session.name,
    role: session.role
  };
}

function getSheetRows_(ss, sheetName, scope) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return []; // no data below header row
  var values = sheet.getRange(2, 1, lastRow - 1, SHEET_COLUMN_COUNT).getValues();
  return shapeSheetValues_(values, scope);
}

// Pure: raw A2:O values -> display rows, newest first. scope filters by the
// سكرتارية column (trimmed, both sides); falsy scope = no filter.
function shapeSheetValues_(values, scope) {
  var wantScope = scope ? String(scope).trim() : '';
  return values
    .map(function (row, i) { return { row: row, sheetRow: i + 2 }; })
    .filter(function (item) {
      return item.row.some(function (cell) { return cell !== '' && cell !== null; });
    })
    .filter(function (item) {
      return !wantScope || String(item.row[COL.SECRETARIAT]).trim() === wantScope;
    })
    .sort(function (a, b) {
      return timestampValue_(b.row[COL.TIMESTAMP]) - timestampValue_(a.row[COL.TIMESTAMP]);
    })
    .map(function (item) {
      var row = item.row;
      return {
        sheetRow: item.sheetRow,
        code: String(row[COL.CODE] || ''),
        done: isDone_(row[COL.DONE]),
        sent: isSent_(row[COL.SENT]),
        cells: [
          formatTimestamp_(row[COL.TIMESTAMP]),
          row[COL.NAME] || '',
          row[COL.ID] || '',
          row[COL.CENTER] || '',
          row[COL.SUMMARY] || '',
          row[COL.SECRETARIAT] || '',
          row[COL.CODE] || '',
          row[COL.PDF] || ''
        ]
      };
    });
}

function isDone_(value) {
  return String(value || '').trim().toLowerCase() === 'done';
}

function isSent_(value) {
  return String(value || '').trim().toLowerCase() === 'sent';
}

function timestampValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return value.getTime();
  }
  var parsed = new Date(value);
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function formatTimestamp_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }
  return value || '';
}


/**
 * Standalone data sync — unrelated to the dashboard. Pulls A1:S from the
 * "DocName" tab of the external "أسماء الاطباء" spreadsheet into this
 * sheet's own "DocName" tab. Driven by a time-based trigger.
 */
function syncDataFast() {
  const destSS = SpreadsheetApp.getActiveSpreadsheet();

  // 1. CONFIGURATION: List your sources and destinations here
  const syncJobs = [
    {
      sourceId: "1OWT7kh-yUzO_gn9qLmTjdOYZ9DKUDf3-HiyFwSFpTFE", // أسماء الاطباء
      sourceTab: "DocName",
      sourceRange: "A1:S",
      destTab: "DocName",
      destRow: 1,
      destCol: 1
    }
  ];

  // 2. EXECUTION: Loop through each job defined above
  syncJobs.forEach(function(job) {
    try {
      // Connect to Source
      const sourceSS = SpreadsheetApp.openById(job.sourceId);
      const sourceSheet = sourceSS.getSheetByName(job.sourceTab);
      const data = sourceSheet.getRange(job.sourceRange).getValues();

      // Connect to Destination
      const destSheet = destSS.getSheetByName(job.destTab);

      // Clear ONLY the area where data is about to be pasted
      // This prevents old data from staying behind if the new pull is smaller
      destSheet.getRange(job.destRow, job.destCol, destSheet.getLastRow() || 1, data[0].length).clearContent();

      // Paste the fresh data
      destSheet.getRange(job.destRow, job.destCol, data.length, data[0].length).setValues(data);

      console.log(`Success: ${job.sourceTab} synced to ${job.destTab}`);

    } catch (e) {
      console.log(`Error syncing ${job.sourceTab}: ${e.message}`);
    }
  });

  console.log("Global Sync Finished: " + new Date());
}
