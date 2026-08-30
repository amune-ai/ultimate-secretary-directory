# Login + Accountability — v2 (incremental rebuild)

Branch: `login-accountability-v2` (off `main`, cherry-picked the live security-fixed baseline).

## Done & verified live on the @HEAD test deployment
- slice 1 — L:O columns + `setup()` ✓
- slice 2 — `Auth.gs`: login / sessions (Script Properties, 8h sliding) / lockout (5 tries / 15 min) ✓ (`runTests` passes)
- slice 3 — scoped reads (`getBootstrapData`, secretary sees only their سكرتارية rows) + tick engine (`Activity.gs writeTick_`, Code-keyed, stamps L:O, appends `ActivityLog`, un-tick-Done cascades to clear Sent) ✓
- slice 4 — `Summary.gs getAdminSummary` (per-secretary done/sent/untick, avg Done→Sent mins, oldest-pending hours) ✓
- slice 5 — client: login form, session resume via `localStorage.usd_token`, scoped dashboard, filter hidden for secretaries, Code-keyed tick calls, admin summary panel + date picker ✓
- `syncDataFast` restored to `Code.gs` (was only in a deleted backup; its trigger was erroring). ✓

## Root cause of the "login page stays" bug (this morning)
`.login-view { display:flex }` overrode the `hidden` attribute, so the form stayed on
screen sitting on top of the (working) dashboard. Fixed with `[hidden]{display:none!important}`.
Login and data-load were never broken.

## NOT done
1. **Production deploy.** Still on `@HEAD` only. Production deployment
   `AKfycbxIiT5WV92N6ksIYc0xCRKtegLNPCZpC-ubAFKDFGVLsfd9h0I2QQ69w5wFdCFY8X8O` (@12)
   still runs the old no-login version. Go live with:
   `clasp deploy --deploymentId AKfycbxIiT5WV92N6ksIYc0xCRKtegLNPCZpC-ubAFKDFGVLsfd9h0I2QQ69w5wFdCFY8X8O --description "Login + accountability v2"`
2. **Rotate `xxxxxxxxx`** (وضحة …) in the Login tab — exposed repeatedly in chat + local git. Ideally set every Login password to 12+ chars.
3. **Merge** `login-accountability-v2` → `main` (squash keeps history clean).

## Notes
- `setup` and `runTests` are non-underscore so the editor Run menu lists them; both are
  idempotent / low-risk if called anonymously. The Apps Script editor hides `_`-suffixed
  functions from the Run dropdown — that quirk is what made slice 1 look "broken".
- Login tab as read by the server (verified): 6 rows, a1=admin, the other 5 secretaries;
  names match the سكرتارية column (secretary `alajmi5635` sees 28 rows, admin sees 185).
