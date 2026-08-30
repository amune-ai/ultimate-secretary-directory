## Task 3: Auth pure helpers + Node tests

**Files:**
- Create: `Auth.js` (pure section only)
- Create: `tests/auth.test.js`

**Interfaces:**
- Consumes: `ADMIN_USERNAME` (global; the test sets `global.ADMIN_USERNAME` before `require`).
- Produces:
  - `normalizeUsername_(s) -> string` — trim + lowercase, null-safe.
  - `checkCredentials_(loginRows, username, password) -> {username, name, role} | null` where `loginRows` is `[{username, password, name}]`; `role` is `'admin'` iff normalized username === normalized `ADMIN_USERNAME`; empty password never matches.
  - `sessionValid_(session, nowMs) -> boolean` — true iff `session` truthy and `session.exp` is a number `> nowMs`.

- [ ] **Step 1: Write the failing test — `tests/auth.test.js`**

```js
const assert = require('node:assert');
global.ADMIN_USERNAME = 'a1';
const { normalizeUsername_, checkCredentials_, sessionValid_ } = require('../Auth.js');

const rows = [
  { username: 'a1', password: 'a11', name: 'عبدالرحمن المراقي' },
  { username: 'h1', password: 'h11', name: 'حصة الردهان' },
  { username: 'alajmi5635', password: 'xxxxxxxxx', name: 'وضحة الحجرف' },
];

// normalizeUsername_
assert.strictEqual(normalizeUsername_('  A1 '), 'a1');
assert.strictEqual(normalizeUsername_(null), '');

// checkCredentials_ — admin
let r = checkCredentials_(rows, 'A1', 'a11');
assert.deepStrictEqual(r, { username: 'a1', name: 'عبدالرحمن المراقي', role: 'admin' });

// checkCredentials_ — secretary
r = checkCredentials_(rows, 'h1', 'h11');
assert.strictEqual(r.role, 'secretary');
assert.strictEqual(r.name, 'حصة الردهان');

// wrong password
assert.strictEqual(checkCredentials_(rows, 'h1', 'nope'), null);
// unknown user
assert.strictEqual(checkCredentials_(rows, 'ghost', 'x'), null);
// empty password never matches even if the row's password is empty
assert.strictEqual(checkCredentials_([{ username: 'x', password: '', name: 'X' }], 'x', ''), null);

// sessionValid_
assert.strictEqual(sessionValid_({ exp: 2000 }, 1000), true);
assert.strictEqual(sessionValid_({ exp: 500 }, 1000), false);
assert.strictEqual(sessionValid_(null, 1000), false);
assert.strictEqual(sessionValid_({}, 1000), false);

console.log('auth.test.js OK');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/auth.test.js`
Expected: FAIL — `Cannot find module '../Auth.js'`.

- [ ] **Step 3: Create `Auth.js` with the pure helpers**

```js
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
      return {
        username: u,
        name: String(row.name == null ? '' : row.name).trim(),
        role: (u === normalizeUsername_(ADMIN_USERNAME)) ? 'admin' : 'secretary'
      };
    }
  }
  return null;
}

function sessionValid_(session, nowMs) {
  return !!session && typeof session.exp === 'number' && session.exp > nowMs;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeUsername_: normalizeUsername_,
    checkCredentials_: checkCredentials_,
    sessionValid_: sessionValid_
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/auth.test.js`
Expected: `auth.test.js OK`

- [ ] **Step 5: Commit**

```bash
git add Auth.js tests/auth.test.js
git commit -m "test: auth pure helpers (checkCredentials_, sessionValid_)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

