## Task 12: Client — admin summary panel

**Files:**
- Modify: `Index.html` (markup + CSS + `<script>` `loadSummary`/`renderSummary`)

**Interfaces:**
- Consumes: `getAdminSummary` (Task 9); `SESSION`, `showBanner` (Task 10); `enterDashboard`/`loadData` call `loadSummary` when `role==='admin'` (Task 11).
- Produces: `loadSummary()`, `renderSummary(data)`; a `#summaryPanel` shown only for admin.

- [ ] **Step 1: Add the panel markup**

Immediately after `<div id="tabNav" class="tab-nav"></div>` (inside `#app`), insert:

```html
    <div id="summaryPanel" class="summary-panel" hidden>
      <div class="summary-head">
        <strong>ملخص اليوم لكل سكرتارية</strong>
        <input type="date" id="summaryDate">
      </div>
      <div class="table-scroll">
        <table class="data-table" id="summaryTable" aria-label="ملخص الأداء">
          <thead><tr>
            <th>السكرتارية</th><th>منجز</th><th>أنجاز</th><th>تراجع</th>
            <th>متوسط الدقائق (منجز→أنجاز)</th><th>أقدم طلب معلّق (ساعات)</th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
```

- [ ] **Step 2: Add CSS**

```css
    .summary-panel {
      background: #fff; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.1);
      margin-bottom: 16px; overflow: hidden;
    }
    .summary-head {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; padding: 10px 14px; background: #f5f6f8; border-bottom: 1px solid var(--border);
      font-size: 13px;
    }
    .summary-head input[type="date"] {
      padding: 6px 9px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px;
    }
    #summaryTable th { background: #37474f; color: #fff; }
```

- [ ] **Step 3: Add `loadSummary` / `renderSummary` to `<script>`**

```js
    function loadSummary() {
      var dateInput = document.getElementById('summaryDate');
      var dateStr = dateInput.value || '';
      google.script.run
        .withSuccessHandler(function (res) {
          if (dateInput && res && res.date && !dateInput.value) dateInput.value = res.date;
          renderSummary(res);
        })
        .withFailureHandler(function (err) {
          showBanner('تعذّر تحميل الملخص: ' + (err && err.message ? err.message : err), 'error');
        })
        .getAdminSummary(SESSION.token, dateStr);
    }

    function renderSummary(res) {
      var tbody = document.querySelector('#summaryTable tbody');
      tbody.innerHTML = '';
      var rows = (res && res.rows) || [];
      if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-row">لا يوجد نشاط لهذا اليوم</td></tr>';
        return;
      }
      rows.forEach(function (r) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + escapeHtml(r.secretary) + '</td>' +
          '<td>' + r.done + '</td>' +
          '<td>' + r.sent + '</td>' +
          '<td>' + r.untick + '</td>' +
          '<td>' + (r.avgMinutes == null ? '—' : r.avgMinutes) + '</td>' +
          '<td>' + r.oldestPendingHours + '</td>';
        tbody.appendChild(tr);
      });
    }

    document.getElementById('summaryDate').addEventListener('change', loadSummary);
```

- [ ] **Step 4: Push and browser-test (dev URL)**

Run: `clasp push -f`
- Log in as `a1`/`a11` → summary panel visible above the tabs, date defaults to today, one row per active secretary with counts.
- Tick a couple of rows as `a1`, change nothing else, click refresh → counts increase.
- Change the date picker to yesterday → numbers change (or "لا يوجد نشاط").
- Log in as `h1`/`h11` → summary panel not shown.

- [ ] **Step 5: Commit**

```bash
git add Index.html
git commit -m "feat: admin daily summary panel with date picker

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

