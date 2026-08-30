/**
 * Custom auth for the Uploads Dashboard. Plaintext-password check against
 * the Login tab, random session tokens in Script Properties, per-username
 * brute-force lockout in CacheService.
 *
 * ponytail: plaintext passwords in the Login sheet. Fine while the sheet
 * stays with the admin only. Upgrade path: hash-on-entry via an onEdit
 * trigger that salts + SHA-256s the Password cell and blanks it.
 */

function normalizeUsername_(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

// loginRows: [{username, password, name}] read verbatim from the Login tab.
// Returns {username, name, role} on an exact match (username case-insensitive,
// password case-sensitive, non-empty), else null.
function checkCredentials_(loginRows, username, password) {
  var u = normalizeUsername_(username);
  var p = String(password == null ? '' : password);
  if (p === '') return null;
  for (var i = 0; i < loginRows.length; i++) {
    var row = loginRows[i];
    if (normalizeUsername_(row.username) === u && String(row.password) === p) {
      var name = String(row.name == null ? '' : row.name).trim();
      var role = (u === normalizeUsername_(ADMIN_USERNAME)) ? 'admin' : 'secretary';
      if (role !== 'admin' && name === '') return null; // no name => no scope => no login
      return { username: u, name: name, role: role };
    }
  }
  return null;
}

function sessionValid_(session, nowMs) {
  return !!session && typeof session.exp === 'number' && session.exp > nowMs;
}

// ------------------------------------------------------------------
// Glue (Apps Script services). Not unit-tested in Node; exercised by
// runTests_() and the manual checklist.
// ------------------------------------------------------------------

function readLoginRows_() {
  var sheet = getSpreadsheet_().getSheetByName(LOGIN_SHEET);
  if (!sheet) throw new Error('Login sheet missing');
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var vals = sheet.getRange(2, 1, last - 1, 3).getValues(); // Username, Password, Name
  return vals.map(function (r) { return { username: r[0], password: r[1], name: r[2] }; });
}

function sessionKey_(token) { return SESSION_PREFIX + token; }

function createSession_(user) {
  var token = Utilities.getUuid() + Utilities.getUuid();
  var session = {
    username: user.username, name: user.name, role: user.role,
    exp: Date.now() + SESSION_TTL_MS
  };
  PropertiesService.getScriptProperties().setProperty(sessionKey_(token), JSON.stringify(session));
  return { token: token, session: session };
}

function readSession_(token) {
  if (!token) return null;
  var raw = PropertiesService.getScriptProperties().getProperty(sessionKey_(token));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function touchSession_(token, session) {
  session.exp = Date.now() + SESSION_TTL_MS;
  PropertiesService.getScriptProperties().setProperty(sessionKey_(token), JSON.stringify(session));
}

function deleteSession_(token) {
  PropertiesService.getScriptProperties().deleteProperty(sessionKey_(token));
}

function sweepExpiredSessions_() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var now = Date.now();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf(SESSION_PREFIX) !== 0) return;
    var ok = false;
    try { var s = JSON.parse(all[k]); ok = s && typeof s.exp === 'number' && s.exp > now; } catch (e) {}
    if (!ok) props.deleteProperty(k);
  });
}

function requireSession_(token) {
  var session = readSession_(token);
  if (!sessionValid_(session, Date.now())) throw new Error('AUTH');
  touchSession_(token, session);
  return session;
}

function lockKey_(username) { return 'lock_' + normalizeUsername_(username); }

function lockoutCount_(username) {
  var v = CacheService.getScriptCache().get(lockKey_(username));
  return v ? parseInt(v, 10) : 0;
}

function bumpLockout_(username) {
  var n = lockoutCount_(username) + 1;
  CacheService.getScriptCache().put(lockKey_(username), String(n), LOCKOUT_WINDOW_S);
  return n;
}

function clearLockout_(username) {
  CacheService.getScriptCache().remove(lockKey_(username));
}

// ---- public entry points (called via google.script.run) ----

function login(username, password) {
  if (lockoutCount_(username) >= LOCKOUT_MAX) return { ok: false, error: 'locked' };
  var user = checkCredentials_(readLoginRows_(), username, password);
  if (!user) {
    var n = bumpLockout_(username);
    return { ok: false, error: (n >= LOCKOUT_MAX) ? 'locked' : 'bad_credentials' };
  }
  clearLockout_(username);
  sweepExpiredSessions_();
  var created = createSession_(user);
  return { ok: true, token: created.token, name: user.name, role: user.role };
}

function resumeSession(token) {
  var session = readSession_(token);
  if (!sessionValid_(session, Date.now())) return { ok: false };
  touchSession_(token, session);
  return { ok: true, name: session.name, role: session.role };
}

function logout(token) {
  deleteSession_(token);
  return true;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeUsername_: normalizeUsername_,
    checkCredentials_: checkCredentials_,
    sessionValid_: sessionValid_
  };
}
