# Task 6: Row lookup by Code — TDD Report

## TDD Evidence

### RED (Step 2)
**Command:** `node tests/activity.test.js`

**Output:**
```
Error: Cannot find module '../Activity.js'
...
  code: 'MODULE_NOT_FOUND',
```

**Why:** Module `Activity.js` did not yet exist.

### GREEN (Step 4)
**Command:** `node tests/activity.test.js`

**Output:**
```
activity.test.js OK
```

## Implementation Details

### Files Created
1. **tests/activity.test.js** (21 lines)
   - Tests all error paths: NOT_FOUND, NO_CODE (empty and whitespace)
   - Tests single match with trimmed whitespace handling
   - Tests duplicate code resolution via rowHint
   - Tests AMBIGUOUS cases (no hint, hint mismatch)

2. **Activity.js** (28 lines)
   - Pure function `findRowByCode_(values, code, rowHint)`
   - Matches on `COL.CODE` (column E) trimmed-equal to `code` trimmed
   - Returns `{index0, sheetRow: index0+2}` for single match
   - Throws `Error('NOT_FOUND')` for zero matches
   - Throws `Error('NO_CODE')` for blank/whitespace code
   - Uses rowHint (1-based sheet row) to disambiguate duplicates
   - Throws `Error('AMBIGUOUS')` for multiple matches without valid hint
   - Includes export guard for Node/browser compatibility

## Validation Steps

**Step 3a: Syntax Check**
```bash
node --check Activity.js
# ✓ Syntax check OK
```

**Step 5: Commit**
```
Commit: 12f2f6b
Subject: test: findRowByCode_ row lookup by Code column
Co-Author: Claude Sonnet 5 <noreply@anthropic.com>
Files: Activity.js, tests/activity.test.js
```

**Step 5b: Push to Apps Script**
```bash
clasp push -f
# Pushed 6 files at 5:39:14 AM
# └─ Activity.js (NEW)
# └─ appsscript.json
# └─ Auth.js
# └─ Code.js
# └─ Index.html
# └─ Setup.js
```

✓ `tests/` excluded via `.claspignore` (line 3: `tests/**`)

## Test Coverage Verification

All 11 assertions in brief covered:

- ✓ Single match C-2 with rowHint 3 → `{index0: 1, sheetRow: 3}`
- ✓ Single match ' C-3 ' (whitespace trim) → `{index0: 2, sheetRow: 4}`
- ✓ NOT_FOUND for 'C-9'
- ✓ NO_CODE for ''
- ✓ NO_CODE for '   ' (whitespace only)
- ✓ Duplicate 'D': rowHint 3 resolves to `{index0: 1, sheetRow: 3}`
- ✓ Duplicate 'D': rowHint null throws AMBIGUOUS
- ✓ Duplicate 'D': rowHint 99 (invalid) throws AMBIGUOUS

## Interface Delivered

```javascript
findRowByCode_(values, code, rowHint)
→ {index0: number, sheetRow: number}
```

Ready for Task 7 integration (glue code appended to Activity.js).

## Concerns

None. TDD workflow complete:
- RED captured (module not found)
- GREEN captured (all tests pass)
- Syntax validated
- Push successful (tests/ excluded)
- Commit with co-author trailer
- Files match brief exactly
