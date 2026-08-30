## Task 11: Client — wire dashboard to bootstrap, scoped tick writes, role-based filter

**Files:**
- Modify: `Index.html` (`<script>` — replace the `enterDashboard` stub; adapt data load, refresh, tick handlers, `data-code` on rows, aria-labels, "last updated")

**Interfaces:**
- Consumes: `getBootstrapData`, `refreshTabsData` (Task 5); `setRowDone`, `setRowSent` (Task 7); `SESSION`, `showBanner` (Task 10).
- Produces: a fully working scoped dashboard. `TABS_DATA` now loaded at runtime, not inlined.

- [ ] **Step 1: Remove the inlined-data global**

At the top of the `<script>`, the three template lines currently read:

```js
    var TABS_CONFIG = <?!= tabsConfigJson ?>;
    var COLUMN_HEADERS = <?!= columnHeadersJson ?>;
    var TABS_DATA = <?!= tabsDataJson ?>;
```

Change to:

```js
    var TABS_CONFIG = <?!= tabsConfigJson ?>;
    var COLUMN_HEADERS = <?!= columnHeadersJson ?>;
    var TABS_DATA = {};
```

- [ ] **Step 2: Replace the `enterDashboard` stub (from Task 10) with the real one**

```js
    function enterDashboard() {
      document.getElementById('whoami').textContent = SESSION.name || '';
      var filterBox = document.querySelector('.filter-box');
      if (filterBox) filterBox.style.display = (SESSION.role === 'admin') ? '' : 'none';
      var summary = document.getElementById('summaryPanel');
      if (summary) summary.hidden = (SESSION.role !== 'admin');

      setupSecretariatFilter();
      loadData(true);
    }

    function setLastUpdated() {
      var el = document.getElementById('lastUpdated');
      if (!el) return;
      var d = new Date();
      var hh = ('0' + d.getHours()).slice(-2);
      var mm = ('0' + d.getMinutes()).slice(-2);
      el.textContent = 'آخر تحديث ' + hh + ':' + mm;
    }

    function loadData(initial) {
      var btn = document.getElementById('refreshBtn');
      btn.classList.add('spinning');
      var runner = google.script.run
        .withSuccessHandler(function (res) {
          btn.classList.remove('spinning');
          TABS_DATA = (res && res.tabsData) ? res.tabsData : (res || {});
          refreshSecretariatOptions();
          renderNav();
          renderTable();
          setLastUpdated();
          if (SESSION.role === 'admin' && typeof loadSummary === 'function') loadSummary();
        })
        .withFailureHandler(function (err) {
          btn.classList.remove('spinning');
          var msg = (err && err.message) ? err.message : String(err);
          if (String(msg).indexOf('AUTH') !== -1) {
            try { localStorage.removeItem('usd_token'); } catch (e) {}
            showLogin('انتهت الجلسة. سجّل الدخول من جديد.');
          } else {
            showBanner('تعذّر تحميل البيانات: ' + msg, 'error');
          }
        });
      if (initial) runner.getBootstrapData(SESSION.token);
      else runner.refreshTabsData(SESSION.token);
    }
```

- [ ] **Step 3: Repoint the refresh button and delete the old `refreshData`**

The old `refreshData` function and its listener call `.refreshTabsData()` with no token. Replace the whole `refreshData` function with:

```js
    function refreshData() { loadData(false); }
```

(The existing `document.getElementById('refreshBtn').addEventListener('click', refreshData);` line stays.)

- [ ] **Step 4: Add `data-code` to rows and disable un-trackable checkboxes**

In `buildTableMarkup`, the row open tag currently is:

```js
          html += '<tr class="' + rowClasses + '" data-sheet-row="' + row.sheetRow + '">';
```

Change to:

```js
          var noCode = !row.code;
          html += '<tr class="' + rowClasses + '" data-sheet-row="' + row.sheetRow +
                  '" data-code="' + escapeAttr(row.code || '') + '">';
```

And the two checkbox cells currently are:

```js
          html += '<td class="tick-cell"><input type="checkbox" class="tick-checkbox" ' + (row.done ? 'checked' : '') + ' /></td>';
          if (showSentColumn) {
            html += '<td class="tick-cell"><input type="checkbox" class="tick-checkbox-sent" ' + (row.sent ? 'checked' : '') + ' /></td>';
          }
```

