## Task 6: Row lookup by Code — pure + Node tests

**Files:**
- Create: `Activity.js` (pure section only)
- Create: `tests/activity.test.js`

**Interfaces:**
- Consumes: `COL` (global; test sets `global.COL`).
- Produces:
  - `findRowByCode_(values, code, rowHint) -> {index0:number, sheetRow:number}`. `values` is the raw `A2:O` 2D array. Matches on `COL.CODE` trimmed-equal to `code` trimmed. Exactly one match → return it. Zero → `throw Error('NOT_FOUND')`. Blank `code` → `throw Error('NO_CODE')`. Multiple matches → if `rowHint` (1-based sheet row) points at one of them, return that; else `throw Error('AMBIGUOUS')`.

- [ ] **Step 1: Write the failing test — `tests/activity.test.js`**

```js
const assert = require('node:assert');
global.COL = { CODE: 4 };
const { findRowByCode_ } = require('../Activity.js');

function rowWithCode(c) { const r = new Array(15).fill(''); r[4] = c; return r; }
const values = [rowWithCode('C-1'), rowWithCode('C-2'), rowWithCode('C-3')];

assert.deepStrictEqual(findRowByCode_(values, 'C-2', 3), { index0: 1, sheetRow: 3 });
assert.deepStrictEqual(findRowByCode_(values, ' C-3 ', null), { index0: 2, sheetRow: 4 });

assert.throws(() => findRowByCode_(values, 'C-9', null), /NOT_FOUND/);
assert.throws(() => findRowByCode_(values, '', null), /NO_CODE/);
assert.throws(() => findRowByCode_(values, '   ', null), /NO_CODE/);

// duplicate code -> hint resolves, otherwise AMBIGUOUS
const dup = [rowWithCode('D'), rowWithCode('D'), rowWithCode('X')];
assert.deepStrictEqual(findRowByCode_(dup, 'D', 3), { index0: 1, sheetRow: 3 }); // hint = sheetRow 3 -> index0 1
assert.throws(() => findRowByCode_(dup, 'D', null), /AMBIGUOUS/);
assert.throws(() => findRowByCode_(dup, 'D', 99), /AMBIGUOUS/);

console.log('activity.test.js OK');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/activity.test.js`
Expected: FAIL — `Cannot find module '../Activity.js'`.

- [ ] **Step 3: Create `Activity.js` pure section**

```js
/**
 * Done / أنجاز(Sent) tick writes. Locates the target row by its immutable
 * Code (column E) rather than a row number, stamps DoneAt/DoneBy or
 * SentAt/SentBy, and appends an ActivityLog row.
 */

// values: raw A2:O 2D array. rowHint: 1-based sheet row from the client, used
// only to disambiguate a duplicate Code. Returns {index0, sheetRow}.
function findRowByCode_(values, code, rowHint) {
  var wanted = String(code == null ? '' : code).trim();
  if (wanted === '') throw new Error('NO_CODE');

  var matches = [];
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][COL.CODE]).trim() === wanted) matches.push(i);
  }
  if (matches.length === 1) return { index0: matches[0], sheetRow: matches[0] + 2 };
  if (matches.length === 0) throw new Error('NOT_FOUND');

  var hintIdx0 = Number(rowHint) - 2;
  if (matches.indexOf(hintIdx0) !== -1) return { index0: hintIdx0, sheetRow: hintIdx0 + 2 };
  throw new Error('AMBIGUOUS');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { findRowByCode_: findRowByCode_ };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/activity.test.js`
Expected: `activity.test.js OK`

- [ ] **Step 5: Commit**

```bash
git add Activity.js tests/activity.test.js
git commit -m "test: findRowByCode_ row lookup by Code column

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

