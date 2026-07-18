---
name: verify
description: Drive the Florish app (Expo web) headlessly and screenshot signed-in screens to verify UI changes.
---

# Verifying Florish UI changes on Expo web

Metro serves web + API routes on http://localhost:8081 (auto-started at logon).
First response after a cold start can take 30-60s while it bundles.

## Get a signed-in session (never use the real admin account)

```powershell
$body = @{ name = "Verify"; email = "verify-bot-$(Get-Random)@example.com"; password = "verify123" } | ConvertTo-Json
$r = Invoke-RestMethod -Uri "http://localhost:8081/api/signup" -Method Post -ContentType "application/json" -Body $body
Invoke-RestMethod -Uri "http://localhost:8081/api/me" -Method Patch -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $($r.token)" } -Body '{"onboardingComplete":true}'
```

Without `onboardingComplete: true` the app redirects to /onboarding/goal.
On web the session token lives in `localStorage["florish_session"]`.

## Screenshot

No playwright/puppeteer in the repo. Install `playwright-core` (no browser
download) in the scratchpad and launch installed Chrome at
`C:\Program Files\Google\Chrome\Application\chrome.exe` with
`addInitScript` setting `localStorage["florish_session"]` before `goto`.
Use viewport 390x844 (or 360x640 for narrow probe), deviceScaleFactor 2.
Wait for `text=/GOOD (MORNING|AFTERNOON|EVENING)/` then ~3s for images.

Gotchas:
- Bare `chrome --headless --screenshot` silently produces nothing if a
  Chrome instance is already running; always pass a throwaway
  `--user-data-dir`.
- `adjustsFontSizeToFit` does not work on web (text ellipsizes instead);
  judge auto-shrink behavior on native, not in these screenshots.
- Throwaway accounts persist in the local Postgres dev DB; reuse the
  pattern `verify-bot-*@example.com` so they are recognizable.