Change to:

```js
          html += '<td class="tick-cell"><input type="checkbox" class="tick-checkbox" aria-label="تحديد كمنجز" ' +
                  (row.done ? 'checked ' : '') + (noCode ? 'disabled title="لا يمكن التتبع: لا يوجد Code" ' : '') + '/></td>';
          if (showSentColumn) {
            html += '<td class="tick-cell"><input type="checkbox" class="tick-checkbox-sent" aria-label="تحديد أنجاز" ' +
                    (row.sent ? 'checked ' : '') + (noCode ? 'disabled title="لا يمكن التتبع: لا يوجد Code" ' : '') + '/></td>';
          }
```

- [ ] **Step 5: Add an `aria-label` to each table**

In `buildTableMarkup`, change `'<table class="data-table">...'` opening to:

```js
      var html = '<table class="data-table" aria-label="' + escapeAttr(tab.label) + '"><thead><tr>';
```

- [ ] **Step 6: Send `code` + row hint from the tick change handler**

The change handler currently ends with:

```js
        })[config.serverFn](sheetName, Number(sheetRow), checked);
```

and reads `var sheetRow = tr.getAttribute('data-sheet-row');`. Update the handler block: after `var tr = checkbox.closest('tr');` add:

```js
      var code = tr.getAttribute('data-code');
```

Replace the failure handler + call tail:

```js
        .withFailureHandler(function (err) {
          checkbox.disabled = false;
          checkbox.checked = !checked;
          tr.classList.toggle(config.rowClass, !checked);
          var msg = (err && err.message) ? err.message : String(err);
          if (String(msg).indexOf('AUTH') !== -1) {
            try { localStorage.removeItem('usd_token'); } catch (e) {}
            showLogin('انتهت الجلسة. سجّل الدخول من جديد.');
          } else if (String(msg).indexOf('NOT_YOUR_ROW') !== -1) {
            showBanner('لا يمكنك تعديل صف سكرتارية أخرى.', 'error');
          } else if (String(msg).indexOf('DONE_FIRST') !== -1) {
            showBanner('حدد "منجز" أولاً قبل "أنجاز".', 'error');
          } else if (/NOT_FOUND|AMBIGUOUS|NO_CODE/.test(String(msg))) {
            showBanner('تعذّر تحديد الصف. اضغط تحديث ثم أعد المحاولة.', 'error');
          } else {
            showBanner('تعذّر الحفظ: ' + msg, 'error');
          }
        })[config.serverFn](SESSION.token, sheetName, code, Number(sheetRow), checked);
```

And update the success handler to use the returned `{code, done, sent}`:

```js
        .withSuccessHandler(function (updated) {
          updateLocalTickState(sheetName, sheetRow, config.field, checked);
          renderTable();
        })
```

(Leaving `updateLocalTickState` keyed on `sheetRow` is fine — it still matches the in-memory row.)

- [ ] **Step 7: Add the "last updated" element**

In the toolbar, after the refresh button, add:

```html
        <span id="lastUpdated" class="whoami"></span>
```

- [ ] **Step 8: Push and browser-test (dev URL)**

Run: `clasp push -f`
On the `@HEAD` web app URL:
- Log in as `h1`/`h11` → only that secretary's rows across the 3 tabs; **no** سكرتارية dropdown; "logged in as" shows her name; "آخر تحديث HH:MM" appears.
- Tick Done on one of her rows → row turns green, stays; open the sheet → `Done` in J, timestamp L, `h1` in M; `ActivityLog` row appended.
- Tick أنجاز before Done on a fresh row → banner "حدد منجز أولاً".
- Refresh button → spins, reloads her scoped data.
- Log in as `a1`/`a11` → all rows, dropdown visible, can tick any row.
- Let the session sit (or delete the `sess_` property in the editor) then act → "انتهت الجلسة" and back to login.

- [ ] **Step 9: Commit**

```bash
git add Index.html
git commit -m "feat: scoped dashboard load, Code-keyed tick writes, role-based filter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

