# Renew Parts lab server

One Go program. It serves the parts app (`parts/index.html`, embedded at build time as `app.html`) and keeps shared lab data in SQLite.

Build: copy `parts/index.html` to `parts-server/app.html`, then `go build`. `pack.py` makes the Windows, Mac and Linux zips.

`live.js` is the sync layer that is pasted into the app before `function load()`. The app runs in demo mode unless it is served by this server.

Tests (need Node and Playwright): `tests/apitest.js` (30 checks), `tests/livetest.js` (32 checks, two devices), `tests/liveui.js` (11 checks, real screens). They expect the built binary next to them as `rps`.
