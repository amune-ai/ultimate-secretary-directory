# Task 10 Report — Client login view, session, logout, error banner

Branch: `login-accountability`. Only `Index.html` changed.

## Pre-check
- The four trailing init lines were present verbatim at the end of `<script>`
  (`setupSecretariatFilter(); refreshSecretariatOptions(); renderNav(); renderTable();`).
- Toolbar structure matched the brief: `.toolbar` → `.toolbar-left` containing the
  refresh `<button>` then `<h1>`.

## Edits

### Step 1 — banner + login view markup
Inserted immediately after `<body>`, before `<div id="app">`:
`<div id="banner" class="banner" hidden>` plus the `<div id="loginView">` /
`<form id="loginForm" class="login-card">` block (h2, loginUser, loginPass,
loginBtn, `<p id="loginError">`), verbatim from the brief.
Changed `<div id="app">` → `<div id="app" hidden>`.

### Step 2 — banner + login CSS
Appended the `.banner`, `.banner.error`, `.banner.info`, `.login-view`,
`.login-card` (+ h2/label/input/button/:disabled), `.login-error` rules to the
**existing** `<style>` block (just before `</style>`). No new style block.

### Step 4 markup — toolbar controls
Inside `.toolbar-left`, after the `<h1>`, added
`<span id="whoami" class="whoami"></span>` and
`<button id="logoutBtn" class="logout-btn" type="button">خروج</button>`.
Appended `.whoami` and `.logout-btn` CSS to the same `<style>` block.

### Step 3 — auth `<script>` section
Replaced the four trailing init lines with the brief's Step 3 block:
`SESSION` var, `showBanner`/`clearBanner` (+ banner click listener), `showLogin`,
`doEnterDashboard`, the `loginForm` submit handler, `tryResume`, the
`enterDashboard()` stub (containing the 4 init lines), and the trailing
`tryResume();` call.

### Step 4 handler — logout
Added the `logoutBtn` click handler immediately after `tryResume();` (brief
permits "after `tryResume();` is fine").

## Verification

### Exactly one style / one script
```
grep -c '<style>'   -> 1
grep -c '</style>'  -> 1
grep -c '<script>'  -> 1
grep -c '</script>' -> 1
```

### Referenced-ID existence (all found in markup)
```
banner     id="banner"
loginView  id="loginView"
loginForm  id="loginForm"
loginUser  id="loginUser"
loginPass  id="loginPass"
loginBtn   id="loginBtn"
loginError id="loginError"
app        id="app"
whoami     id="whoami"
logoutBtn  id="logoutBtn"
```

### Script body parse (template tags stubbed)
```
node -e "new Function(require('fs').readFileSync('Index.html','utf8').split(/<script>/)[1].split(/<\/script>/)[0].replace(/<\?!=[^?]*\?>/g,'null'))"
-> exit 0, no output  (braces/parens balanced)
```

### 4 init lines live only in the stub
`grep -n` shows `setupSecretariatFilter();` only at line 716 (inside
`function enterDashboard()`), with `renderTable();` at 719 in the same stub.
Other `renderTable();` hits (345, 393, 611, 630) are pre-existing calls in
`renderNav` / tab onclick / tick + refresh handlers. `tryResume();` is at line
722; the logout listener follows it.

## clasp push
```
clasp push -f
Pushed 7 files at 5:55:06 AM.
  Activity.js, appsscript.json, Auth.js, Code.js, Index.html, Setup.js, Summary.js
```
No `clasp deploy` run. (7 = 5 server .js + appsscript.json + Index.html.)

## Commit
- Files changed: `Index.html` only (138 insertions, 5 deletions).
- Commit: `92906fa` — `feat: client login view, session resume, logout, error banner`
- Trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`

## Concerns
- None structural. Browser behavior (login card renders, wrong-creds message,
  resume-on-reload, logout, lockout message) is **deferred to Task 13** — no
  browser available here.
