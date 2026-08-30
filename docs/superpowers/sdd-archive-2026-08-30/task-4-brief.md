## Task 4: Auth glue — session store, lockout, login/resume/logout

**Files:**
- Modify: `Auth.js` (append glue section before the `module.exports` block)

**Interfaces:**
- Consumes: pure helpers from Task 3; constants from Task 2; `getSpreadsheet_` from `Code.js`.
- Produces:
  - `readLoginRows_() -> [{username, password, name}]` — reads `Login!A2:C`.
  - `createSession_(user) -> {token, session}` — `user` is `{username, name, role}`; token is two UUIDs concatenated.
  - `readSession_(token) -> session|null`; `touchSession_(token, session)`; `deleteSession_(token)`; `sweepExpiredSessions_()`.
  - `requireSession_(token) -> {username, name, role}` — throws `Error('AUTH')` if invalid/expired; extends expiry on success.
  - `lockoutCount_(username) -> number`; `bumpLockout_(username) -> number`; `clearLockout_(username)`.
  - `login(username, password) -> {ok:true, token, name, role} | {ok:false, error:'bad_credentials'|'locked'}`.
  - `resumeSession(token) -> {ok:true, name, role} | {ok:false}`.
  - `logout(token) -> true`.

- [ ] **Step 1: Append the glue section to `Auth.js`**

Insert **above** the `if (typeof module !== 'undefined' ...)` block:

```js
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
```

- [ ] **Step 2: Create `runTests_()` in `Setup.js` with a session round-trip assertion**

Append to `Setup.js`:

```js
/**
 * In-editor test runner. Select runTests_ in the Apps Script editor and
 * Run; check the Execution log for "runTests_: ALL PASS" or a thrown
 * assertion. Re-run after any server change.
 */
function runTests_() {
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

  // --- checkCredentials_ ---
  var rows = [
    { username: 'a1', password: 'a11', name: 'Admin Name' },
    { username: 'h1', password: 'h11', name: 'حصة الردهان' }
  ];
  eq(checkCredentials_(rows, 'A1', 'a11').role, 'admin', 'cc admin role');
  eq(checkCredentials_(rows, 'h1', 'h11').role, 'secretary', 'cc secretary role');
  eq(checkCredentials_(rows, 'h1', 'bad'), null, 'cc wrong pw');

  // --- session round-trip via Script Properties ---
  var made = createSession_({ username: 'h1', name: 'حصة الردهان', role: 'secretary' });
  truthy(made.token && made.token.length > 30, 'session token generated');
  var got = requireSession_(made.token);
  eq(got.username, 'h1', 'requireSession_ returns session');
  logout(made.token);
  throws(function () { requireSession_(made.token); }, 'requireSession_ after logout throws');

  // --- expired session ---
  var expired = { username: 'x', name: 'x', role: 'secretary', exp: Date.now() - 1000 };
  PropertiesService.getScriptProperties().setProperty(SESSION_PREFIX + 'TESTEXP', JSON.stringify(expired));
  throws(function () { requireSession_('TESTEXP'); }, 'expired session throws');
  PropertiesService.getScriptProperties().deleteProperty(SESSION_PREFIX + 'TESTEXP');

  Logger.log('runTests_: ALL PASS');
}
```

- [ ] **Step 3: Push and run runTests_()**

Run: `clasp push -f`
Then in the Apps Script editor: run `runTests_`.
Expected (Execution log): `runTests_: ALL PASS`.

- [ ] **Step 4: Manual — real login round-trip**

In the editor, run this throwaway snippet (paste as a temp function, run, then delete it):

```js
function _tmpLogin() {
  Logger.log(login('h1', 'h11'));      // expect ok:true, role secretary
  Logger.log(login('h1', 'wrong'));    // expect ok:false, bad_credentials
}
```

Expected log: first line `{ok=true, token=..., name=حصة الردهان, role=secretary}`; second `{ok=false, error=bad_credentials}`. Delete `_tmpLogin` after.

- [ ] **Step 5: Commit**

```bash
git add Auth.js Setup.js
git commit -m "feat: session store, lockout, login/resume/logout endpoints

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

