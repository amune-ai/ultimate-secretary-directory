## Task 10: Client — login view, session, logout, error banner

**Files:**
- Modify: `Index.html` (add login view markup + CSS, banner markup + CSS, and a `<script>` auth section; gate the existing dashboard init behind auth)

**Interfaces:**
- Consumes: `login`, `resumeSession`, `logout` (Tasks 4); `google.script.run`.
- Produces (client globals used by Tasks 11–12):
  - `SESSION = { token, name, role }` — populated after auth.
  - `enterDashboard()` — called once auth succeeds; Task 11 fills its body to load data.
  - `showBanner(message, kind)` where `kind` is `'error'` or `'info'`; `clearBanner()`.
  - `localStorage` key `usd_token`.

- [ ] **Step 1: Add banner + login view markup**

In `Index.html`, immediately after `<body>`, before `<div id="app">`, insert:

```html
  <div id="banner" class="banner" hidden></div>

  <div id="loginView" class="login-view">
    <form id="loginForm" class="login-card">
      <h2>تسجيل الدخول</h2>
      <label>اسم المستخدم
        <input type="text" id="loginUser" autocomplete="username" required>
      </label>
      <label>كلمة المرور
        <input type="password" id="loginPass" autocomplete="current-password" required>
      </label>
      <button type="submit" id="loginBtn">دخول</button>
      <p id="loginError" class="login-error" hidden></p>
    </form>
  </div>
```

Then add `hidden` to the app container: change `<div id="app">` to `<div id="app" hidden>`.

- [ ] **Step 2: Add CSS for banner + login view**

Inside the existing `<style>` block, append:

```css
    .banner {
      padding: 12px 16px; margin-bottom: 16px; border-radius: 8px;
      font-size: 14px; cursor: pointer;
    }
    .banner.error { background: #fdecea; color: #b3261e; border: 1px solid #f6c9c4; }
    .banner.info  { background: #e8f0fe; color: #1a56c4; border: 1px solid #c6dafc; }
    .login-view {
      min-height: 70vh; display: flex; align-items: center; justify-content: center;
    }
    .login-card {
      background: #fff; padding: 28px 26px; border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.12); width: 320px; max-width: 90vw;
      display: flex; flex-direction: column; gap: 14px;
    }
    .login-card h2 { margin: 0 0 4px; font-size: 18px; color: #333; }
    .login-card label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #444; }
    .login-card input {
      padding: 9px 11px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px;
    }
    .login-card button {
      margin-top: 4px; padding: 10px; border: none; border-radius: 6px;
      background: #1a73e8; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .login-card button:disabled { opacity: 0.6; cursor: default; }
    .login-error { margin: 0; color: #b3261e; font-size: 13px; }
```

- [ ] **Step 3: Add the auth `<script>` section**

Inside the existing `<script>` block, **replace** the final init lines:

```js
    setupSecretariatFilter();
    refreshSecretariatOptions();
    renderNav();
    renderTable();
```

with:

```js
    var SESSION = { token: null, name: null, role: null };

    function showBanner(message, kind) {
      var b = document.getElementById('banner');
      b.textContent = message;
      b.className = 'banner ' + (kind === 'info' ? 'info' : 'error');
      b.hidden = false;
      clearTimeout(showBanner._t);
      showBanner._t = setTimeout(clearBanner, 6000);
    }
    function clearBanner() { document.getElementById('banner').hidden = true; }
    document.getElementById('banner').addEventListener('click', clearBanner);

    function showLogin(msg) {
      document.getElementById('app').hidden = true;
      document.getElementById('loginView').hidden = false;
      var el = document.getElementById('loginError');
      if (msg) { el.textContent = msg; el.hidden = false; } else { el.hidden = true; }
    }

    function doEnterDashboard() {
      document.getElementById('loginView').hidden = true;
      document.getElementById('app').hidden = false;
      enterDashboard(); // defined below; Task 11 fills the body
    }

    document.getElementById('loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var u = document.getElementById('loginUser').value;
      var p = document.getElementById('loginPass').value;
      var btn = document.getElementById('loginBtn');
      btn.disabled = true;
      google.script.run
        .withSuccessHandler(function (res) {
          btn.disabled = false;
          if (res && res.ok) {
            SESSION = { token: res.token, name: res.name, role: res.role };
            try { localStorage.setItem('usd_token', res.token); } catch (err) {}
            document.getElementById('loginPass').value = '';
            doEnterDashboard();
          } else if (res && res.error === 'locked') {
            showLogin('تم قفل الحساب مؤقتاً لكثرة المحاولات. حاول بعد ١٥ دقيقة.');
          } else {
            showLogin('اسم المستخدم أو كلمة المرور غير صحيحة.');
          }
        })
        .withFailureHandler(function (err) {
          btn.disabled = false;
          showLogin('تعذّر تسجيل الدخول: ' + (err && err.message ? err.message : err));
        })
        .login(u, p);
    });

    function tryResume() {
      var saved = null;
      try { saved = localStorage.getItem('usd_token'); } catch (err) {}
      if (!saved) { showLogin(); return; }
      google.script.run
        .withSuccessHandler(function (res) {
          if (res && res.ok) {
            SESSION = { token: saved, name: res.name, role: res.role };
            doEnterDashboard();
          } else {
            try { localStorage.removeItem('usd_token'); } catch (err) {}
            showLogin();
          }
        })
        .withFailureHandler(function () { showLogin(); })
        .resumeSession(saved);
    }

    // enterDashboard is defined in Task 11. Provide a stub so this task runs
    // standalone; Task 11 replaces it.
    function enterDashboard() {
      setupSecretariatFilter();
      refreshSecretariatOptions();
      renderNav();
      renderTable();
    }

    tryResume();
```

- [ ] **Step 4: Add logout control to the toolbar**

In the toolbar markup, inside `<div class="toolbar-left">` after the `<h1>`, add:

```html
        <span id="whoami" class="whoami"></span>
        <button id="logoutBtn" class="logout-btn" type="button">خروج</button>
```

Add CSS (append to `<style>`):

```css
    .whoami { font-size: 12px; color: #666; margin-inline-start: 8px; }
    .logout-btn {
      border: 1px solid var(--border); background: #fff; color: #444;
      border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer;
    }
```

Add the handler (inside the `<script>`, after `tryResume();` is fine, or near the other listeners):

```js
    document.getElementById('logoutBtn').addEventListener('click', function () {
      var t = SESSION.token;
      SESSION = { token: null, name: null, role: null };
      try { localStorage.removeItem('usd_token'); } catch (err) {}
      if (t) google.script.run.logout(t);
      showLogin();
    });
```

- [ ] **Step 5: Push and browser-test**

Run: `clasp push -f`
Open the **Apps Script editor → Deploy → Test deployments → Web app URL** (the `@HEAD` dev URL). Then:
- Page shows the login card, dashboard hidden.
- Wrong credentials → red "غير صحيحة" message, stays on login.
- `h1` / `h11` → dashboard appears (tables may be empty/erroring — Task 11 wires data; that is expected).
- Reload the page → dashboard appears directly (session resumed from `localStorage`).
- Click خروج → back to login; reload stays on login.
- 5 wrong tries for one username → "تم قفل الحساب" message.

- [ ] **Step 6: Commit**

```bash
git add Index.html
git commit -m "feat: client login view, session resume, logout, error banner

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

