# Phish or Legit

A browser-based cybersecurity awareness game with 30 fictional email, SMS and login-page investigations. Three difficulty levels, an evidence toolkit, verdict explanations, session statistics and retries.

## Run locally

Serve the repository with `python3 -m http.server 8000` and open `http://localhost:8000`. No runtime dependencies or build step.

## Quality checks

With Node.js 22 and Python 3 installed:

```sh
node --test tests/*.test.cjs
npm install --no-save --no-package-lock playwright@1.56.1
npx playwright install --with-deps chromium firefox webkit
node tests/browser.mjs
```

The CI workflow runs the unit and integration tests and all 30 cases in each of Chromium, Firefox and WebKit at desktop and mobile viewport sizes. Deployment runs only after the test job succeeds.

## GitHub Pages

In repository Settings > Pages, select GitHub Actions as the publishing source. Run the **Test and deploy GitHub Pages** workflow from the Actions tab if needed. Only the six public runtime assets are packaged. Expected URL: https://pg-thirion.github.io/Phish-or-Legit/

## Safety and privacy

All examples use fictional organisations and reserved .example domains. Links are inert, attachments are metadata only, and the game never collects credentials or sends data to a server. The app uses a restrictive content security policy and text-only DOM rendering. Personal bests are stored locally as average points per completed case, with no server account or analytics. Use Reset progress to erase your saved best. Older total-score records are not used because they cannot be compared with average scores.

This is a simulation, not a live phishing scanner. Authentication results, domain age and attachment analysis are illustrative. Client-side answers are available in the source and are not suitable for a tamper-resistant examination.
