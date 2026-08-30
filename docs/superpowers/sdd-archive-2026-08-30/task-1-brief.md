## Task 1: Repo cleanup and clasp ignore rules

**Files:**
- Delete: `bkp.html`
- Delete: `BKP1Codegs.html`
- Create: `.claspignore`

**Interfaces:**
- Consumes: nothing.
- Produces: a `clasp push` that uploads only real source (`appsscript.json`, `Code.js`, `Index.html`, and later `Auth.js`/`Activity.js`/`Summary.js`/`Setup.js`).

- [ ] **Step 1: Delete the two backup files**

```bash
cd /home/amune/ultimate-secretary-directory
git rm bkp.html BKP1Codegs.html
```

- [ ] **Step 2: Create `.claspignore`**

```
# Local-only; never pushed to Apps Script
docs/**
tests/**
**/*.md
.claspignore
.gitignore
.git/**
node_modules/**
```

- [ ] **Step 3: Verify clasp will push only source**

Run: `clasp status`
Expected: the "Not ignored files" / "tracked" list contains `appsscript.json`, `Code.js`, `Index.html` and **not** `bkp.html`, `BKP1Codegs.html`, anything under `docs/` or `tests/`.

- [ ] **Step 4: Push**

Run: `clasp push -f`
Expected: `Pushed 3 files.` (appsscript.json, Code.js, Index.html)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove backup files, add .claspignore

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

