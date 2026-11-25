# Phish or Legit

A browser-based cybersecurity awareness game. Investigate synthetic email, SMS and login-page evidence, classify each case, and learn why.

All examples use fictional organisations and reserved domains. Links are inert, attachments are metadata only, and the game never asks for credentials or sends data to a server.

## Run locally

Serve the repository with `python -m http.server 8000` and open `http://localhost:8000`. No build step or dependencies are required. The site can also be hosted on any static host.

## Tests

Run `node --test tests/game.test.cjs` with Node.js 20 or later.

Progress and personal bests are stored on the device only. Use Reset progress to erase them. This is a simulation, not a live phishing scanner. Authentication results, domain age and attachment analysis are illustrative rather than real lookups.
